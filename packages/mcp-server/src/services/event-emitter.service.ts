import type { MarionetteEvent } from "@marionette/shared";
import type { WebSocketService } from "./websocket.service.js";

/**
 * Event emitter service for Marionette
 * Centralizes event emission logic
 */
export class EventEmitterService {
  public currentTaskId?: string;
  public currentRunStartTime?: number;

  constructor(
    private agentId: string,
    private wsService: WebSocketService
  ) {}

  /**
   * Emit an event
   */
  emit(event: Partial<MarionetteEvent>): void {
    this.wsService.emit(event);
  }

  /**
   * Start a task
   */
  startTask(taskId: string, taskName: string): void {
    // End previous task if exists
    if (this.currentTaskId) {
      this.endTask(this.currentTaskId, "Completed previous task");
    }

    this.currentTaskId = taskId;
    this.emit({
      type: "task.started",
      task_id: taskId,
      summary: `Task: ${taskName}`,
      status: "working",
    });
  }

  /**
   * End a task
   */
  endTask(taskId: string, summary: string = "Task completed"): void {
    this.emit({
      type: "task.ended",
      task_id: taskId,
      summary,
      status: "completed",
    });
  }

  /**
   * Start a run
   */
  startRun(): void {
    this.currentRunStartTime = Date.now();
    this.emit({
      type: "run.started",
      summary: "Agent run started",
      status: "working",
    });
  }

  /**
   * End a run with token usage
   */
  endRun(inputTokens: number, outputTokens: number): void {
    const durationMs = this.currentRunStartTime
      ? Date.now() - this.currentRunStartTime
      : 0;

    const tokens = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    };

    this.emit({
      type: "run.ended",
      summary: "Agent run completed",
      status: "working",
      duration_ms: durationMs,
      tokens,
    });

    // Reset for next run
    this.currentRunStartTime = undefined;
  }

  /**
   * Report token usage
   */
  reportTokens(inputTokens: number, outputTokens: number): void {
    const durationMs = this.currentRunStartTime
      ? Date.now() - this.currentRunStartTime
      : 0;

    this.emit({
      type: "tool.result",
      summary: "Token usage reported",
      tokens: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
      duration_ms: durationMs,
    });
  }
}
