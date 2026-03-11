import type { CommandDefinition, CommandResponse } from "@marionette/shared";
import { AgentService } from "../agent.service.js";
import { EventService } from "../event.service.js";
import { logger } from "../../utils/logger.js";
import { contextHandler, statusHandler, inspectHandler, helpHandler } from "./handlers.js";

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

  private registerBuiltInCommands(): void {
    this.register(
      { name: '/context', description: 'Get agent working directory, current task, and recent activity', category: 'context' },
      (agentId) => contextHandler(this.agentService, this.eventService, agentId)
    );

    this.register(
      { name: '/status', description: 'Get agent health metrics (tokens, errors, uptime)', category: 'context' },
      (agentId) => statusHandler(this.agentService, agentId)
    );

    this.register(
      {
        name: '/inspect',
        description: 'Deep inspection of agent state and thinking process',
        category: 'debug',
        args: [{ name: 'target', type: 'string', required: false, description: 'Specific target to inspect (e.g., "context", "metrics")' }]
      },
      (agentId, args) => inspectHandler(this.agentService, this.eventService, agentId, args)
    );

    this.register(
      { name: '/help', description: 'List all available commands', category: 'query' },
      () => Promise.resolve(helpHandler(this.getCommands()))
    );
  }

  register(
    definition: CommandDefinition,
    handler: (agentId: string, args?: any) => Promise<any>
  ): void {
    this.commands.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
    logger.debug(`Registered command: ${definition.name}`);
  }

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

      return { success: true, data, executionTimeMs: Date.now() - startTime };
    } catch (error: any) {
      logger.error(`Command execution failed: ${command}`, error);
      return {
        success: false,
        error: error.message || 'Command execution failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }
}
