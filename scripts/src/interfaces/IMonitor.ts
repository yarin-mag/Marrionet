/**
 * Interface for all monitoring components
 */

export interface IMonitor {
  /**
   * Initialize the monitor and setup hooks
   */
  initialize(): void;

  /**
   * Shutdown the monitor and cleanup resources
   */
  shutdown(): void;
}
