/**
 * Message buffer for capturing and batching conversation turns
 */

import { EventEmitter } from '../websocket/EventEmitter.js';
import { MessageAccumulator } from './MessageAccumulator.js';
import { AnsiStripper } from './AnsiStripper.js';
import { Message, MessageSource } from '../types/messages.js';
import { IdGenerator } from '../core/IdGenerator.js';
import { IMessageCapture } from '../interfaces/IMessageCapture.js';

export class MessageBuffer implements IMessageCapture {
  private userAccumulator: MessageAccumulator;
  private claudeAccumulator: MessageAccumulator;
  private messages: Message[] = [];

  constructor(
    private eventEmitter: EventEmitter,
    private agentId: string,
    private sessionId: string,
    timeoutMs: number = 500
  ) {
    this.userAccumulator = new MessageAccumulator(
      timeoutMs,
      (content) => this.handleUserMessage(content, 'terminal')
    );

    this.claudeAccumulator = new MessageAccumulator(
      timeoutMs,
      (content) => this.handleClaudeMessage(content)
    );
  }

  /**
   * Capture a user message
   */
  captureUser(content: string, source: MessageSource): void {
    if (source === 'web') {
      // Web messages are already complete, emit immediately
      this.handleUserMessage(content, source);
    } else {
      // Terminal input accumulates line by line
      this.userAccumulator.accumulate(content);
    }
  }

  /**
   * Capture a Claude message
   */
  captureClaude(content: string): void {
    this.claudeAccumulator.accumulate(content);
  }

  /**
   * Flush any pending messages
   */
  flush(): void {
    this.userAccumulator.flush();
    this.claudeAccumulator.flush();
  }

  /**
   * Handle a complete user message
   */
  private handleUserMessage(
    content: string,
    source: MessageSource
  ): void {
    const message = this.createMessage(
      'to_agent',
      'user',
      content,
      source
    );
    this.messages.push(message);
    this.eventEmitter.emitConversationTurn(message);
  }

  /**
   * Handle a complete Claude message
   */
  private handleClaudeMessage(content: string): void {
    const message = this.createMessage(
      'from_agent',
      'assistant',
      content
    );
    this.messages.push(message);
    this.eventEmitter.emitConversationTurn(message);
  }

  /**
   * Create a message object
   */
  private createMessage(
    direction: 'to_agent' | 'from_agent',
    role: 'user' | 'assistant',
    content: string,
    source?: MessageSource
  ): Message {
    return {
      id: IdGenerator.generateMessageId(),
      agent_id: this.agentId,
      session_id: this.sessionId,
      direction,
      role,
      content,
      content_plain: AnsiStripper.strip(content),
      timestamp: new Date().toISOString(),
      source,
    };
  }
}
