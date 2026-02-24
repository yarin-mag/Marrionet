import type { Request, Response } from "express";
import type { MarionetteEvent } from "@marionette/shared";
import type { WebSocketService } from "../services/websocket.service.js";
import { EventService } from "../services/event.service.js";
import { config } from "../config/index.js";

export class EventsController {
  private service = new EventService();
  private wsService: WebSocketService | undefined;

  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  async getEvents(req: Request, res: Response) {
    const runId = req.query.run_id?.toString();
    const agentId = req.query.agent_id?.toString();
    const type = req.query.type?.toString();
    const limit = Math.min(
      Number(req.query.limit ?? config.api.defaultEventsLimit),
      config.api.maxEventsLimit
    );

    const events = await this.service.queryEvents({ runId, agentId, type, limit });
    res.json(events.reverse());
  }

  async getAgentEvents(req: Request, res: Response) {
    const limit = Math.min(
      Number(req.query.limit ?? config.api.defaultEventsLimit),
      config.api.maxEventsLimit
    );

    const events = await this.service.getEventsByAgentId(req.params.agentId, limit);
    res.json(events.reverse());
  }

  async ingestEvents(req: Request, res: Response) {
    const body = req.body;
    const batch: MarionetteEvent[] = Array.isArray(body) ? body : [body];

    const processed = await this.service.processBatch(batch);

    if (this.wsService && processed.length > 0) {
      this.wsService.broadcastToDashboard({ type: "events", data: processed });
    }

    res.json({ ok: true, received: processed.length });
  }
}
