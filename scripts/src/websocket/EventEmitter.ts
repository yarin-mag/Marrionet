/**
 * Event emission logic with type-safe event builders
 */

import { WebSocketClient } from './WebSocketClient.js';
import { TerminalInfo } from '../types/state.js';
import { Message } from '../types/messages.js';

export class EventEmitter {
  constructor(
    private ws: WebSocketClient,
    private agentId: string,
    private sessionId: string
  ) {}

  emitAgentStarted(
    wrapperPid: number,
    terminalInfo: TerminalInfo
  ): void {
    this.ws.send({
      type: 'agent.started',
      agent_id: this.agentId,
      session_id: this.sessionId,
      wrapper_pid: wrapperPid,
      terminal: terminalInfo.terminal,
      cwd: terminalInfo.cwd,
      hostname: terminalInfo.hostname,
      user: terminalInfo.user,
      timestamp: new Date().toISOString(),
    });
  }

  emitConversationStarted(): void {
    this.ws.send({
      type: 'conversation.started',
      agent_id: this.agentId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  emitConversationTurn(message: Message): void {
    this.ws.send({
      type: 'conversation.turn',
      agent_id: this.agentId,
      session_id: this.sessionId,
      message,
    });
  }

  emitConversationEnded(durationSeconds: number): void {
    this.ws.send({
      type: 'conversation.ended',
      agent_id: this.agentId,
      session_id: this.sessionId,
      duration_seconds: durationSeconds,
      timestamp: new Date().toISOString(),
    });
  }

  emitProcessSpawned(
    pid: number,
    command: string,
    args: readonly string[]
  ): void {
    this.ws.send({
      type: 'process.spawned',
      agent_id: this.agentId,
      pid,
      command,
      args: [...args],
      timestamp: new Date().toISOString(),
    });
  }

  emitProcessExited(
    pid: number,
    exitCode: number | null,
    signal: string | null
  ): void {
    this.ws.send({
      type: 'process.exited',
      agent_id: this.agentId,
      pid,
      exit_code: exitCode,
      signal,
      timestamp: new Date().toISOString(),
    });
  }

  emitProcessStats(
    cpuPercent: number,
    memoryBytes: number,
    elapsedMs: number
  ): void {
    this.ws.send({
      type: 'process.stats',
      agent_id: this.agentId,
      cpu_percent: cpuPercent,
      memory_bytes: memoryBytes,
      elapsed_ms: elapsedMs,
      timestamp: new Date().toISOString(),
    });
  }

  emitNetworkRequest(method: string, url: string): void {
    this.ws.send({
      type: 'network.request',
      agent_id: this.agentId,
      method,
      url,
      timestamp: new Date().toISOString(),
    });
  }

  emitNetworkResponse(
    url: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.ws.send({
      type: 'network.response',
      agent_id: this.agentId,
      url,
      status_code: statusCode,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  emitNetworkError(url: string, error: string): void {
    this.ws.send({
      type: 'network.error',
      agent_id: this.agentId,
      url,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  emitFileCreated(path: string): void {
    this.ws.send({
      type: 'file.created',
      agent_id: this.agentId,
      path,
      timestamp: new Date().toISOString(),
    });
  }

  emitFileModified(path: string): void {
    this.ws.send({
      type: 'file.modified',
      agent_id: this.agentId,
      path,
      timestamp: new Date().toISOString(),
    });
  }

  emitFileDeleted(path: string): void {
    this.ws.send({
      type: 'file.deleted',
      agent_id: this.agentId,
      path,
      timestamp: new Date().toISOString(),
    });
  }

  emitAgentHeartbeat(
    uptimeSeconds: number,
    memoryBytes: number
  ): void {
    this.ws.send({
      type: 'agent.heartbeat',
      agent_id: this.agentId,
      uptime_seconds: uptimeSeconds,
      memory_bytes: memoryBytes,
      timestamp: new Date().toISOString(),
    });
  }

  emitAgentDisconnected(
    exitCode: number | null,
    signal: string | null,
    durationSeconds: number
  ): void {
    this.ws.send({
      type: 'agent.disconnected',
      agent_id: this.agentId,
      status: 'disconnected',
      exit_code: exitCode,
      signal,
      duration_seconds: durationSeconds,
      timestamp: new Date().toISOString(),
    });
  }
}
