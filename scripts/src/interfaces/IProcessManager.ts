/**
 * Interface for Claude process management
 */

export interface IProcessManager {
  /**
   * Spawn the Claude CLI process
   */
  spawn(args: string[]): void;

  /**
   * Get the process PID
   */
  getPid(): number | null;

  /**
   * Subscribe to output data from the process
   */
  onData(callback: (data: string) => void): void;

  /**
   * Write data to the process stdin
   */
  writeStdin(data: string): void;

  /**
   * Resize the terminal dimensions
   */
  resize(cols: number, rows: number): void;

  /**
   * Kill the process
   */
  kill(signal?: string): void;

  /**
   * Register an exit handler
   */
  onExit(callback: (exitCode: number | null, signal: string | null) => void): void;

  /**
   * Register an error handler
   */
  onError(callback: (err: Error) => void): void;
}