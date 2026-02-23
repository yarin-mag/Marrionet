/**
 * Centralized hook registry for monkey-patching Node.js built-ins
 * This module centralizes all monkey-patching to improve testability
 * and manage TypeScript compatibility
 */

import { spawn as originalSpawn, ChildProcess } from 'child_process';
import http from 'http';
import https from 'https';
import {
  SpawnHookCallback,
  HttpRequestHookCallback,
  HttpResponseHookCallback,
  HttpErrorHookCallback,
} from '../types/hooks.js';

export class HookRegistry {
  private spawnCallbacks: SpawnHookCallback[] = [];
  private httpRequestCallbacks: HttpRequestHookCallback[] = [];
  private httpResponseCallbacks: HttpResponseHookCallback[] = [];
  private httpErrorCallbacks: HttpErrorHookCallback[] = [];

  /**
   * Register a spawn hook
   */
  registerSpawnHook(callback: SpawnHookCallback): void {
    this.spawnCallbacks.push(callback);
    if (this.spawnCallbacks.length === 1) {
      this.monkeyPatchSpawn();
    }
  }

  /**
   * Register HTTP request hooks
   */
  registerHttpHooks(
    onRequest: HttpRequestHookCallback,
    onResponse: HttpResponseHookCallback,
    onError: HttpErrorHookCallback
  ): void {
    this.httpRequestCallbacks.push(onRequest);
    this.httpResponseCallbacks.push(onResponse);
    this.httpErrorCallbacks.push(onError);

    if (this.httpRequestCallbacks.length === 1) {
      this.monkeyPatchHttp();
    }
  }

  /**
   * Register HTTPS request hooks
   */
  registerHttpsHooks(
    onRequest: HttpRequestHookCallback,
    onResponse: HttpResponseHookCallback,
    onError: HttpErrorHookCallback
  ): void {
    this.httpRequestCallbacks.push(onRequest);
    this.httpResponseCallbacks.push(onResponse);
    this.httpErrorCallbacks.push(onError);

    if (this.httpRequestCallbacks.length === 1) {
      this.monkeyPatchHttps();
    }
  }

  /**
   * Monkey-patch child_process.spawn
   */
  private monkeyPatchSpawn(): void {
    const self = this;

    // @ts-ignore - Intentional monkey-patching
    global.spawn = function (
      command: string,
      args?: readonly string[],
      options?: any
    ): ChildProcess {
      const child = originalSpawn.apply(this, arguments as any);

      // Notify all callbacks
      self.spawnCallbacks.forEach((cb) => {
        cb(command, args, child);
      });

      return child;
    };
  }

  /**
   * Monkey-patch http.request
   */
  private monkeyPatchHttp(): void {
    const self = this;
    const originalRequest = http.request;

    // @ts-ignore - Intentional monkey-patching
    http.request = function (options: any, callback?: any) {
      const startTime = Date.now();
      const url = self.buildUrl('http', options);
      const method = options.method || 'GET';

      // Notify request callbacks
      const req = originalRequest.apply(this, arguments as any);
      self.httpRequestCallbacks.forEach((cb) => {
        cb(url, method, req);
      });

      // Hook response
      req.on('response', (res) => {
        const durationMs = Date.now() - startTime;
        self.httpResponseCallbacks.forEach((cb) => {
          cb(url, res.statusCode || 0, durationMs);
        });
      });

      // Hook error
      req.on('error', (err) => {
        self.httpErrorCallbacks.forEach((cb) => {
          cb(url, err);
        });
      });

      return req;
    };
  }

  /**
   * Monkey-patch https.request
   */
  private monkeyPatchHttps(): void {
    const self = this;
    const originalRequest = https.request;

    // @ts-ignore - Intentional monkey-patching
    https.request = function (options: any, callback?: any) {
      const startTime = Date.now();
      const url = self.buildUrl('https', options);
      const method = options.method || 'GET';

      // Notify request callbacks
      const req = originalRequest.apply(this, arguments as any);
      self.httpRequestCallbacks.forEach((cb) => {
        cb(url, method, req);
      });

      // Hook response
      req.on('response', (res) => {
        const durationMs = Date.now() - startTime;
        self.httpResponseCallbacks.forEach((cb) => {
          cb(url, res.statusCode || 0, durationMs);
        });
      });

      // Hook error
      req.on('error', (err) => {
        self.httpErrorCallbacks.forEach((cb) => {
          cb(url, err);
        });
      });

      return req;
    };
  }

  /**
   * Build URL from request options
   */
  private buildUrl(protocol: string, options: any): string {
    const hostname = options.hostname || options.host || 'localhost';
    const port =
      options.port || (protocol === 'https' ? 443 : 80);
    const path = options.path || '/';
    return `${protocol}://${hostname}:${port}${path}`;
  }
}
