/**
 * Interface for message capture components
 */

import { MessageSource } from '../types/messages.js';

export interface IMessageCapture {
  /**
   * Capture a user message
   */
  captureUser(content: string, source: MessageSource): void;

  /**
   * Capture a Claude message
   */
  captureClaude(content: string): void;

  /**
   * Flush any pending messages
   */
  flush(): void;
}
