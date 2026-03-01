import type { JiraService } from "../services/jira.service.js";
import { SetTaskTool } from "./set-task.tool.js";

/**
 * Base tool interface
 */
interface Tool {
  getDefinition(): any;
  handle(args: any): Promise<any>;
}

/**
 * Tool registry for Marionette MCP tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool>;

  constructor(
    jiraService: JiraService,
    agentId: string,
    mcpSetTaskEnabled: boolean,
    mcpJiraEnabled: boolean
  ) {
    this.tools = new Map<string, Tool>();
    if (mcpSetTaskEnabled || mcpJiraEnabled) {
      this.tools.set(
        "marionette_set_task",
        new SetTaskTool(jiraService, agentId, mcpSetTaskEnabled, mcpJiraEnabled)
      );
    }
  }

  /**
   * Get all tool definitions
   */
  getDefinitions(): any[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Handle a tool call
   */
  async handleToolCall(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.handle(args);
  }
}
