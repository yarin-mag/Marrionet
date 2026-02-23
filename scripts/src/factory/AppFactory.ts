/**
 * Application factory for dependency injection
 * Wires up all components in the correct order
 */

import os from 'os';
import { Config, TerminalInfo, AgentIdentity } from '../types/state.js';
import { Logger } from '../core/Logger.js';
import { IdGenerator } from '../core/IdGenerator.js';
import { WebSocketClient } from '../websocket/WebSocketClient.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { HeartbeatManager } from '../websocket/HeartbeatManager.js';
import { MessageBuffer } from '../capture/MessageBuffer.js';
import { ClaudeProcess } from '../process/ClaudeProcess.js';
import { HookRegistry } from '../hooks/HookRegistry.js';
import { ProcessMonitor } from '../monitoring/ProcessMonitor.js';
import { NetworkMonitor } from '../monitoring/NetworkMonitor.js';
import { FilesystemMonitor } from '../monitoring/FilesystemMonitor.js';
import { StartupOrchestrator } from '../lifecycle/StartupOrchestrator.js';
import { ShutdownManager } from '../lifecycle/ShutdownManager.js';
import { PassthroughMode } from '../lifecycle/PassthroughMode.js';
import { ClaudeWrapperApp } from '../core/ClaudeWrapperApp.js';
import { IMonitor } from '../interfaces/IMonitor.js';

export class AppFactory {
  /**
   * Create a fully configured ClaudeWrapperApp instance
   */
  static create(config: Config): ClaudeWrapperApp {
    // 1. Create utilities
    const logger = new Logger('claude-wrapper');

    // 2. Generate IDs
    const agentId = IdGenerator.generateAgentId();
    const sessionId = IdGenerator.generateSessionId();
    const wrapperPid = process.pid;
    const startTime = Date.now();

    const identity: AgentIdentity = {
      agentId,
      sessionId,
      wrapperPid,
      startTime,
    };

    // 3. Create terminal info
    const terminalInfo: TerminalInfo = {
      terminal: process.env.TERM_SESSION_ID || process.env.TERM || 'unknown',
      cwd: process.cwd(),
      hostname: os.hostname(),
      user: process.env.USER || 'unknown',
    };

    // 4. Create WebSocket client
    const wsClient = new WebSocketClient(logger);

    // 5. Create event emitter
    const eventEmitter = new EventEmitter(wsClient, agentId, sessionId);

    // 6. Create message buffer (used for flush on exit)
    const messageBuffer = new MessageBuffer(
      eventEmitter,
      agentId,
      sessionId,
      config.messageTimeoutMs
    );

    // 7. Create process component
    const claudeProcess = new ClaudeProcess(logger, config.claudeCliPath);

    // 8. Create hook registry
    const hookRegistry = new HookRegistry();

    // 9. Create monitors
    const monitors: IMonitor[] = [
      new ProcessMonitor(eventEmitter, hookRegistry),
      new NetworkMonitor(eventEmitter, hookRegistry),
      new FilesystemMonitor(eventEmitter, logger, terminalInfo.cwd),
    ];

    // 10. Create lifecycle components
    const heartbeat = new HeartbeatManager(
      eventEmitter,
      startTime,
      config.heartbeatIntervalMs
    );

    const startupOrchestrator = new StartupOrchestrator(
      logger,
      wsClient,
      eventEmitter,
      heartbeat,
      monitors
    );

    const shutdownManager = new ShutdownManager(
      logger,
      wsClient,
      eventEmitter,
      heartbeat,
      messageBuffer,
      claudeProcess,
      monitors,
      startTime
    );

    const passthroughMode = new PassthroughMode(logger, config.claudeCliPath);

    // 11. Wire everything into ClaudeWrapperApp
    return new ClaudeWrapperApp(
      logger,
      config,
      identity,
      terminalInfo,
      wsClient,
      eventEmitter,
      claudeProcess,
      messageBuffer,
      monitors,
      startupOrchestrator,
      shutdownManager,
      passthroughMode
    );
  }
}