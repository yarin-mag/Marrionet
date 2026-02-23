import type { Request, Response } from "express";
import type { MarionetteEvent } from "@marionette/shared";
import { EventService } from "../services/event.service.js";
import { config } from "../config/index.js";

/**
 * Controller for event-related endpoints
 */
export class EventsController {
  private service = new EventService();
  private wsService: any; // WebSocketService instance (set after initialization)

  /**
   * Set WebSocket service for broadcasting
   */
  setWebSocketService(wsService: any): void {
    this.wsService = wsService;
  }

  /**
   * GET /api/events - Query events (by run_id, agent_id, type)
   */
  async getEvents(req: Request, res: Response) {
    const runId = req.query.run_id?.toString();
    const agentId = req.query.agent_id?.toString();
    const type = req.query.type?.toString();
    const limit = Math.min(
      Number(req.query.limit ?? config.api.defaultEventsLimit),
      config.api.maxEventsLimit
    );

    const events = await this.service.queryEvents({
      runId,
      agentId,
      type,
      limit,
    });

    res.json(events.reverse());
  }

  /**
   * GET /api/agents/:agentId/events - Get agent's event stream
   */
  async getAgentEvents(req: Request, res: Response) {
    const limit = Math.min(
      Number(req.query.limit ?? config.api.defaultEventsLimit),
      config.api.maxEventsLimit
    );

    const events = await this.service.getEventsByAgentId(req.params.agentId, limit);
    res.json(events.reverse());
  }

  /**
   * POST /api/events - Ingest telemetry events
   */
  async ingestEvents(req: Request, res: Response) {
    const body = req.body;
    const batch: MarionetteEvent[] = Array.isArray(body) ? body : [body];

    const processed = await this.service.processBatch(batch);

    // Broadcast events to dashboard
    if (this.wsService && processed.length > 0) {
      this.wsService.broadcastToDashboard({
        type: "events",
        data: processed,
      });
    }

    res.json({ ok: true, received: processed.length });
  }
}
