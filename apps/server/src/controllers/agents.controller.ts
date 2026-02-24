import type { Request, Response } from "express";
import type { AgentStatus } from "@marionette/shared";
import type { WebSocketService } from "../services/websocket.service.js";
import { AgentService } from "../services/agent.service.js";
import { AgentMatcher } from "../strategies/agent-matcher.strategy.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export class AgentsController {
  private service = new AgentService();
  private matcher = new AgentMatcher();
  private lastHookCall = new Map<string, number>();
  private wsService: WebSocketService | undefined;

  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  async getAgents(req: Request, res: Response) {
    const statusFilter = req.query.status?.toString() as AgentStatus | undefined;
    const agents = await this.service.getAgents(statusFilter);
    res.json(agents);
  }

  async getAgent(req: Request, res: Response) {
    const agent = await this.service.getAgent(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  }

  async deleteCrashed(req: Request, res: Response) {
    const count = await this.service.deleteCrashedAgents();
    this.wsService?.broadcastToDashboard({ type: "agents_updated" });
    res.json({ ok: true, deleted: count });
  }

  async deleteAll(req: Request, res: Response) {
    const count = await this.service.deleteAllAgents();
    this.wsService?.broadcastToDashboard({ type: "agents_updated" });
    res.json({ ok: true, deleted: count });
  }

  async deleteAgent(req: Request, res: Response) {
    const { agentId } = req.params;
    const count = await this.service.deleteAgent(agentId);
    if (count === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    this.wsService?.broadcastToDashboard({ type: "agents_updated" });
    res.json({ ok: true, deleted: count });
  }

  async updateMetadata(req: Request, res: Response) {
    const { agentId } = req.params;
    const { custom_name, labels, jira_tickets } = req.body;

    const metadata = await this.service.updateMetadata(agentId, {
      custom_name,
      labels,
      jira_tickets,
    });

    this.wsService?.broadcastToDashboard({ type: "agents_updated" });
    res.json({ ok: true, metadata });
  }

  async updateStatus(req: Request, res: Response) {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Missing status" });
    }

    if (req.body.wrapper_session_id) {
      return this.handleWrapperStatusUpdate(req, res);
    }

    return this.handleRegularStatusUpdate(req, res);
  }

  private async handleWrapperStatusUpdate(req: Request, res: Response): Promise<void> {
    const {
      agent_id,
      status,
      terminal,
      cwd,
      wrapper_session_id,
      wrapper_pid,
      claude_pid,
    } = req.body;

    const effectiveAgentId = agent_id || wrapper_session_id || `agent_${wrapper_pid}`;

    logger.info(
      `Wrapper status update: ${status}, session=${wrapper_session_id}, wrapper_pid=${wrapper_pid}, claude_pid=${claude_pid}`
    );

    const result = await this.matcher.findOrCreate({
      agentId: effectiveAgentId,
      terminal,
      cwd,
      status: status as AgentStatus,
    });

    if (result.agentId) {
      const existingAgent = await this.service.getAgent(result.agentId);
      if (!existingAgent?.metadata?.custom_name) {
        await this.service.updateMetadata(result.agentId, {
          custom_name: `Claude [PID ${claude_pid || wrapper_pid}]`,
        });
      }
    }

    this.wsService?.broadcastToDashboard({
      type: "agents_updated",
      timestamp: new Date().toISOString(),
    });

    res.json({
      ok: true,
      agent_id: result.agentId,
      wrapper_session_id,
      updated: result.rowCount,
    });
  }

  private async handleRegularStatusUpdate(req: Request, res: Response): Promise<void> {
    const { agent_id, status, terminal, cwd } = req.body;

    if (!agent_id && (terminal || cwd)) {
      const hookKey = `hook_${terminal}_${cwd}_${status}`;
      const now = Date.now();
      const lastCall = this.lastHookCall.get(hookKey) ?? 0;

      if (now - lastCall < config.hooks.debounceMs) {
        logger.info(`Hook debounced: status="${status}" (too soon)`);
        res.json({ ok: true, updated: 0, debounced: true });
        return;
      }

      this.lastHookCall.set(hookKey, now);
      logger.info(`Hook received: status="${status}", terminal="${terminal}", cwd="${cwd}"`);
    }

    const result = await this.matcher.findOrCreate({
      agentId: agent_id,
      terminal,
      cwd,
      status,
    });

    logger.info(`Updated ${result.rowCount} agent(s) to "${status}"`);

    this.wsService?.broadcastToDashboard({
      type: "agents_updated",
      timestamp: new Date().toISOString(),
    });

    res.json({
      ok: true,
      updated: result.rowCount,
      agent_id: result.agentId,
      created: result.created,
    });
  }
}
