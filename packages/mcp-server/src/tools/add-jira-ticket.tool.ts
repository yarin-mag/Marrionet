import type { JiraService } from "../services/jira.service.js";

/**
 * Add Jira ticket tool handler
 */
export class AddJiraTicketTool {
  constructor(private jiraService: JiraService) {}

  /**
   * Get tool definition for MCP
   */
  getDefinition() {
    return {
      name: "marionette_add_jira_ticket",
      description:
        "Register a Jira ticket that you're working on. Call this when you start working on a Jira ticket (e.g., 'CEM-24729', 'PROJ-123'). The ticket will be tracked in your agent's metadata and displayed in the dashboard.",
      inputSchema: {
        type: "object",
        properties: {
          ticket_id: {
            type: "string",
            description: "The Jira ticket ID (e.g., 'CEM-24729', 'PROJ-123')",
          },
          ticket_summary: {
            type: "string",
            description: "Optional: Brief description of the ticket",
          },
        },
        required: ["ticket_id"],
      },
    };
  }

  /**
   * Handle tool call
   */
  async handle(args: any): Promise<any> {
    const ticketId = args.ticket_id as string;
    const ticketSummary = args.ticket_summary as string | undefined;

    // Validate and add ticket
    if (!this.jiraService.isValidTicket(ticketId)) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid Jira ticket format: ${ticketId}. Expected format: PROJECT-123`,
          },
        ],
      };
    }

    this.jiraService.addTicket(ticketId);

    // Sync to server
    await this.jiraService.syncTickets();

    return {
      content: [
        {
          type: "text",
          text: `Now tracking Jira ticket: ${ticketId}${
            ticketSummary ? ` (${ticketSummary})` : ""
          }`,
        },
      ],
    };
  }
}
