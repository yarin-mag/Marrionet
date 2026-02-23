import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageAccumulator } from '../MessageAccumulator';

describe('MessageAccumulator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('accumulate', () => {
    it('should buffer incoming lines', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('Line 1');
      accumulator.accumulate('Line 2');

      // Should not flush immediately
      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should flush after timeout', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('Line 1');
      accumulator.accumulate('Line 2');

      vi.advanceTimersByTime(500);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith('Line 1\nLine 2');
    });

    it('should reset timeout on each accumulate', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('Line 1');
      vi.advanceTimersByTime(300);

      accumulator.accumulate('Line 2');
      vi.advanceTimersByTime(300);

      // Should not have flushed yet (only 600ms total, but timer reset)
      expect(onFlush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);

      // Now should flush (500ms since last accumulate)
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith('Line 1\nLine 2');
    });

    it('should append newlines to accumulated content', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('First');
      accumulator.accumulate('Second');
      accumulator.accumulate('Third');

      vi.advanceTimersByTime(500);

      expect(onFlush).toHaveBeenCalledWith('First\nSecond\nThird');
    });
  });

  describe('flush', () => {
    it('should call onFlush callback with trimmed content', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('  Content with whitespace  ');
      accumulator.flush();

      expect(onFlush).toHaveBeenCalledWith('Content with whitespace');
    });

    it('should not call onFlush if buffer is empty', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.flush();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should not call onFlush if buffer contains only whitespace', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('   ');
      accumulator.accumulate('\n');
      accumulator.flush();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should clear buffer after flush', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('Content');
      accumulator.flush();

      expect(onFlush).toHaveBeenCalledTimes(1);

      // Flush again should not call onFlush (buffer is empty)
      accumulator.flush();
      expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it('should clear timeout after flush', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('Content');
      accumulator.flush();

      // Advance time - should not trigger another flush
      vi.advanceTimersByTime(1000);
      expect(onFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should clear buffer without calling onFlush', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('Content');
      accumulator.clear();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should clear timeout', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('Content');
      accumulator.clear();

      vi.advanceTimersByTime(1000);

      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should allow accumulation after clear', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(500, onFlush);

      accumulator.accumulate('First batch');
      accumulator.clear();

      accumulator.accumulate('Second batch');
      vi.advanceTimersByTime(500);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith('Second batch');
    });
  });

  describe('timeout configuration', () => {
    it('should respect custom timeout values', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(1000, onFlush);

      accumulator.accumulate('Content');

      vi.advanceTimersByTime(500);
      expect(onFlush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it('should work with short timeouts', () => {
      const onFlush = vi.fn();
      const accumulator = new MessageAccumulator(100, onFlush);

      accumulator.accumulate('Content');
      vi.advanceTimersByTime(100);

      expect(onFlush).toHaveBeenCalledTimes(1);
    });
  });
});
