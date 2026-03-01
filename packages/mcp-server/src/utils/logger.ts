/**
 * Logger utility for MCP server
 * Uses stderr for logging to avoid interfering with stdio MCP transport
 */
/**
 * Logger for MCP server — uses stderr to avoid interfering with stdio MCP transport.
 * Format aligned with apps/server logger for consistent cross-service log aggregation.
 */
export class Logger {
  static info(message: string, ...args: any[]) {
    console.error(`[marionette] [INFO] ${message}`, ...args);
  }

  static error(message: string, ...args: any[]) {
    console.error(`[marionette] [ERROR] ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    console.error(`[marionette] [WARN] ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]) {
    if (process.env.DEBUG) {
      console.error(`[marionette] [DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = Logger;
