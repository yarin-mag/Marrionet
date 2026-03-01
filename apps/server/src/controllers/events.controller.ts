import type { Request, Response } from "express";
import type { MarionetteEvent } from "@marionette/shared";
import type { WebSocketService } from "../services/websocket.service.js";
import { EventService } from "../services/event.service.js";
import { config } from "../config/index.js";

export class EventsController {
  private service: EventService;
  private wsService: WebSocketService | undefined;

  constructor(eventService?: EventService) {
    this.service = eventService ?? new EventService();
  }

  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  async getEvents(req: Request, res: Response) {
    const runId = req.query.run_id?.toString();
    const agentId = req.query.agent_id?.toString();
    const type = req.query.type?.toString();
    const rawLimit = parseInt(String(req.query.limit ?? ""), 10);
    const limit = Math.min(
      Number.isNaN(rawLimit) || rawLimit <= 0 ? config.api.defaultEventsLimit : rawLimit,
      config.api.maxEventsLimit
    );

    const events = await this.service.queryEvents({ runId, agentId, type, limit });
    res.json(events.reverse());
  }

  async getAgentEvents(req: Request, res: Response) {
    const rawLimit = parseInt(String(req.query.limit ?? ""), 10);
    const limit = Math.min(
      Number.isNaN(rawLimit) || rawLimit <= 0 ? config.api.defaultEventsLimit : rawLimit,
      config.api.maxEventsLimit
    );

    const events = await this.service.getEventsByAgentId(req.params.agentId, limit);
    res.json(events.reverse());
  }

  private static readonly AGENT_STATE_EVENTS = new Set([
    'run.started','run.ended','agent.started','agent.disconnected',
    'agent.status','log.error','task.started','task.ended',
    'llm.call',
  ]);

  async ingestEvents(req: Request, res: Response) {
    const body = req.body;
    const batch: MarionetteEvent[] = Array.isArray(body) ? body : [body];

    const MAX_BATCH = 1000;
    if (batch.length > MAX_BATCH) {
      res.status(413).json({ error: `Batch too large: ${batch.length} (max ${MAX_BATCH})` });
      return;
    }

    const { processed, failed } = await this.service.processBatch(batch);

    if (this.wsService && processed.length > 0) {
      this.wsService.broadcastToDashboard({ type: "events", data: processed });
      if (processed.some(e => EventsController.AGENT_STATE_EVENTS.has(e.type))) {
        this.wsService.broadcastToDashboard({ type: "agents_updated" });
      }
    }

    res.json({
      received: batch.length,
      processed: processed.length,
      failed: failed.length,
      ...(failed.length > 0 && {
        errors: failed.map((f) => ({ type: f.event.type, run_id: f.event.run_id, error: f.error })),
      }),
    });
  }
}
