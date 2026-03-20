import type { RetryEntry } from './types.js';

const BASE_DELAY_MS = 1_000;

/**
 * RetryQueue implements exponential backoff scheduling for completed agent sessions.
 *
 * Backoff formula: min(BASE_DELAY_MS * 2^attempt, maxRetryBackoffMs)
 * Default max backoff: 300,000 ms (5 minutes).
 */
export class RetryQueue {
  private readonly maxRetryBackoffMs: number;
  private readonly entries: Map<string, RetryEntry> = new Map();

  constructor(maxRetryBackoffMs = 300_000) {
    this.maxRetryBackoffMs = maxRetryBackoffMs;
  }

  /**
   * Computes the backoff delay for a given attempt number.
   * Capped at maxRetryBackoffMs.
   */
  computeDelay(attempt: number): number {
    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    return Math.min(delay, this.maxRetryBackoffMs);
  }

  /**
   * Enqueues an issue for retry. If an entry already exists for the issueId it is replaced.
   */
  enqueue(issueId: string, sessionId: string, attempt: number): void {
    const delay = this.computeDelay(attempt);
    const nextRetryAt = Date.now() + delay;
    this.entries.set(issueId, { issueId, sessionId, attempt, nextRetryAt });
  }

  /**
   * Returns all entries whose nextRetryAt is <= now and removes them from the queue.
   */
  dequeue(): RetryEntry[] {
    const now = Date.now();
    const ready: RetryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.nextRetryAt <= now) {
        ready.push(entry);
        this.entries.delete(entry.issueId);
      }
    }
    return ready;
  }

  /** Returns true if the issueId has a pending retry entry. */
  has(issueId: string): boolean {
    return this.entries.has(issueId);
  }

  /** Removes a specific entry from the queue (e.g. if issue went terminal). */
  remove(issueId: string): void {
    this.entries.delete(issueId);
  }

  /** Returns all pending entries (for inspection / testing). */
  all(): RetryEntry[] {
    return [...this.entries.values()];
  }

  /** Returns the number of pending entries. */
  get size(): number {
    return this.entries.size;
  }
}
