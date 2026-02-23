/**
 * Main application orchestrator for Claude Wrapper
 */

import { Config, TerminalInfo, AgentIdentity } from '../types/state.js';
import { Logger } from './Logger.js';
import { WebSocketClient } from '../websocket/WebSocketClient.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { ClaudeProcess } from '../process/ClaudeProcess.js';
import { IMessageCapture } from '../interfaces/IMessageCapture.js';
import { IMonitor } from '../interfaces/IMonitor.js';
import { StartupOrchestrator } from '../lifecycle/StartupOrchestrator.js';
import { ShutdownManager } from '../lifecycle/ShutdownManager.js';
import { PassthroughMode } from '../lifecycle/PassthroughMode.js';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor.js';
import { AnsiStripper } from '../capture/AnsiStripper.js';

export class ClaudeWrapperApp {
  constructor(
    private logger: Logger,
    private config: Config,
    private identity: AgentIdentity,
    private terminalInfo: TerminalInfo,
    private wsClient: WebSocketClient,
    private eventEmitter: EventEmitter,
    private claudeProcess: ClaudeProcess,
    private messageCapture: IMessageCapture,
    private monitors: IMonitor[],
    private startupOrchestrator: StartupOrchestrator,
    private shutdownManager: ShutdownManager,
    private passthroughMode: PassthroughMode
  ) {}

  /**
   * Start the application.
   * Claude always starts immediately. Backend connection happens in the
   * background and retries every 30s until it succeeds.
   */
  async start(): Promise<void> {
    this.displayBanner();

    if (!this.config.captureEnabled) {
      this.logger.warn(
        'Conversation capture disabled (MARIONETTE_CAPTURE=false)'
      );
      this.passthroughMode.execute(process.argv.slice(2));
      return;
    }

    // Initialize monitors
    this.startupOrchestrator.initializeMonitors();

    // Start Claude immediately — don't block on backend availability
    this.startClaude();
    this.setupCleanupHandlers();

    // Connect to backend in the background, retry every 30s if unavailable
    this.startupOrchestrator.startBackgroundConnection(
      this.config.wsUrl,
      this.identity.wrapperPid,
      this.terminalInfo
    );
  }

  /**
   * Display startup banner
   */
  private displayBanner(): void {
    this.logger.displayBanner(
      this.identity.agentId,
      this.identity.sessionId,
      this.identity.wrapperPid,
      this.terminalInfo.terminal,
      this.terminalInfo.cwd,
      this.config.wsUrl
    );
  }

  /**
   * Start Claude CLI inside a PTY, wire I/O capture, and handle web UI messages.
   */
  private startClaude(): void {
    this.claudeProcess.spawn(process.argv.slice(2));

    this.claudeProcess.onError((err) => {
      this.logger.error(`Claude process error: ${err.message}`);
      process.exit(1);
    });

    this.claudeProcess.onExit((code, signal) => {
      this.handleClaudeExit(code, signal);
    });

    // --- PTY OUTPUT: forward to terminal and capture for Marionette ---
    let lineBuffer = '';
    this.claudeProcess.onData((chunk) => {
      // Forward raw output to the user's terminal
      process.stdout.write(chunk);

      // Split into lines; only feed lines that have meaningful content after
      // stripping all ANSI/VT100 escape sequences (skips TUI chrome/noise)
      lineBuffer += chunk;
      const parts = lineBuffer.split(/\r?\n/);
      lineBuffer = parts.pop() ?? '';
      for (const line of parts) {
        if (AnsiStripper.hasMeaningfulContent(AnsiStripper.strip(line))) {
          this.messageCapture.captureClaude(line);
        }
      }
    });

    // --- PTY INPUT: forward terminal stdin to PTY and capture user messages ---
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    let userLineBuffer = '';
    process.stdin.on('data', (data: Buffer) => {
      const str = data.toString();
      // Forward keystrokes to Claude's PTY
      this.claudeProcess.writeStdin(str);

      // Accumulate characters; flush a user message when Enter is pressed
      userLineBuffer += str;
      const parts = userLineBuffer.split(/[\r\n]+/);
      userLineBuffer = parts.pop() ?? '';
      for (const line of parts) {
        // Strip control characters before capturing
        const trimmed = line.replace(/[\x00-\x1F\x7F]/g, '').trim();
        if (trimmed) {
          this.messageCapture.captureUser(trimmed, 'terminal');
        }
      }
    });

    // --- Resize PTY when the terminal window changes size ---
    process.stdout.on('resize', () => {
      const cols = process.stdout.columns || 220;
      const rows = process.stdout.rows || 50;
      this.claudeProcess.resize(cols, rows);
    });

    // --- Incoming messages from the web UI → inject into Claude ---
    this.wsClient.onMessage((event) => {
      if (event.type === 'message.send') {
        this.claudeProcess.writeStdin(event.content + '\r');
        this.messageCapture.captureUser(event.content, 'web');
      }
    });

    // Start performance monitoring after Claude starts
    const claudePid = this.claudeProcess.getPid();
    if (claudePid) {
      const perfMonitor = new PerformanceMonitor(
        this.eventEmitter,
        this.logger,
        claudePid,
        this.config.performanceIntervalMs
      );
      perfMonitor.initialize();
      this.monitors.push(perfMonitor);
    }
  }

  /**
   * Handle Claude process exit
   */
  private handleClaudeExit(
    code: number | null,
    signal: string | null
  ): void {
    const duration = Math.floor(
      (Date.now() - this.identity.startTime) / 1000
    );
    this.logger.info(
      `Claude process exited (code: ${code}, duration: ${duration}s)`
    );

    this.messageCapture.flush();

    if (this.wsClient.isConnectedToBackend()) {
      this.eventEmitter.emitConversationEnded(duration);
      this.eventEmitter.emitAgentDisconnected(code, signal, duration);
    }

    this.wsClient.disconnect();
    process.exit(code || 0);
  }

  /**
   * Setup cleanup handlers for signals
   */
  private setupCleanupHandlers(): void {
    process.on('SIGINT', () => {
      this.shutdownManager.shutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      this.shutdownManager.shutdown('SIGTERM');
    });
  }
}