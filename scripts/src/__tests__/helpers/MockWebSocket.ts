import { EventEmitter } from 'events';

export class MockWebSocket extends EventEmitter {
  public readyState: number = 0; // CONNECTING
  public url: string;
  public sentMessages: string[] = [];
  public isClosed: boolean = false;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string) {
    super();
    this.url = url;
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.isClosed = true;
    this.emit('close', code, reason);
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open');
  }

  simulateMessage(data: string): void {
    this.emit('message', { data });
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateClose(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.isClosed = true;
    this.emit('close', code, reason);
  }
}
