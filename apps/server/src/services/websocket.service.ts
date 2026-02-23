import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import type { MarionetteEvent } from "@marionette/shared";
import { EventService } from "./event.service.js";
import { query } from "../db.js";
import { logger } from "../utils/logger.js";

/**
 * Service class for WebSocket connection management
 * Handles both dashboard and agent connections
 */
export class WebSocketService {
  private wss: WebSocketServer;
  private agentConnections = new Map<string, WebSocket>(); // agent_id -> wrapper WebSocket
  private webClients = new Set<WebSocket>(); // All web UI clients
  private conversations = new Map<string, any[]>(); // session_id -> conversation turns
  private agentSessions = new Map<string, string>(); // agent_id -> session_id
  private eventService = new EventService();

  constructor(private httpServer: Server) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupUpgradeHandler();
  }

  /**
   * Start the WebSocket service
   */
  start(): void {
    logger.info("WebSocket service started");
  }

  /**
   * Setup HTTP upgrade handler for WebSocket connections
   */
  private setupUpgradeHandler(): void {
    this.httpServer.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;

      if (pathname === "/stream") {
        this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          this.handleDashboardConnection(ws);
        });
      } else if (pathname === "/agent-stream") {
        this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          this.handleAgentConnection(ws);
        });
      } else if (pathname === "/client-stream") {
        this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          this.handleWebClientConnection(ws);
        });
      } else {
        socket.destroy();
      }
    });
  }

  /**
   * Handle dashboard WebSocket connections
   */
  private handleDashboardConnection(ws: WebSocket): void {
    logger.info("Dashboard client connected");
    (ws as any)._type = "dashboard";
    ws.send(JSON.stringify({ type: "hello", data: { ok: true } }));
  }

  /**
   * Handle agent WebSocket connections (from wrapper)
   */
  private handleAgentConnection(ws: WebSocket): void {
    logger.info("Agent wrapper connected");
    (ws as any)._type = "agent";
    let agentId: string | null = null;
    let sessionId: string | null = null;

    ws.on("message", async (data: Buffer) => {
      try {
        const event: any = JSON.parse(data.toString());

        // Handle agent registration
        if (event.type === "agent.register") {
          agentId = event.agent_id;
          sessionId = event.session_id;
          if (agentId) {
            this.agentConnections.set(agentId, ws);
            logger.info(`Agent ${agentId} registered (session: ${sessionId})`);
          }

          // Initialize conversation storage and agent→session mapping
          if (sessionId) {
            this.conversations.set(sessionId, []);
          }
          if (agentId && sessionId) {
            this.agentSessions.set(agentId, sessionId);
          }
        }

        // Handle conversation events
        if (event.type === "conversation.turn" && event.message) {
          this.storeConversationTurn(event.session_id, event.message);

          // Broadcast to web clients
          this.broadcastToWebClients(event);
        }

        if (event.type === "conversation.started" || event.type === "conversation.ended") {
          // Broadcast conversation lifecycle events
          this.broadcastToWebClients(event);
        }

        // Track agent connection for regular events
        if (event.agent_id && !agentId) {
          agentId = event.agent_id;
          if (agentId) {
            this.agentConnections.set(agentId, ws);
            logger.info(`Agent ${agentId} identified`);
          }
        }

        // Process regular Marionette events
        if (event.type !== "conversation.turn" && event.type !== "conversation.started" && event.type !== "conversation.ended" && event.type !== "agent.register") {
          await this.eventService.processEvent(event as MarionetteEvent);

          // Broadcast to dashboard clients
          this.broadcastToDashboard({
            type: "events",
            data: [event],
          });

          // Agent lifecycle events need a dedicated agents_updated signal so the
          // dashboard agent list refreshes in real-time (it only listens for this type).
          if (event.type === "agent.started" || event.type === "agent.disconnected") {
            this.broadcastToDashboard({ type: "agents_updated" });
          }
        }
      } catch (err) {
        logger.error("Agent WebSocket message error:", err);
      }
    });

    ws.on("close", async () => {
      if (agentId) {
        logger.info(`Agent ${agentId} disconnected`);
        this.agentConnections.delete(agentId);

        // Mark agent as disconnected (process exited; preserved in history)
        await query(
          "UPDATE agents SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP WHERE agent_id = $1",
          [agentId]
        );

        // Notify dashboard clients
        this.broadcastToDashboard({ type: "agents_updated" });
      }
    });

    ws.on("error", (err: Error) => {
      logger.error("Agent WebSocket error:", err);
    });
  }

  /**
   * Broadcast message to all dashboard clients
   */
  broadcastToDashboard(data: any): void {
    const msg = JSON.stringify(data);
    this.wss.clients.forEach((client: WebSocket) => {
      const clientAny = client as any;
      if (clientAny._type === "dashboard" && client.readyState === 1) {
        client.send(msg);
      }
    });
  }

  /**
   * Handle web client connections (from web UI)
   */
  private handleWebClientConnection(ws: WebSocket): void {
    logger.info("Web client connected");
    (ws as any)._type = "web_client";
    this.webClients.add(ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: "connected",
      timestamp: new Date().toISOString(),
    }));

    ws.on("message", async (data: Buffer) => {
      try {
        const event: any = JSON.parse(data.toString());

        // Web client wants to send message to agent
        if (event.type === "message.send" && event.agent_id && event.content) {
          this.sendMessageToAgent(event.agent_id, event.content);
        }

        // Web client requesting conversation history
        if (event.type === "conversation.request" && event.session_id) {
          const history = this.getConversation(event.session_id);
          ws.send(JSON.stringify({
            type: "conversation.history",
            session_id: event.session_id,
            turns: history,
          }));
        }
      } catch (err) {
        logger.error("Web client WebSocket message error:", err);
      }
    });

    ws.on("close", () => {
      logger.info("Web client disconnected");
      this.webClients.delete(ws);
    });

    ws.on("error", (err: Error) => {
      logger.error("Web client WebSocket error:", err);
    });
  }

  /**
   * Send message from web UI to agent
   */
  sendMessageToAgent(agentId: string, content: string): void {
    const ws = this.agentConnections.get(agentId);

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "message.send",
        agent_id: agentId,
        content,
      }));
      logger.info(`Sent message to agent ${agentId}`);
    } else {
      logger.error(`Agent ${agentId} not connected or not ready`);
    }
  }

  /**
   * Broadcast to all web clients
   */
  broadcastToWebClients(event: any): void {
    const message = JSON.stringify(event);
    this.webClients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  /**
   * Store conversation turn in memory
   */
  storeConversationTurn(sessionId: string, turn: any): void {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    this.conversations.get(sessionId)!.push(turn);
    logger.debug(`Stored conversation turn for session ${sessionId}`);
  }

  /**
   * Get conversation history
   */
  getConversation(sessionId: string): any[] {
    return this.conversations.get(sessionId) || [];
  }

  /**
   * Get session_id for a given agent_id
   */
  getSessionIdForAgent(agentId: string): string | undefined {
    return this.agentSessions.get(agentId);
  }

  /**
   * Get full conversation for an agent (looks up session_id internally)
   */
  getConversationByAgent(agentId: string): { session_id: string | null; turns: any[] } {
    const sessionId = this.agentSessions.get(agentId);
    if (!sessionId) return { session_id: null, turns: [] };
    return { session_id: sessionId, turns: this.conversations.get(sessionId) || [] };
  }

  /**
   * Notify specific agent of new message (hint for polling)
   */
  notifyAgent(agentId: string, message: any): void {
    const ws = this.agentConnections.get(agentId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'message.notification',
        agent_id: agentId,
        message_id: message.id
      }));
      logger.debug(`Notified agent ${agentId} of new message ${message.id}`);
    }
  }

  /**
   * Broadcast message to all dashboard clients
   */
  broadcastMessage(message: any): void {
    this.broadcastToDashboard({
      type: 'agent.message',
      data: message
    });
  }

  /**
   * Get WebSocket server instance
   */
  getServer(): WebSocketServer {
    return this.wss;
  }

  /**
   * Close all connections
   */
  close(): void {
    this.wss.close();
    logger.info("WebSocket service closed");
  }
}
