/**
 * ID generation utilities
 */

import { randomBytes } from 'crypto';

export class IdGenerator {
  /**
   * Generate a unique ID with a given prefix
   */
  static generate(prefix: string): string {
    return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate an agent ID
   */
  static generateAgentId(): string {
    return this.generate('agent');
  }

  /**
   * Generate a session ID
   */
  static generateSessionId(): string {
    return this.generate('session');
  }

  /**
   * Generate a message ID
   */
  static generateMessageId(): string {
    return this.generate('msg');
  }
}
