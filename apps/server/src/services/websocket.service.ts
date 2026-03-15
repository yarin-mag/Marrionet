import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import type { Request, Response } from "express";
import type { MarionetteEvent } from "@marionette/shared";
import { EventService } from "./event.service.js";
import { logger } from "../utils/logger.js";

type ExtendedWebSocket = WebSocket & { isAlive?: boolean };

interface WsIncomingMessage {
  type: string;
  agent_id?: string;
}

export class WebSocketService {
  private httpServer: Server;
  private wss: WebSocketServer;
  private eventService: EventService;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sseClients: Map<Response, ReturnType<typeof setInterval>> = new Map();

  constructor(httpServer: Server, eventService?: EventService) {
    this.httpServer = httpServer;
    this.eventService = eventService ?? new EventService();
    this.wss = new WebSocketServer({ noServer: true });
    this.setupUpgradeHandler();
  }

  start(): void {
    logger.info("WebSocket service started");
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    const INTERVAL_MS = 30_000;
    this.heartbeatTimer = setInterval(() => {
      this.wss.clients.forEach((client) => {
        const ws = client as ExtendedWebSocket;
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, INTERVAL_MS);
  }

  private setupUpgradeHandler(): void {
    this.httpServer.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
      try {
        const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;

        if (pathname === "/agent-stream") {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.handleAgentConnection(ws as ExtendedWebSocket);
          });
        } else {
          socket.destroy();
        }
      } catch (err) {
        logger.error("WebSocket upgrade error:", err);
        socket.write("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        socket.destroy();
      }
    });
  }

  handleSseConnection(req: Request, res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Immediately sync agent state so the dashboard doesn't miss agents that
    // connected before the SSE subscription was established.
    res.write(`data: ${JSON.stringify({ type: "agents_updated" })}\n\n`);

    const keepalive = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 30_000);

    this.sseClients.set(res, keepalive);
    logger.info("SSE dashboard client connected");

    req.on("close", () => {
      clearInterval(keepalive);
      this.sseClients.delete(res);
      logger.info("SSE dashboard client disconnected");
    });
  }

  private handleAgentConnection(ws: ExtendedWebSocket): void {
    logger.info("Agent connected");
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    let agentId: string | null = null;

    ws.on("message", async (data: Buffer) => {
      try {
        const raw: unknown = JSON.parse(data.toString());
        if (!raw || typeof raw !== "object" || typeof (raw as any).type !== "string") {
          logger.warn("[ws] ignoring message with missing or non-string 'type' field");
          return;
        }
        const event = raw as WsIncomingMessage;
        await this.processAgentEvent(event);

        if (event.agent_id && !agentId) {
          if (!/^agent_[a-f0-9]{16}$/.test(event.agent_id)) {
            logger.warn(`[ws] rejected unrecognised agent_id format: ${event.agent_id}`);
          } else {
            agentId = event.agent_id;
            logger.info(`Agent ${agentId} identified`);
          }
        }
      } catch (err) {
        logger.error("Agent WebSocket message error:", err);
      }
    });

    ws.on("close", () => {
      this.handleAgentDisconnect(agentId).catch((err) =>
        logger.error("[ws] agent disconnect handler error:", err)
      );
    });
    ws.on("error", (err: Error) => logger.error("Agent WebSocket error:", err));
  }

  private async processAgentEvent(event: WsIncomingMessage): Promise<void> {
    try {
      await this.eventService.processEvent(event as MarionetteEvent);
    } catch (err) {
      logger.error("Event processing error — event NOT broadcast:", err);
      return;
    }

    this.broadcastToDashboard({ type: "events", data: [event] });

    if (event.type === "agent.started" || event.type === "agent.disconnected") {
      this.broadcastToDashboard({ type: "agents_updated" });
    }
  }

  private async handleAgentDisconnect(agentId: string | null): Promise<void> {
    if (!agentId) return;
    logger.info(`Agent WebSocket ${agentId} closed (MCP connection dropped)`);
  }

  broadcastToDashboard(data: unknown): void {
    let msg: string;
    try {
      msg = JSON.stringify(data);
    } catch (err) {
      logger.error("Failed to serialize broadcast message — skipping:", err);
      return;
    }
    this.sseClients.forEach((_keepalive, res) => {
      try {
        res.write(`data: ${msg}\n\n`);
      } catch (err) {
        logger.error("Failed to send SSE message to dashboard client:", err);
      }
    });
  }

  getServer(): WebSocketServer {
    return this.wss;
  }

  close(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.sseClients.forEach((keepalive, res) => {
      clearInterval(keepalive);
      try { res.end(); } catch {}
    });
    this.sseClients.clear();
    this.wss.close();
    logger.info("WebSocket service closed");
  }
}
