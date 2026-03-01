import { Router } from "express";
import { spawn } from "node:child_process";
import type { WebSocketService } from "../services/websocket.service.js";
import { AgentsController } from "../controllers/agents.controller.js";
import { AgentService } from "../services/agent.service.js";
import { CommandService } from "../services/command.service.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { EventRepository } from "../repositories/event.repository.js";

export function createAgentsRoutes(wsService?: WebSocketService, commandService?: CommandService) {
  const router = Router();
  const controller = new AgentsController();

  if (wsService) controller.setWebSocketService(wsService);

  router.get("/", asyncHandler(controller.getAgents.bind(controller)));
  router.get("/:agentId/conversation", asyncHandler(controller.getConversation.bind(controller)));
  router.get("/:agentId/runs", asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const eventRepo = new EventRepository();
    const runs = await eventRepo.getRuns(agentId, limit);
    res.json({ runs });
  }));
  router.get("/:agentId/llm-calls", asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const eventRepo = new EventRepository();
    const events = await eventRepo.findWithFilters({ agentId, type: "llm.call", limit });
    res.json({ calls: events.map((e) => ({
      ts: e.ts,
      summary: e.summary,
      duration_ms: e.duration_ms,
      tokens: e.tokens,
      payload: e.payload,
    })) });
  }));
  router.post("/:agentId/commands", asyncHandler(async (req, res) => {
    if (!commandService) {
      return res.status(503).json({ error: "Command service not available" });
    }
    const { agentId } = req.params;
    const { command, args } = req.body;
    if (!command || typeof command !== "string") {
      return res.status(400).json({ error: "Command is required and must be a string" });
    }
    const result = await commandService.execute(agentId, command, args);
    res.json(result);
  }));
  router.post("/:agentId/focus", asyncHandler(async (req, res) => {
    const agent = await new AgentService().getAgent(req.params.agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const cwd = agent.cwd ?? "";
    const terminal = agent.terminal ?? "";
    const isVSCode = terminal.toLowerCase().includes("vs code") || terminal.toLowerCase().includes("vscode");

    if (isVSCode && cwd) {
      spawn("code", [cwd], { detached: true, stdio: "ignore" }).unref();
      return res.json({ ok: true, method: "vscode" });
    }

    if (process.platform === "darwin") {
      const appMap: Record<string, string> = {
        "iterm2": "iTerm2",
        "terminal.app": "Terminal",
        "warp": "Warp",
        "ghostty": "Ghostty",
        "hyper": "Hyper",
      };
      const appName = appMap[terminal.toLowerCase()];
      if (appName) {
        const script = `tell application "${appName}" to activate`;
        spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" }).unref();
        return res.json({ ok: true, method: "applescript", app: appName });
      }
    }

    res.status(501).json({ error: "Focus not supported for this terminal/platform combination" });
  }));

  router.get("/:agentId", asyncHandler(controller.getAgent.bind(controller)));
  router.patch("/:agentId", asyncHandler(controller.updateMetadata.bind(controller)));
  router.delete("/crashed", asyncHandler(controller.deleteCrashed.bind(controller)));
  router.delete("/all", asyncHandler(controller.deleteAll.bind(controller)));
  router.delete("/:agentId", asyncHandler(controller.deleteAgent.bind(controller)));

  return router;
}
