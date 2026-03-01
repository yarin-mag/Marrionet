import type { CommandDefinition, CommandResponse, MarionetteEvent } from "@marionette/shared";
import { AgentService } from "./agent.service.js";
import { EventService } from "./event.service.js";
import { logger } from "../utils/logger.js";

/**
 * Service for executing agent commands (slash commands)
 */
export class CommandService {
  private commands = new Map<string, CommandDefinition>();
  private handlers = new Map<string, (agentId: string, args?: any) => Promise<any>>();

  constructor(
    private agentService: AgentService,
    private eventService: EventService,
  ) {
    this.registerBuiltInCommands();
  }

  /**
   * Register all built-in commands
   */
  private registerBuiltInCommands(): void {
    // /context - Get agent context
    this.register(
      {
        name: '/context',
        description: 'Get agent working directory, current task, and recent activity',
        category: 'context'
      },
      this.handleContext.bind(this)
    );

    // /status - Agent health metrics
    this.register(
      {
        name: '/status',
        description: 'Get agent health metrics (tokens, errors, uptime)',
        category: 'context'
      },
      this.handleStatus.bind(this)
    );

    // /inspect - Deep inspection
    this.register(
      {
        name: '/inspect',
        description: 'Deep inspection of agent state and thinking process',
        category: 'debug',
        args: [
          {
            name: 'target',
            type: 'string',
            required: false,
            description: 'Specific target to inspect (e.g., "context", "metrics")'
          }
        ]
      },
      this.handleInspect.bind(this)
    );

    // /help - List commands
    this.register(
      {
        name: '/help',
        description: 'List all available commands',
        category: 'query'
      },
      this.handleHelp.bind(this)
    );
  }

  /**
   * Register a command with its handler
   */
  register(
    definition: CommandDefinition,
    handler: (agentId: string, args?: any) => Promise<any>
  ): void {
    this.commands.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
    logger.debug(`Registered command: ${definition.name}`);
  }

  /**
   * Execute a command
   */
  async execute(agentId: string, command: string, args?: any): Promise<CommandResponse> {
    const startTime = Date.now();

    try {
      const cmd = this.commands.get(command);
      if (!cmd) {
        return {
          success: false,
          error: `Unknown command: ${command}. Type /help for available commands.`,
          executionTimeMs: Date.now() - startTime
        };
      }

      const handler = this.handlers.get(command);
      if (!handler) {
        return {
          success: false,
          error: `Command handler not found: ${command}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      logger.info(`Executing command ${command} for agent ${agentId}`);
      const data = await handler(agentId, args);

      return {
        success: true,
        data,
        executionTimeMs: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error(`Command execution failed: ${command}`, error);
      return {
        success: false,
        error: error.message || 'Command execution failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get all available commands
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  // ============================================
  // Command Handlers
  // ============================================

  private async handleContext(agentId: string): Promise<any> {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const recentEvents = await this.eventService.getEventsByAgentId(agentId, 50);

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

  private async handleStatus(agentId: string): Promise<any> {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

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

  private async handleInspect(agentId: string, args?: { target?: string }): Promise<Record<string, unknown>> {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const target = args?.target || 'all';
    const recentEvents = await this.eventService.getEventsByAgentId(agentId, 100);

    return {
      agentId,
      target,
      timestamp: new Date().toISOString(),
      ...(target === 'all' || target === 'context'   ? { context:   this.inspectContext(agent) }         : {}),
      ...(target === 'all' || target === 'metrics'   ? { metrics:   this.inspectMetrics(agent) }         : {}),
      ...(target === 'all' || target === 'tools'     ? { tools:     this.inspectTools(recentEvents) }    : {}),
    };
  }

  private inspectContext(agent: Awaited<ReturnType<AgentService["getAgent"]>>) {
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

  private inspectMetrics(agent: Awaited<ReturnType<AgentService["getAgent"]>>) {
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

  private inspectTools(events: MarionetteEvent[]) {
    return events
      .filter(e => e.type === 'tool.called')
      .map(e => ({ tool: e.summary, timestamp: e.ts, status: e.status }));
  }

  private async handleHelp(): Promise<any> {
    const commands = this.getCommands();

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
}
