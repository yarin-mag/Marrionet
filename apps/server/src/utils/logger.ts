/**
 * Centralized logging utility with consistent formatting
 */
export class Logger {
  static info(message: string, ...args: any[]) {
    console.log(`[stayintheloop] [INFO] ${message}`, ...args);
  }

  static error(message: string, ...args: any[]) {
    console.error(`[stayintheloop] [ERROR] ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    console.warn(`[stayintheloop] [WARN] ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]) {
    if (process.env.DEBUG) {
      console.log(`[stayintheloop] [DEBUG] ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = Logger;
