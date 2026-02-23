import type { Message } from "@marionette/shared";
import { MessageRepository } from "../repositories/message.repository.js";
import { CommandService } from "./command.service.js";
import { WebSocketService } from "./websocket.service.js";
import { logger } from "../utils/logger.js";

/**
 * Service for managing agent messaging
 */
export class MessageService {
  constructor(
    private messageRepo: MessageRepository,
    private wsService: WebSocketService,
    private commandService: CommandService
  ) {}

  /**
   * Dashboard sends message to agent
   */
  async sendToAgent(
    agentId: string,
    content: string,
    userId?: string
  ): Promise<Message> {
    // Determine if this is a command or regular message
    const isCommand = content.trim().startsWith('/');
    const messageType = isCommand ? 'command' : 'text';

    // Create message in database
    const message = await this.messageRepo.create({
      agentId,
      direction: 'to_agent',
      messageType,
      content,
      status: 'pending',
      metadata: {
        userId,
        command: isCommand ? content.split(' ')[0] : undefined
      }
    });

    logger.info(`Message sent to agent ${agentId}: ${messageType}`);

    // Notify agent via WebSocket (non-blocking hint for polling)
    this.wsService.notifyAgent(agentId, message);

    // Broadcast to dashboard clients (for real-time UI update)
    this.wsService.broadcastMessage(message);

    return message;
  }

  /**
   * Agent retrieves pending messages (polling)
   */
  async getMessagesForAgent(agentId: string, limit: number = 10): Promise<Message[]> {
    const messages = await this.messageRepo.getPending(agentId, limit);

    // Mark as delivered (agent has received them)
    if (messages.length > 0) {
      const messageIds = messages.map(m => m.id);
      await this.messageRepo.markAsDelivered(messageIds);

      logger.info(`Agent ${agentId} received ${messages.length} messages`);

      // Update messages and broadcast status change
      for (const msg of messages) {
        msg.status = 'delivered';
        msg.deliveredAt = new Date().toISOString();
        this.wsService.broadcastMessage(msg);
      }
    }

    return messages;
  }

  /**
   * Agent sends response back to dashboard
   */
  async respondToMessage(
    agentId: string,
    parentMessageId: string,
    content: string,
    metadata?: any
  ): Promise<Message> {
    // Get parent message to determine type
    const parentMessage = await this.messageRepo.getById(parentMessageId);
    if (!parentMessage) {
      throw new Error(`Parent message not found: ${parentMessageId}`);
    }

    // Create response message
    const message = await this.messageRepo.create({
      agentId,
      direction: 'from_agent',
      messageType: parentMessage.messageType === 'command' ? 'response' : 'text',
      content,
      status: 'completed',
      metadata,
      parentMessageId
    });

    // Mark parent message as completed
    await this.messageRepo.updateStatus(parentMessageId, 'completed', {
      responseMessageId: message.id
    });

    logger.info(`Agent ${agentId} responded to message ${parentMessageId}`);

    // Broadcast response to dashboard
    this.wsService.broadcastMessage(message);

    return message;
  }

  /**
   * Execute a command and return response
   */
  async executeCommand(agentId: string, command: string, args?: any): Promise<any> {
    logger.info(`Executing command ${command} for agent ${agentId}`);

    const result = await this.commandService.execute(agentId, command, args);

    return result;
  }

  /**
   * Get message history for an agent
   */
  async getHistory(
    agentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    return this.messageRepo.getHistory(agentId, limit, offset);
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string): Promise<Message | null> {
    return this.messageRepo.getById(messageId);
  }

  /**
   * Update message status (for agent processing lifecycle)
   */
  async updateMessageStatus(
    messageId: string,
    status: 'delivered' | 'processing' | 'completed' | 'failed',
    metadata?: any
  ): Promise<void> {
    await this.messageRepo.updateStatus(messageId, status, metadata);

    // Broadcast status update
    const message = await this.messageRepo.getById(messageId);
    if (message) {
      this.wsService.broadcastMessage(message);
    }
  }

  /**
   * Get unread message count for agent
   */
  async getUnreadCount(agentId: string): Promise<number> {
    return this.messageRepo.getUnreadCount(agentId);
  }

  /**
   * Clean up old messages (maintenance)
   */
  async cleanOldMessages(olderThanDays: number = 30): Promise<number> {
    const deleted = await this.messageRepo.cleanOld(olderThanDays);
    logger.info(`Cleaned up ${deleted} old messages`);
    return deleted;
  }
}
