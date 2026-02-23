/**
 * Message accumulation with timeout-based flushing
 * Accumulates lines of text and flushes after a pause
 */

export class MessageAccumulator {
  private buffer: string = '';
  private timeout: NodeJS.Timeout | null = null;

  constructor(
    private timeoutMs: number,
    private onFlush: (content: string) => void
  ) {}

  /**
   * Accumulate a line of text
   */
  accumulate(line: string): void {
    this.buffer += line + '\n';

    // Clear existing timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // Set new timeout to flush
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.timeoutMs);
  }

  /**
   * Flush accumulated content
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.onFlush(this.buffer.trim());
      this.clear();
    }
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = '';
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
