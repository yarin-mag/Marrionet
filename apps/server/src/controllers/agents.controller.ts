import type { Request, Response } from "express";
import type { AgentStatus } from "@marionette/shared";
import type { WebSocketService } from "../services/websocket.service.js";
import { AgentService } from "../services/agent.service.js";
import { EventRepository } from "../repositories/event.repository.js";
import type { ConversationTurn } from "@marionette/shared";

export class AgentsController {
  private service = new AgentService();
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

  async deleteCrashed(_req: Request, res: Response) {
    const count = await this.service.deleteCrashedAgents();
    this.wsService?.broadcastToDashboard({ type: "agents_updated" });
    res.json({ ok: true, deleted: count });
  }

  async deleteAll(_req: Request, res: Response) {
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
    const { custom_name, labels, jira_tickets, source_file, current_task, notes, process_pid, token_budget, cost_budget_usd } = req.body;

    const metadata = await this.service.updateMetadata(agentId, {
      custom_name,
      labels,
      jira_tickets,
      source_file,
      current_task,
      notes,
      process_pid,
      token_budget,
      cost_budget_usd,
    });

    this.wsService?.broadcastToDashboard({ type: "agents_updated" });
    res.json({ ok: true, metadata });
  }

  async getConversation(req: Request, res: Response) {
    const { agentId } = req.params;
    const rawLimit = parseInt(String(req.query.limit ?? ""), 10);
    const limit = Math.min(Number.isNaN(rawLimit) || rawLimit <= 0 ? 500 : rawLimit, 500);

    const eventRepo = new EventRepository();
    const [turnEvents, llmEvents] = await Promise.all([
      eventRepo.findWithFilters({ agentId, type: "conversation.turn", limit }),
      eventRepo.findWithFilters({ agentId, type: "llm.call", limit: 1000 }),
    ]);

    // Build per-run ordered list of llm.call token objects (sorted oldest→newest).
    // The Nth llm.call in a run corresponds to the Nth assistant conversation.turn in that run.
    const llmByRun = new Map<string, Array<{ tokens: unknown; ts: string }>>();
    for (const e of llmEvents) {
      if (!e.run_id || !e.tokens) continue;
      if (!llmByRun.has(e.run_id)) llmByRun.set(e.run_id, []);
      llmByRun.get(e.run_id)!.push({ tokens: e.tokens, ts: e.ts ?? "" });
    }
    for (const arr of llmByRun.values()) {
      arr.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    }

    // Track how many assistant turns we've matched per run so we can index into the llm list.
    const assistantCountByRun = new Map<string, number>();

    const turns = turnEvents.reverse().flatMap((e) => {
      const rawTurn = e.payload as Record<string, unknown> | null;
      if (!rawTurn || typeof rawTurn.role !== "string") return []; // skip malformed
      const turn = rawTurn as unknown as ConversationTurn;
      if (turn.role === "assistant" && e.run_id) {
        const idx = assistantCountByRun.get(e.run_id) ?? 0;
        assistantCountByRun.set(e.run_id, idx + 1);
        const llmEntry = llmByRun.get(e.run_id)?.[idx];
        if (llmEntry) return [{ ...turn, tokens: llmEntry.tokens }];
      }
      return [turn];
    });

    // Compute conversation-level token totals across all matched llm.call events.
    const allRunIds = [...new Set(turnEvents.map((e) => e.run_id).filter(Boolean))];
    let totalInputTokens = 0, totalOutputTokens = 0, totalCostUsd = 0;
    for (const runId of allRunIds) {
      for (const entry of llmByRun.get(runId as string) ?? []) {
        const t = entry.tokens as Record<string, number> | null;
        if (!t) continue;
        totalInputTokens  += t.input_tokens  ?? 0;
        totalOutputTokens += t.output_tokens ?? 0;
        totalCostUsd      += t.cost_usd      ?? 0;
      }
    }

    res.json({
      turns,
      total: turns.length,
      totals: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens, cost_usd: totalCostUsd },
    });
  }
}
