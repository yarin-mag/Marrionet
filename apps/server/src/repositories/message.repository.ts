import { BaseRepository } from "./base.repository.js";
import type { Message, MessageStatus, MessageDirection, MessageType } from "@marionette/shared";

/**
 * Database row type for messages table
 */
interface MessageRow {
  id: string;
  agent_id: string;
  direction: MessageDirection;
  message_type: MessageType;
  content: string;
  status: MessageStatus;
  created_at: Date;
  delivered_at?: Date;
  processed_at?: Date;
  completed_at?: Date;
  metadata?: any;
  parent_message_id?: string;
}

/**
 * Insert message type (without generated fields)
 */
export interface InsertMessage {
  agentId: string;
  direction: MessageDirection;
  messageType: MessageType;
  content: string;
  status?: MessageStatus;
  metadata?: any;
  parentMessageId?: string;
}

/**
 * Repository for managing agent messages
 */
export class MessageRepository extends BaseRepository {
  /**
   * Convert database row to Message object
   */
  private rowToMessage(row: MessageRow): Message {
    return {
      id: row.id.toString(),
      agentId: row.agent_id,
      direction: row.direction,
      messageType: row.message_type,
      content: row.content,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      deliveredAt: row.delivered_at?.toISOString(),
      processedAt: row.processed_at?.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      metadata: this.safeParse(row.metadata),
      parentMessageId: row.parent_message_id?.toString(),
    };
  }

  /**
   * Create a new message
   */
  async create(message: InsertMessage): Promise<Message> {
    const row = await this.queryOne<MessageRow>(
      `INSERT INTO messages (
        agent_id, direction, message_type, content, status, metadata, parent_message_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        message.agentId,
        message.direction,
        message.messageType,
        message.content,
        message.status || 'pending',
        this.safeStringify(message.metadata),
        message.parentMessageId || null,
      ]
    );

    if (!row) {
      throw new Error('Failed to create message');
    }

    return this.rowToMessage(row);
  }

  /**
   * Get pending messages for an agent (for polling)
   */
  async getPending(agentId: string, limit: number = 10): Promise<Message[]> {
    const rows = await this.query<MessageRow>(
      `SELECT * FROM messages
       WHERE agent_id = $1
         AND direction = 'to_agent'
         AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT $2`,
      [agentId, limit]
    );

    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Update message status and metadata
   */
  async updateStatus(
    id: string,
    status: MessageStatus,
    metadata?: any
  ): Promise<void> {
    const timestampField = this.getTimestampField(status);
    const updates = ['status = $2'];
    const params: any[] = [id, status];
    let paramIndex = 3;

    if (timestampField) {
      updates.push(`${timestampField} = CURRENT_TIMESTAMP`);
    }

    if (metadata) {
      // SQLite: Use json_patch for merging JSON, or just replace
      updates.push(`metadata = json_patch(COALESCE(metadata, '{}'), $${paramIndex})`);
      params.push(this.safeStringify(metadata));
      paramIndex++;
    }

    await this.query(
      `UPDATE messages
       SET ${updates.join(', ')}
       WHERE id = $1`,
      params
    );
  }

  /**
   * Get timestamp field name based on status
   */
  private getTimestampField(status: MessageStatus): string | null {
    switch (status) {
      case 'delivered':
        return 'delivered_at';
      case 'processing':
        return 'processed_at';
      case 'completed':
      case 'failed':
        return 'completed_at';
      default:
        return null;
    }
  }

  /**
   * Get message history for an agent
   */
  async getHistory(
    agentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    const rows = await this.query<MessageRow>(
      `SELECT * FROM messages
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );

    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Get message by ID
   */
  async getById(id: string): Promise<Message | null> {
    const row = await this.queryOne<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [id]
    );

    return row ? this.rowToMessage(row) : null;
  }

  /**
   * Get responses to a message (by parent_message_id)
   */
  async getByParent(parentId: string): Promise<Message[]> {
    const rows = await this.query<MessageRow>(
      `SELECT * FROM messages
       WHERE parent_message_id = $1
       ORDER BY created_at ASC`,
      [parentId]
    );

    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Mark messages as delivered (batch operation)
   */
  async markAsDelivered(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    // SQLite: Use IN with placeholders instead of ANY
    const placeholders = messageIds.map(() => '?').join(', ');
    await this.query(
      `UPDATE messages
       SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})
         AND status = 'pending'`,
      messageIds
    );
  }

  /**
   * Clean up old messages (for maintenance)
   */
  async cleanOld(olderThanDays: number): Promise<number> {
    const result = await this.query(
      `DELETE FROM messages
       WHERE created_at < datetime('now', '-${olderThanDays} days')
       RETURNING id`
    );

    return result.length;
  }

  /**
   * Get unread count for agent (pending + delivered to_agent messages)
   */
  async getUnreadCount(agentId: string): Promise<number> {
    const result = await this.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM messages
       WHERE agent_id = $1
         AND direction = 'to_agent'
         AND status IN ('pending', 'delivered')`,
      [agentId]
    );

    return parseInt(result?.count || '0');
  }
}
