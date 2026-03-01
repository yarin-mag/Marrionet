import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Jira ticket tracking service
 * Handles ticket detection and syncing to Marionette
 */
export class JiraService {
  /** Hard cap to prevent unbounded memory growth over long MCP server lifetimes */
  private static readonly MAX_TICKETS = 500;
  private tickets = new Set<string>();

  constructor(private agentId: string) {}

  /**
   * Extract Jira tickets from text (e.g., "CEM-24729", "PROJ-123")
   */
  extractTicketsFromText(text: string): string[] {
    const matches = text.match(config.jira.ticketPattern);
    return matches ? Array.from(new Set(matches)) : [];
  }

  /**
   * Validate Jira ticket format
   */
  isValidTicket(ticketId: string): boolean {
    return config.jira.ticketFormat.test(ticketId);
  }

  /**
   * Add a ticket to tracking
   */
  addTicket(ticketId: string): boolean {
    if (!this.isValidTicket(ticketId)) {
      logger.warn(`Invalid Jira ticket format: ${ticketId}`);
      return false;
    }

    if (this.tickets.size >= JiraService.MAX_TICKETS) {
      logger.warn(`Jira ticket limit (${JiraService.MAX_TICKETS}) reached; ticket not added: ${ticketId}`);
      return false;
    }

    this.tickets.add(ticketId);
    logger.info(`Tracking Jira ticket: ${ticketId}`);
    return true;
  }

  /**
   * Get all tracked tickets
   */
  getTickets(): string[] {
    return Array.from(this.tickets);
  }

  /**
   * Sync tickets to Marionette server
   */
  async syncTickets(additionalTickets?: string[]): Promise<void> {
    try {
      // Add any additional tickets (respecting the size cap)
      if (additionalTickets) {
        for (const ticket of additionalTickets) {
          if (this.isValidTicket(ticket) && this.tickets.size < JiraService.MAX_TICKETS) {
            this.tickets.add(ticket);
          }
        }
      }

      const tickets = Array.from(this.tickets);
      if (tickets.length === 0) {
        return;
      }

      const response = await fetch(
        `${config.apiUrl}/api/agents/${this.agentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jira_tickets: tickets }),
        }
      );

      if (!response.ok) {
        logger.error("Failed to sync Jira tickets:", response.statusText);
      }
    } catch (err) {
      logger.error("Failed to sync Jira tickets:", err);
    }
  }
}
