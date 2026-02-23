import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Jira ticket tracking service
 * Handles ticket detection and syncing to Marionette
 */
export class JiraService {
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
      // Add any additional tickets
      if (additionalTickets) {
        additionalTickets.forEach((ticket) => {
          if (this.isValidTicket(ticket)) {
            this.tickets.add(ticket);
          }
        });
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
