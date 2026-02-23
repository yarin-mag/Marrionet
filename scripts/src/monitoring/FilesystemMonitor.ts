/**
 * Filesystem monitoring via chokidar
 */

import chokidar from 'chokidar';
import { IMonitor } from '../interfaces/IMonitor.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { Logger } from '../core/Logger.js';

export class FilesystemMonitor implements IMonitor {
  private watcher: chokidar.FSWatcher | null = null;

  constructor(
    private eventEmitter: EventEmitter,
    private logger: Logger,
    private cwd: string
  ) {}

  /**
   * Initialize filesystem monitoring
   */
  initialize(): void {
    // Skip watching home directory — it contains protected junctions (e.g. Application Data)
    // that cause EPERM crashes, and there's nothing useful to monitor there anyway
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    if (homeDir && this.cwd === homeDir) {
      this.logger.warn('Filesystem watching skipped (running from home directory)');
      return;
    }

    try {
      this.watcher = chokidar.watch(this.cwd, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        depth: 3,
      });

      this.watcher
        .on('add', (filePath) => this.handleFileCreated(filePath))
        .on('change', (filePath) => this.handleFileModified(filePath))
        .on('unlink', (filePath) => this.handleFileDeleted(filePath))
        .on('error', (err) => {
          this.logger.warn(`Filesystem watcher error: ${err instanceof Error ? err.message : String(err)}`);
        });

      this.logger.info('Filesystem watching enabled');
    } catch (err) {
      this.logger.warn(
        `Failed to setup filesystem watching: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Shutdown filesystem monitoring
   */
  shutdown(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Handle file created event
   */
  private handleFileCreated(filePath: string): void {
    const relativePath = filePath.replace(this.cwd, '.');
    this.eventEmitter.emitFileCreated(relativePath);
  }

  /**
   * Handle file modified event
   */
  private handleFileModified(filePath: string): void {
    const relativePath = filePath.replace(this.cwd, '.');
    this.eventEmitter.emitFileModified(relativePath);
  }

  /**
   * Handle file deleted event
   */
  private handleFileDeleted(filePath: string): void {
    const relativePath = filePath.replace(this.cwd, '.');
    this.eventEmitter.emitFileDeleted(relativePath);
  }
}
