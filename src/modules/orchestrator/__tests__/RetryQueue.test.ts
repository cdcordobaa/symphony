import { RetryQueue } from '../RetryQueue';

describe('RetryQueue', () => {
  describe('computeDelay()', () => {
    it('returns base delay (1000ms) for attempt 0', () => {
      const q = new RetryQueue(300_000);
      expect(q.computeDelay(0)).toBe(1_000);
    });

    it('doubles delay for each attempt (exponential backoff)', () => {
      const q = new RetryQueue(300_000);
      expect(q.computeDelay(1)).toBe(2_000);
      expect(q.computeDelay(2)).toBe(4_000);
      expect(q.computeDelay(3)).toBe(8_000);
      expect(q.computeDelay(4)).toBe(16_000);
    });

    it('caps delay at maxRetryBackoffMs', () => {
      const q = new RetryQueue(5_000);
      expect(q.computeDelay(3)).toBe(5_000); // 8000 capped to 5000
      expect(q.computeDelay(10)).toBe(5_000);
    });

    it('caps at exactly max when exponential equals max', () => {
      const q = new RetryQueue(4_000);
      expect(q.computeDelay(2)).toBe(4_000); // 4000 === 4000
    });

    it('uses default max of 300000ms when not specified', () => {
      const q = new RetryQueue();
      expect(q.computeDelay(20)).toBe(300_000);
    });
  });

  describe('enqueue()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('adds an entry with correct nextRetryAt', () => {
      const q = new RetryQueue(300_000);
      const now = Date.now();
      q.enqueue('issue-1', 'session-1', 0);
      const entries = q.all();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.issueId).toBe('issue-1');
      expect(entries[0]!.attempt).toBe(0);
      expect(entries[0]!.nextRetryAt).toBeGreaterThanOrEqual(now + 1_000);
    });

    it('replaces existing entry for the same issueId', () => {
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 'session-1', 0);
      q.enqueue('issue-1', 'session-2', 1);
      expect(q.size).toBe(1);
      expect(q.all()[0]!.attempt).toBe(1);
      expect(q.all()[0]!.sessionId).toBe('session-2');
    });

    it('tracks multiple distinct issues', () => {
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 's1', 0);
      q.enqueue('issue-2', 's2', 1);
      q.enqueue('issue-3', 's3', 2);
      expect(q.size).toBe(3);
    });
  });

  describe('dequeue()', () => {
    it('returns empty array when no entries are ready', () => {
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 's1', 0); // nextRetryAt = now + 1000
      expect(q.dequeue()).toEqual([]);
    });

    it('returns ready entries and removes them', () => {
      jest.useFakeTimers();
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 's1', 0);
      jest.advanceTimersByTime(1_001);
      const ready = q.dequeue();
      expect(ready).toHaveLength(1);
      expect(ready[0]!.issueId).toBe('issue-1');
      expect(q.size).toBe(0);
      jest.useRealTimers();
    });

    it('returns only entries past their nextRetryAt', () => {
      jest.useFakeTimers();
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 's1', 0); // 1000ms delay
      q.enqueue('issue-2', 's2', 3); // 8000ms delay
      jest.advanceTimersByTime(1_001);
      const ready = q.dequeue();
      expect(ready).toHaveLength(1);
      expect(ready[0]!.issueId).toBe('issue-1');
      expect(q.size).toBe(1); // issue-2 still pending
      jest.useRealTimers();
    });

    it('removes dequeued entries so they are not returned again', () => {
      jest.useFakeTimers();
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 's1', 0);
      jest.advanceTimersByTime(2_000);
      q.dequeue();
      expect(q.dequeue()).toEqual([]);
      jest.useRealTimers();
    });
  });

  describe('has()', () => {
    it('returns true when issueId is in queue', () => {
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 's1', 0);
      expect(q.has('issue-1')).toBe(true);
    });

    it('returns false when issueId is not in queue', () => {
      const q = new RetryQueue(300_000);
      expect(q.has('issue-99')).toBe(false);
    });
  });

  describe('remove()', () => {
    it('removes a specific entry', () => {
      const q = new RetryQueue(300_000);
      q.enqueue('issue-1', 's1', 0);
      q.enqueue('issue-2', 's2', 0);
      q.remove('issue-1');
      expect(q.has('issue-1')).toBe(false);
      expect(q.has('issue-2')).toBe(true);
    });

    it('is a no-op when entry does not exist', () => {
      const q = new RetryQueue(300_000);
      expect(() => q.remove('nonexistent')).not.toThrow();
    });
  });

  describe('size', () => {
    it('reports 0 for empty queue', () => {
      const q = new RetryQueue(300_000);
      expect(q.size).toBe(0);
    });

    it('reflects current count', () => {
      const q = new RetryQueue(300_000);
      q.enqueue('i1', 's1', 0);
      q.enqueue('i2', 's2', 0);
      expect(q.size).toBe(2);
      q.remove('i1');
      expect(q.size).toBe(1);
    });
  });
});
