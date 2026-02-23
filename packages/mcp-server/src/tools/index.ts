import type { EventEmitterService } from "../services/event-emitter.service.js";
import type { JiraService } from "../services/jira.service.js";
import { SetTaskTool } from "./set-task.tool.js";
import { ReportTokensTool } from "./report-tokens.tool.js";
import { AddJiraTicketTool } from "./add-jira-ticket.tool.js";

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
    eventEmitter: EventEmitterService,
    jiraService: JiraService,
    agentMetadata: any,
    agentId: string
  ) {
    // Initialize tools
    const setTaskTool = new SetTaskTool(eventEmitter, jiraService, agentMetadata);
    const reportTokensTool = new ReportTokensTool(eventEmitter);
    const addJiraTicketTool = new AddJiraTicketTool(jiraService);

    // Register tools
    // Note: Message tools removed - wrapper handles message injection via WebSocket push
    this.tools = new Map<string, Tool>();
    this.tools.set("marionette_set_task", setTaskTool);
    this.tools.set("marionette_report_tokens", reportTokensTool);
    this.tools.set("marionette_add_jira_ticket", addJiraTicketTool);
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

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}
