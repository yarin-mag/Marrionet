#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebSocketService } from "./services/websocket.service.js";
import { JiraService } from "./services/jira.service.js";
import { EventEmitterService } from "./services/event-emitter.service.js";
import { ToolRegistry } from "./tools/index.js";
import { createAgentIdentity } from "./utils/agent-ids.js";
import { logger } from "./utils/logger.js";
import { config } from "./config/index.js";

/**
 * Marionette MCP Server
 * Refactored with clean separation of concerns
 */
class MarionetteMCPServer {
  private server: Server;
  private agentId: string;
  private runId: string;
  private agentMetadata: any;
  private wsService: WebSocketService;
  private jiraService: JiraService;
  private eventEmitter: EventEmitterService;
  private toolRegistry: ToolRegistry;

  constructor() {
    // Create agent identity
    const identity = createAgentIdentity();
    this.agentId = identity.agentId;
    this.runId = identity.runId;
    this.agentMetadata = identity.metadata;

    // Initialize services
    this.wsService = new WebSocketService(
      this.agentId,
      this.runId,
      this.agentMetadata
    );
    this.jiraService = new JiraService(this.agentId);
    this.eventEmitter = new EventEmitterService(this.agentId, this.wsService);

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry(
      this.eventEmitter,
      this.jiraService,
      this.agentMetadata,
      this.agentId
    );

    // Create MCP server
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
      const { name, arguments: args } = request.params as any;
      return this.toolRegistry.handleToolCall(name, args);
    });
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    // Connect to Marionette via WebSocket
    // Wrapper now sends agent.started event
    this.wsService.connect();

    // Connect MCP transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info("MCP server running");
    logger.info(`Agent ID: ${this.agentId}`);
    logger.info(`WebSocket URL: ${config.wsUrl}`);

    // Setup cleanup on exit
    this.setupCleanup();
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanup(): void {
    process.on("SIGINT", () => {
      logger.info("Shutting down...");

      // Wrapper sends agent.disconnected event
      // Just close WebSocket
      this.wsService.close();

      process.exit(0);
    });
  }
}

// Start server
const server = new MarionetteMCPServer();
server.run().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
