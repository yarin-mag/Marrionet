import { Router, Request, Response } from "express";
import type { WebSocketService } from "../services/websocket.service.js";
import { logger } from "../utils/logger.js";

export function createConversationRouter(websocketService: WebSocketService): Router {
  const router = Router();

  /**
   * GET /api/conversation/:session_id
   * Get conversation history for a session
   */
  router.get("/:session_id", async (req: Request, res: Response) => {
    try {
      const { session_id } = req.params;

      const history = websocketService.getConversation(session_id);

      res.json({
        success: true,
        session_id,
        turn_count: history.length,
        turns: history,
      });
    } catch (err) {
      logger.error("Failed to get conversation:", err);
      res.status(500).json({
        success: false,
        error: "Failed to get conversation",
      });
    }
  });

  /**
   * GET /api/conversation/agent/:agentId
   * Get conversation history for an agent (looks up session_id internally)
   */
  router.get("/agent/:agentId", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;

      const { session_id, turns } = websocketService.getConversationByAgent(agentId);

      res.json({
        success: true,
        agent_id: agentId,
        session_id,
        turn_count: turns.length,
        turns,
      });
    } catch (err) {
      logger.error("Failed to get conversation for agent:", err);
      res.status(500).json({
        success: false,
        error: "Failed to get conversation",
      });
    }
  });

  /**
   * POST /api/conversation/:agent_id/send
   * Send message to agent (alternative to WebSocket)
   */
  router.post("/:agent_id/send", async (req: Request, res: Response) => {
    try {
      const { agent_id } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({
          success: false,
          error: "Message content is required",
        });
      }

      websocketService.sendMessageToAgent(agent_id, content);

      res.json({
        success: true,
        agent_id,
        message: "Message sent to agent",
      });
    } catch (err) {
      logger.error("Failed to send message:", err);
      res.status(500).json({
        success: false,
        error: "Failed to send message",
      });
    }
  });

  return router;
}
