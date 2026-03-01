import type { JiraService } from "../services/jira.service.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Set task tool handler
 */
export class SetTaskTool {
  constructor(
    private jiraService: JiraService,
    private agentId: string,
    private setTaskEnabled: boolean,
    private jiraEnabled: boolean
  ) {}

  /**
   * Get tool definition for MCP
   */
  getDefinition() {
    const features: string[] = [];
    if (this.setTaskEnabled) features.push("set the current task name");
    if (this.jiraEnabled) features.push("extract and sync Jira ticket IDs");
    const what = features.join(" and ");

    return {
      name: "marionette_set_task",
      description: `Call this tool at the start of each new task to ${what}. **IMPORTANT: Call AUTOMATICALLY at the start of each new conversation or task.** Use a brief description like 'Bug Investigation: CEM-24729', 'Feature: User authentication', or 'Refactor: Database queries'. This tracks your work in the Marionette monitoring dashboard.`,
      inputSchema: {
        type: "object",
        properties: {
          task_name: {
            type: "string",
            description: "The name or description of the current task",
          },
        },
        required: ["task_name"],
      },
    };
  }

  /**
   * Handle tool call
   */
  async handle(args: any): Promise<any> {
    const taskName = args.task_name as string;

    if (this.setTaskEnabled) {
      await fetch(`${config.apiUrl}/api/agents/${this.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_task: taskName }),
      }).catch((err) => {
        logger.warn("[set-task] Failed to update task on server (non-fatal):", err);
      });
    }

    if (this.jiraEnabled) {
      const tickets = this.jiraService.extractTicketsFromText(taskName);
      if (tickets.length > 0) {
        tickets.forEach((t) => this.jiraService.addTicket(t));
        await this.jiraService.syncTickets();
      }
    }

    return { content: [{ type: "text", text: `Task set to: ${taskName}` }] };
  }
}
