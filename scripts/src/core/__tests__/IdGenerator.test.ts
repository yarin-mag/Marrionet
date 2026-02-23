import { describe, it, expect, vi } from 'vitest';
import { IdGenerator } from '../IdGenerator';

describe('IdGenerator', () => {
  describe('generate', () => {
    it('should generate ID with correct prefix', () => {
      const id = IdGenerator.generate('test');
      expect(id).toMatch(/^test_\d+_[a-f0-9]{8}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = IdGenerator.generate('test');
      const id2 = IdGenerator.generate('test');
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const beforeTime = Date.now();
      const id = IdGenerator.generate('test');
      const afterTime = Date.now();

      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should include random hex component', () => {
      const id = IdGenerator.generate('test');
      const parts = id.split('_');
      const randomPart = parts[2];

      expect(randomPart).toMatch(/^[a-f0-9]{8}$/);
      expect(randomPart.length).toBe(8);
    });

    it('should work with different prefixes', () => {
      const prefixes = ['agent', 'session', 'msg', 'test', 'custom'];

      prefixes.forEach((prefix) => {
        const id = IdGenerator.generate(prefix);
        expect(id).toMatch(new RegExp(`^${prefix}_\\d+_[a-f0-9]{8}$`));
      });
    });
  });

  describe('generateAgentId', () => {
    it('should generate ID with agent prefix', () => {
      const id = IdGenerator.generateAgentId();
      expect(id).toMatch(/^agent_\d+_[a-f0-9]{8}$/);
    });

    it('should generate unique agent IDs', () => {
      const id1 = IdGenerator.generateAgentId();
      const id2 = IdGenerator.generateAgentId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateSessionId', () => {
    it('should generate ID with session prefix', () => {
      const id = IdGenerator.generateSessionId();
      expect(id).toMatch(/^session_\d+_[a-f0-9]{8}$/);
    });

    it('should generate unique session IDs', () => {
      const id1 = IdGenerator.generateSessionId();
      const id2 = IdGenerator.generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateMessageId', () => {
    it('should generate ID with msg prefix', () => {
      const id = IdGenerator.generateMessageId();
      expect(id).toMatch(/^msg_\d+_[a-f0-9]{8}$/);
    });

    it('should generate unique message IDs', () => {
      const id1 = IdGenerator.generateMessageId();
      const id2 = IdGenerator.generateMessageId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('timestamp consistency', () => {
    it('should use consistent timestamp format across methods', () => {
      const mockTime = 1234567890000;
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(mockTime);

      const agentId = IdGenerator.generateAgentId();
      const sessionId = IdGenerator.generateSessionId();
      const messageId = IdGenerator.generateMessageId();

      expect(agentId).toContain(`_${mockTime}_`);
      expect(sessionId).toContain(`_${mockTime}_`);
      expect(messageId).toContain(`_${mockTime}_`);

      dateSpy.mockRestore();
    });
  });
});
