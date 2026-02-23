import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

export class MockReadable extends Readable {
  _read(): void {
    // No-op for mock
  }
}

export class MockWritable extends Writable {
  public writtenData: string[] = [];

  _write(
    chunk: unknown,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.writtenData.push(chunk?.toString() || '');
    callback();
  }
}

export class MockChildProcess extends EventEmitter {
  public stdout: MockReadable;
  public stderr: MockReadable;
  public stdin: MockWritable;
  public killed: boolean = false;
  public exitCode: number | null = null;
  public pid: number = 12345;

  constructor() {
    super();
    this.stdout = new MockReadable();
    this.stderr = new MockReadable();
    this.stdin = new MockWritable();
  }

  kill(signal?: string): boolean {
    this.killed = true;
    this.exitCode = signal === 'SIGKILL' ? 137 : 0;
    setImmediate(() => {
      this.emit('exit', this.exitCode, signal);
    });
    return true;
  }

  simulateStdout(data: string): void {
    this.stdout.push(data);
  }

  simulateStderr(data: string): void {
    this.stderr.push(data);
  }

  simulateExit(code: number, signal?: string): void {
    this.exitCode = code;
    this.emit('exit', code, signal);
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }
}
