/**
 * Hook interface types for monkey-patching Node.js built-ins
 */

import { ChildProcess } from 'child_process';
import { RequestOptions, ClientRequest, IncomingMessage } from 'http';

/**
 * Type for the original spawn function from child_process
 */
export type OriginalSpawn = (
  command: string,
  args?: readonly string[],
  options?: any
) => ChildProcess;

/**
 * Type for the original HTTP/HTTPS request function
 */
export type OriginalHttpRequest = (
  options: string | URL | RequestOptions,
  callback?: (res: IncomingMessage) => void
) => ClientRequest;

/**
 * Callback types for hooks
 */
export type SpawnHookCallback = (
  command: string,
  args: readonly string[] | undefined,
  child: ChildProcess
) => void;

export type HttpRequestHookCallback = (
  url: string,
  method: string,
  req: ClientRequest
) => void;

export type HttpResponseHookCallback = (
  url: string,
  statusCode: number,
  durationMs: number
) => void;

export type HttpErrorHookCallback = (
  url: string,
  error: Error
) => void;
