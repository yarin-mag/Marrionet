import { Router, Request, Response } from "express";
import { MessageService } from "../services/message.service.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { logger } from "../utils/logger.js";

/**
 * Create messages router with dependency injection
 */
export function createMessagesRouter(messageService: MessageService): Router {
  const router = Router();

  /**
   * POST /api/agents/:agentId/messages
   * Send a message to an agent
   */
  router.post(
    "/agents/:agentId/messages",
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId } = req.params;
      const { content, userId } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          error: 'Content is required and must be a string'
        });
      }

      const message = await messageService.sendToAgent(agentId, content, userId);

      res.status(201).json(message);
    })
  );

  /**
   * GET /api/agents/:agentId/messages
   * Get message history for an agent
   */
  router.get(
    "/agents/:agentId/messages",
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await messageService.getHistory(agentId, limit, offset);

      res.json({
        messages,
        pagination: {
          limit,
          offset,
          total: messages.length
        }
      });
    })
  );

  /**
   * GET /api/agents/:agentId/messages/pending
   * Get pending messages for an agent (used by agent polling)
   */
  router.get(
    "/agents/:agentId/messages/pending",
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const messages = await messageService.getMessagesForAgent(agentId, limit);

      res.json(messages);
    })
  );

  /**
   * POST /api/agents/:agentId/messages/:messageId/delivered
   * Mark message as delivered
   */
  router.post(
    "/agents/:agentId/messages/:messageId/delivered",
    asyncHandler(async (req: Request, res: Response) => {
      const { messageId } = req.params;

      await messageService.updateMessageStatus(messageId, 'delivered');

      res.json({ success: true });
    })
  );

  /**
   * POST /api/agents/:agentId/messages/:messageId/processing
   * Mark message as processing
   */
  router.post(
    "/agents/:agentId/messages/:messageId/processing",
    asyncHandler(async (req: Request, res: Response) => {
      const { messageId } = req.params;

      await messageService.updateMessageStatus(messageId, 'processing');

      res.json({ success: true });
    })
  );

  /**
   * POST /api/agents/:agentId/messages/:messageId/response
   * Agent sends response to a message
   */
  router.post(
    "/agents/:agentId/messages/:messageId/response",
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId, messageId } = req.params;
      const { content, metadata } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          error: 'Content is required and must be a string'
        });
      }

      const response = await messageService.respondToMessage(
        agentId,
        messageId,
        content,
        metadata
      );

      res.status(201).json(response);
    })
  );

  /**
   * POST /api/agents/:agentId/commands
   * Execute a slash command
   */
  router.post(
    "/agents/:agentId/commands",
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId } = req.params;
      const { command, args } = req.body;

      if (!command || typeof command !== 'string') {
        return res.status(400).json({
          error: 'Command is required and must be a string'
        });
      }

      const result = await messageService.executeCommand(agentId, command, args);

      res.json(result);
    })
  );

  /**
   * GET /api/agents/:agentId/unread-count
   * Get unread message count
   */
  router.get(
    "/agents/:agentId/unread-count",
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId } = req.params;

      const count = await messageService.getUnreadCount(agentId);

      res.json({ count });
    })
  );

  /**
   * GET /api/messages/:messageId
   * Get a specific message by ID
   */
  router.get(
    "/messages/:messageId",
    asyncHandler(async (req: Request, res: Response) => {
      const { messageId } = req.params;

      const message = await messageService.getMessage(messageId);

      if (!message) {
        return res.status(404).json({
          error: 'Message not found'
        });
      }

      res.json(message);
    })
  );

  return router;
}
