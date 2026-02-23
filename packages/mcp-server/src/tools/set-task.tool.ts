import type { EventEmitterService } from "../services/event-emitter.service.js";
import type { JiraService } from "../services/jira.service.js";

/**
 * Set task tool handler
 */
export class SetTaskTool {
  constructor(
    private eventEmitter: EventEmitterService,
    private jiraService: JiraService,
    private agentMetadata: any
  ) {}

  /**
   * Get tool definition for MCP
   */
  getDefinition() {
    return {
      name: "marionette_set_task",
      description:
        "Set the current task name for this agent. **IMPORTANT: Call this tool AUTOMATICALLY at the start of each new conversation or task.** Use a brief, meaningful description like 'Bug Investigation: CEM-24729', 'Feature: User authentication', or 'Refactor: Database queries'. This tracks your work in the Marionette monitoring dashboard.",
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

    // Generate task ID
    const taskId = `task_${Date.now()}`;

    // Update agent metadata name
    this.agentMetadata.name = taskName;

    // Auto-detect Jira tickets
    const tickets = this.jiraService.extractTicketsFromText(taskName);
    if (tickets.length > 0) {
      tickets.forEach((ticket) => this.jiraService.addTicket(ticket));
      await this.jiraService.syncTickets();
    }

    // Start task
    this.eventEmitter.startTask(taskId, taskName);

    return {
      content: [{ type: "text", text: `Task set to: ${taskName}` }],
    };
  }
}
