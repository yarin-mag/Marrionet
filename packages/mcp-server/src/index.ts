#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AgentMetadata } from "@marionette/shared";
import { WebSocketService } from "./services/websocket.service.js";
import { JiraService } from "./services/jira.service.js";
import { ToolRegistry } from "./tools/index.js";
import { createAgentIdentity, writeTempFile, cleanupTempFile, registerWithProxy } from "./utils/agent-ids.js";
import { logger } from "./utils/logger.js";
import { config } from "./config/index.js";

/**
 * Marionette MCP Server
 * Refactored with clean separation of concerns
 */
class MarionetteMCPServer {
  private server: Server;
  // Fields initialized in run() before the transport connects — safe to use `!`
  private agentId!: string;
  private runId!: string;
  private agentMetadata!: AgentMetadata;
  private wsService!: WebSocketService;
  private jiraService!: JiraService;
  private toolRegistry!: ToolRegistry;

  constructor() {
    // Create MCP server immediately; identity and services are initialized in run()
    this.server = new Server(
      {
        name: config.mcp.name,
        version: config.mcp.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolRegistry.getDefinitions(),
    }));

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      const args = request.params.arguments ?? {};
      if (!name) {
        throw new Error("Tool call missing required 'name' field");
      }
      return this.toolRegistry.handleToolCall(name, args);
    });
  }

  /**
   * Fetch MCP-related preferences from the server.
   * Defaults to false on failure (fail-closed).
   */
  private async fetchMcpPrefs(): Promise<{ setTaskEnabled: boolean; jiraEnabled: boolean }> {
    const off = { setTaskEnabled: false, jiraEnabled: false };
    try {
      const res = await fetch(`${config.apiUrl}/api/preferences`, {
        signal: AbortSignal.timeout(500),
      });
      if (!res.ok) return off; // server error → do nothing
      const prefs = await res.json() as Record<string, unknown>;
      const result = {
        setTaskEnabled: prefs.mcpSetTaskEnabled === true,
        jiraEnabled: prefs.mcpJiraEnabled === true,
      };
      logger.info(`[mcp-server] Preferences: setTaskEnabled=${result.setTaskEnabled} jiraEnabled=${result.jiraEnabled}`);
      return result;
    } catch (err) {
      logger.warn("[mcp-server] Could not fetch preferences (defaulting to off):", err);
      return off;
    }
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    // Resolve agent identity (async file I/O — avoids blocking the event loop)
    const identity = await createAgentIdentity();
    this.agentId = identity.agentId;
    this.runId = identity.runId;
    this.agentMetadata = identity.metadata;

    // Write temp file so hook scripts and file watcher can find this agent_id and source
    writeTempFile(this.agentId, this.agentMetadata.source as 'cli' | 'vscode' | 'mcp', process.cwd());
    // Register cleanup handlers immediately so any subsequent failure still deletes the temp file
    this.setupCleanup();

    // Register with the API proxy — retries in the background until the proxy is up
    registerWithProxy(this.agentId, this.runId, process.cwd());

    // Initialize services with resolved identity
    this.wsService = new WebSocketService(this.agentId, this.runId, this.agentMetadata);
    this.jiraService = new JiraService(this.agentId);

    // Fetch user preferences before exposing tools to Claude Code
    const { setTaskEnabled, jiraEnabled } = await this.fetchMcpPrefs();

    // Initialize tool registry once with the fetched flags
    this.toolRegistry = new ToolRegistry(
      this.jiraService,
      this.agentId,
      setTaskEnabled,
      jiraEnabled
    );

    // Connect to Marionette via WebSocket
    this.wsService.connect();

    // Connect MCP transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info("MCP server running");
    logger.info(`Agent ID: ${this.agentId}`);
    logger.info(`WebSocket URL: ${config.wsUrl}`);
    logger.info(`set_task enabled: ${setTaskEnabled}, jira enabled: ${jiraEnabled}`);

  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanup(): void {
    const doCleanup = () => {
      logger.info("Shutting down...");
      cleanupTempFile(process.cwd());
      this.wsService?.close();
      process.exit(0);
    };

    process.on("SIGINT", doCleanup);
    process.on("SIGTERM", doCleanup);

    // Detect parent process death: Claude Code closes our stdin pipe when it exits
    process.stdin.on("end", () => {
      logger.info("Stdin closed (parent process died), shutting down...");
      doCleanup();
    });
  }
}

// Start server
const server = new MarionetteMCPServer();
server.run().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
