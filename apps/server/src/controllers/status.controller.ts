import type { Request, Response } from "express";
import { AgentService } from "../services/agent.service.js";

/**
 * Controller for system status endpoints
 */
export class StatusController {
  private service = new AgentService();

  /**
   * GET /health - Health check
   */
  async healthCheck(req: Request, res: Response) {
    res.json({ ok: true });
  }

  /**
   * GET /api/status - Live system status
   */
  async getStatus(req: Request, res: Response) {
    const agents = await this.service.getAgents();

    const working = agents.filter((a) => a.status === "working").length;
    const idle = agents.filter((a) => a.status === "idle").length;
    const blocked = agents.filter((a) => a.status === "blocked").length;
    const errors = agents.filter((a) => a.status === "error").length;
    const crashed = agents.filter((a) => a.status === "crashed").length;

    res.json({
      total_agents: agents.length,
      working,
      idle,
      blocked,
      errors,
      crashed,
      needs_attention: errors + crashed + blocked,
    });
  }
}
