import { vi } from 'vitest';

/**
 * Wait for a specific amount of time (for testing async operations)
 */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for a condition to be true
 */
export const waitFor = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> => {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await wait(interval);
  }
};

/**
 * Capture console output during test execution
 */
export const captureConsole = () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(' '));
  };

  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(' '));
  };

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
};

/**
 * Mock Date.now() for consistent timestamps in tests
 */
export const mockDateNow = (timestamp: number = 1234567890000) => {
  const spy = vi.spyOn(Date, 'now').mockReturnValue(timestamp);
  return {
    timestamp,
    restore: () => spy.mockRestore(),
  };
};

/**
 * Create a mock function with type safety
 */
export const createMockFn = <T extends (...args: never[]) => unknown>() => {
  return vi.fn<T>();
};

/**
 * Suppress console output during test execution
 */
export const suppressConsole = () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};

  return () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  };
};
