/**
 * Interface for event emission
 */

import { AgentEvent } from '../types/events.js';

export interface IEventSender {
  /**
   * Send an event to the backend
   */
  send(event: AgentEvent): void;

  /**
   * Check if connected and ready to send events
   */
  canSend(): boolean;
}
