import type { Request, Response } from "express";
import { AgentService } from "../services/agent.service.js";
import { AgentMatcher } from "../strategies/agent-matcher.strategy.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Controller for agent-related endpoints
 */
export class AgentsController {
  private service = new AgentService();
  private matcher = new AgentMatcher();
  private lastHookCall = new Map<string, number>();
  private wsService: any; // WebSocketService instance (set after initialization)

  /**
   * Set WebSocket service for broadcasting
   */
  setWebSocketService(wsService: any): void {
    this.wsService = wsService;
  }

  /**
   * GET /api/agents - List all agents (with optional status filter)
   */
  async getAgents(req: Request, res: Response) {
    const statusFilter = req.query.status?.toString() as any;
    const agents = await this.service.getAgents(statusFilter);
    res.json(agents);
  }

  /**
   * GET /api/agents/:agentId - Get single agent snapshot
   */
  async getAgent(req: Request, res: Response) {
    const agent = await this.service.getAgent(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  }

  /**
   * DELETE /api/agents/crashed - Delete all crashed/idle agents
   */
  async deleteCrashed(req: Request, res: Response) {
    const count = await this.service.deleteCrashedAgents();

    // Broadcast update to dashboard
    if (this.wsService) {
      this.wsService.broadcastToDashboard({ type: "agents_updated" });
    }

    res.json({ ok: true, deleted: count });
  }

  /**
   * DELETE /api/agents/all - Delete all agents (for development cleanup)
   */
  async deleteAll(req: Request, res: Response) {
    const count = await this.service.deleteAllAgents();

    // Broadcast update to dashboard
    if (this.wsService) {
      this.wsService.broadcastToDashboard({ type: "agents_updated" });
    }

    res.json({ ok: true, deleted: count });
  }

  /**
   * PATCH /api/agents/:agentId - Update agent (custom name, labels, metadata)
   */
  async updateMetadata(req: Request, res: Response) {
    const { agentId } = req.params;
    const { custom_name, labels, jira_tickets } = req.body;

    const metadata = await this.service.updateMetadata(agentId, {
      custom_name,
      labels,
      jira_tickets,
    });

    // Broadcast update to dashboard
    if (this.wsService) {
      this.wsService.broadcastToDashboard({ type: "agents_updated" });
    }

    res.json({ ok: true, metadata });
  }

  /**
   * POST /api/agent-status - Update agent status (for hooks and wrapper)
   */
  async updateStatus(req: Request, res: Response) {
    const {
      agent_id,
      status,
      terminal,
      cwd,
      wrapper_session_id,
      wrapper_pid,
      claude_pid,
      timestamp,
      hostname,
      user,
    } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Missing status" });
    }

    // Handle wrapper status updates (has wrapper_session_id)
    if (wrapper_session_id) {
      const effectiveAgentId =
        agent_id || wrapper_session_id || `agent_${wrapper_pid}`;

      logger.info(
        `Wrapper status update: ${status}, session=${wrapper_session_id}, wrapper_pid=${wrapper_pid}, claude_pid=${claude_pid}`
      );

      // Update or create agent with wrapper info
      const result = await this.matcher.findOrCreate({
        agentId: effectiveAgentId,
        terminal,
        cwd,
        status: status as any,
      });

      // Store wrapper metadata
      if (result.agentId) {
        const metadata = {
          wrapper_session_id,
          wrapper_pid,
          claude_pid,
          hostname,
          user,
          last_wrapper_update: timestamp || new Date().toISOString(),
        };

        await this.service.updateMetadata(result.agentId, {
          custom_name: `Claude [PID ${claude_pid || wrapper_pid}]`,
        });
      }

      // Broadcast update
      if (this.wsService) {
        this.wsService.broadcastToDashboard({
          type: "agents_updated",
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        ok: true,
        agent_id: result.agentId,
        wrapper_session_id,
        updated: result.rowCount,
      });
    }

    // Debounce rapid hook calls (for non-wrapper updates)
    if (!agent_id && (terminal || cwd)) {
      const hookKey = `hook_${terminal}_${cwd}_${status}`;
      const now = Date.now();
      const lastCall = this.lastHookCall.get(hookKey) || 0;

      if (now - lastCall < config.hooks.debounceMs) {
        logger.info(`Hook debounced: status="${status}" (too soon)`);
        return res.json({ ok: true, updated: 0, debounced: true });
      }

      this.lastHookCall.set(hookKey, now);
      logger.info(`Hook received: status="${status}", terminal="${terminal}", cwd="${cwd}"`);
    }

    // Find or create agent
    const result = await this.matcher.findOrCreate({
      agentId: agent_id,
      terminal,
      cwd,
      status,
    });

    logger.info(`Updated ${result.rowCount} agent(s) to "${status}"`);

    // Broadcast update to dashboard
    if (this.wsService) {
      this.wsService.broadcastToDashboard({
        type: "agents_updated",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      ok: true,
      updated: result.rowCount,
      agent_id: result.agentId,
      created: result.created,
    });
  }
}
