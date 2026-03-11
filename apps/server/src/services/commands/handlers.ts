import type { MarionetteEvent } from "@marionette/shared";
import type { AgentService } from "../agent.service.js";
import type { EventService } from "../event.service.js";

type AgentResult = Awaited<ReturnType<AgentService["getAgent"]>>;

// ─── /context ────────────────────────────────────────────────────────────────

export async function contextHandler(
  agentService: AgentService,
  eventService: EventService,
  agentId: string
): Promise<Record<string, unknown>> {
  const agent = await agentService.getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const recentEvents = await eventService.getEventsByAgentId(agentId, 50);

  return {
    agent: {
      id: agent.agent_id,
      name: agent.agent_name,
      status: agent.status,
      terminal: agent.terminal,
      cwd: agent.cwd
    },
    currentTask: agent.current_task,
    recentActivity: recentEvents.map((e: MarionetteEvent) => ({
      type: e.type,
      summary: e.summary,
      timestamp: e.ts,
      status: e.status
    })),
    environment: {
      workingDirectory: agent.cwd,
      terminal: agent.terminal
    },
    session: {
      startTime: agent.session_start,
      totalRuns: agent.session_runs,
      totalErrors: agent.session_errors
    }
  };
}

// ─── /status ─────────────────────────────────────────────────────────────────

export async function statusHandler(
  agentService: AgentService,
  agentId: string
): Promise<Record<string, unknown>> {
  const agent = await agentService.getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  return {
    health: {
      status: agent.status,
      lastActivity: agent.last_activity,
      uptime: agent.session_start
        ? Date.now() - new Date(agent.session_start).getTime()
        : null
    },
    metrics: {
      totalRuns: agent.total_runs,
      totalTasks: agent.total_tasks,
      totalErrors: agent.total_errors,
      totalTokens: agent.total_tokens,
      totalDurationMs: agent.total_duration_ms,
      sessionRuns: agent.session_runs,
      sessionErrors: agent.session_errors
    }
  };
}

// ─── /inspect ────────────────────────────────────────────────────────────────

function inspectContext(agent: AgentResult) {
  return {
    agent: {
      id: agent!.agent_id,
      name: agent!.agent_name,
      status: agent!.status,
      terminal: agent!.terminal,
      cwd: agent!.cwd,
    },
    currentTask: agent!.current_task,
    metadata: agent!.metadata,
  };
}

function inspectMetrics(agent: AgentResult) {
  const a = agent!;
  return {
    runs: a.total_runs,
    tasks: a.total_tasks,
    errors: a.total_errors,
    tokens: a.total_tokens,
    duration: a.total_duration_ms,
    avgDuration: a.total_runs > 0 ? Math.round(a.total_duration_ms / a.total_runs) : 0,
  };
}

function inspectTools(events: MarionetteEvent[]) {
  return events
    .filter(e => e.type === 'tool.called')
    .map(e => ({ tool: e.summary, timestamp: e.ts, status: e.status }));
}

export async function inspectHandler(
  agentService: AgentService,
  eventService: EventService,
  agentId: string,
  args?: { target?: string }
): Promise<Record<string, unknown>> {
  const agent = await agentService.getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const target = args?.target || 'all';
  const recentEvents = await eventService.getEventsByAgentId(agentId, 100);

  return {
    agentId,
    target,
    timestamp: new Date().toISOString(),
    ...(target === 'all' || target === 'context' ? { context: inspectContext(agent) } : {}),
    ...(target === 'all' || target === 'metrics' ? { metrics: inspectMetrics(agent) } : {}),
    ...(target === 'all' || target === 'tools'   ? { tools: inspectTools(recentEvents) } : {}),
  };
}

// ─── /help ───────────────────────────────────────────────────────────────────

export function helpHandler(commands: Array<{ name: string; description: string; category: string; args?: unknown[] }>): Record<string, unknown> {
  return {
    commands: commands.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      category: cmd.category,
      args: cmd.args || []
    })),
    usage: 'Type a command starting with / (e.g., /context) to execute it'
  };
}
