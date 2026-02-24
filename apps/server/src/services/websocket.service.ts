import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import type { MarionetteEvent } from "@marionette/shared";
import { EventService } from "./event.service.js";
import { query } from "../db.js";
import { logger } from "../utils/logger.js";

type WsClientType = "dashboard" | "agent" | "web_client";
type ExtendedWebSocket = WebSocket & { _type?: WsClientType };

interface WsIncomingMessage {
  type: string;
  agent_id?: string;
  session_id?: string;
  message?: Record<string, unknown>;
  content?: string;
}

type ConversationTurn = Record<string, unknown>;

export class WebSocketService {
  private wss: WebSocketServer;
  private agentConnections = new Map<string, WebSocket>();
  private webClients = new Set<WebSocket>();
  private conversations = new Map<string, ConversationTurn[]>();
  private agentSessions = new Map<string, string>();
  private eventService = new EventService();

  constructor(private httpServer: Server) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupUpgradeHandler();
  }

  start(): void {
    logger.info("WebSocket service started");
  }

  private setupUpgradeHandler(): void {
    this.httpServer.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;

      if (pathname === "/stream") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleDashboardConnection(ws as ExtendedWebSocket);
        });
      } else if (pathname === "/agent-stream") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleAgentConnection(ws as ExtendedWebSocket);
        });
      } else if (pathname === "/client-stream") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleWebClientConnection(ws as ExtendedWebSocket);
        });
      } else {
        socket.destroy();
      }
    });
  }

  private handleDashboardConnection(ws: ExtendedWebSocket): void {
    logger.info("Dashboard client connected");
    ws._type = "dashboard";
    ws.send(JSON.stringify({ type: "hello", data: { ok: true } }));
  }

  private handleAgentConnection(ws: ExtendedWebSocket): void {
    logger.info("Agent wrapper connected");
    ws._type = "agent";
    let agentId: string | null = null;

    ws.on("message", async (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString()) as WsIncomingMessage;

        if (event.type === "agent.register") {
          agentId = this.registerAgent(ws, event);
        } else if (
          event.type === "conversation.turn" ||
          event.type === "conversation.started" ||
          event.type === "conversation.ended"
        ) {
          this.handleConversationEvent(event);
        } else {
          await this.processAgentEvent(event);
        }

        if (event.agent_id && !agentId) {
          agentId = event.agent_id;
          this.agentConnections.set(agentId, ws);
          logger.info(`Agent ${agentId} identified`);
        }
      } catch (err) {
        logger.error("Agent WebSocket message error:", err);
      }
    });

    ws.on("close", async () => this.handleAgentDisconnect(agentId));
    ws.on("error", (err: Error) => logger.error("Agent WebSocket error:", err));
  }

  private registerAgent(ws: ExtendedWebSocket, event: WsIncomingMessage): string | null {
    const agentId = event.agent_id ?? null;
    const sessionId = event.session_id ?? null;

    if (agentId) {
      this.agentConnections.set(agentId, ws);
      logger.info(`Agent ${agentId} registered (session: ${sessionId})`);
    }
    if (sessionId) this.conversations.set(sessionId, []);
    if (agentId && sessionId) this.agentSessions.set(agentId, sessionId);

    return agentId;
  }

  private handleConversationEvent(event: WsIncomingMessage): void {
    if (event.type === "conversation.turn" && event.message) {
      this.storeConversationTurn(event.session_id!, event.message);
    }
    this.broadcastToWebClients(event as unknown);
  }

  private async processAgentEvent(event: WsIncomingMessage): Promise<void> {
    await this.eventService.processEvent(event as MarionetteEvent);
    this.broadcastToDashboard({ type: "events", data: [event] });

    if (event.type === "agent.started" || event.type === "agent.disconnected") {
      this.broadcastToDashboard({ type: "agents_updated" });
    }
  }

  private async handleAgentDisconnect(agentId: string | null): Promise<void> {
    if (!agentId) return;

    logger.info(`Agent ${agentId} disconnected`);
    this.agentConnections.delete(agentId);

    await query(
      "UPDATE agents SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP WHERE agent_id = $1",
      [agentId]
    );

    this.broadcastToDashboard({ type: "agents_updated" });
  }

  broadcastToDashboard(data: unknown): void {
    const msg = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      const extended = client as ExtendedWebSocket;
      if (extended._type === "dashboard" && client.readyState === 1) {
        client.send(msg);
      }
    });
  }

  private handleWebClientConnection(ws: ExtendedWebSocket): void {
    logger.info("Web client connected");
    ws._type = "web_client";
    this.webClients.add(ws);

    ws.send(JSON.stringify({
      type: "connected",
      timestamp: new Date().toISOString(),
    }));

    ws.on("message", async (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString()) as WsIncomingMessage;

        if (event.type === "message.send" && event.agent_id && event.content) {
          this.sendMessageToAgent(event.agent_id, event.content);
        }

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

    ws.on("error", (err: Error) => logger.error("Web client WebSocket error:", err));
  }

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

  broadcastToWebClients(event: unknown): void {
    const message = JSON.stringify(event);
    this.webClients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  storeConversationTurn(sessionId: string, turn: ConversationTurn): void {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    this.conversations.get(sessionId)!.push(turn);
    logger.debug(`Stored conversation turn for session ${sessionId}`);
  }

  getConversation(sessionId: string): ConversationTurn[] {
    return this.conversations.get(sessionId) || [];
  }

  getSessionIdForAgent(agentId: string): string | undefined {
    return this.agentSessions.get(agentId);
  }

  getConversationByAgent(agentId: string): { session_id: string | null; turns: ConversationTurn[] } {
    const sessionId = this.agentSessions.get(agentId);
    if (!sessionId) return { session_id: null, turns: [] };
    return { session_id: sessionId, turns: this.conversations.get(sessionId) || [] };
  }

  notifyAgent(agentId: string, message: { id: string }): void {
    const ws = this.agentConnections.get(agentId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "message.notification",
        agent_id: agentId,
        message_id: message.id,
      }));
      logger.debug(`Notified agent ${agentId} of new message ${message.id}`);
    }
  }

  broadcastMessage(message: unknown): void {
    this.broadcastToDashboard({
      type: "agent.message",
      data: message,
    });
  }

  getServer(): WebSocketServer {
    return this.wss;
  }

  close(): void {
    this.wss.close();
    logger.info("WebSocket service closed");
  }
}
