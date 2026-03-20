import { EventEmitter } from 'events';
import { Orchestrator } from '../Orchestrator';
import type {
  OrchestratorConfig,
  LinearClientLike,
  WorkspaceManagerLike,
  AgentRunnerFactory,
  AgentRunnerLike,
  Issue,
} from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeIssue(id: string, identifier: string, state = 'In Progress'): Issue {
  return {
    id,
    identifier,
    title: `Issue ${identifier}`,
    description: 'desc',
    state,
    labels: [],
    blockers: [],
  };
}

function makeConfig(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    pollingIntervalMs: 5_000,
    maxConcurrentAgents: 2,
    maxRetryBackoffMs: 5_000,
    activeStates: ['In Progress', 'Todo'],
    terminalStates: ['Done', 'Cancelled'],
    projectSlug: 'SYM',
    promptTemplate: 'Hello {{ issue.identifier }}',
    ...overrides,
  };
}

class MockRunner extends EventEmitter implements AgentRunnerLike {
  startCalled = false;
  killCalled = false;

  async start(): Promise<void> {
    this.startCalled = true;
  }

  kill(): void {
    this.killCalled = true;
  }
}

function makeRunnerFactory(): { factory: AgentRunnerFactory; runners: Map<string, MockRunner> } {
  const runners = new Map<string, MockRunner>();
  const factory: AgentRunnerFactory = (issueId) => {
    const r = new MockRunner();
    runners.set(issueId, r);
    return r;
  };
  return { factory, runners };
}

function makeWorkspaceManager(): jest.Mocked<WorkspaceManagerLike> {
  return {
    create: jest.fn().mockResolvedValue('/tmp/workspace'),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

function makeLinearClient(activeIssues: Issue[], fetchIssueResult?: Issue): jest.Mocked<LinearClientLike> {
  return {
    fetchCandidates: jest.fn().mockResolvedValue(activeIssues),
    fetchIssue: jest.fn().mockResolvedValue(fetchIssueResult ?? activeIssues[0] ?? makeIssue('x', 'X')),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Orchestrator', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.useRealTimers();
    stdoutSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ── FR 5.1: Polling loop ──────────────────────────────────────────────────

  describe('FR 5.1 – polling loop', () => {
    it('calls fetchCandidates on start', async () => {
      const issues = [makeIssue('i1', 'SYM-1')];
      const client = makeLinearClient(issues);
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.start();
      orch.stop();

      expect(client.fetchCandidates).toHaveBeenCalledWith('SYM', ['In Progress', 'Todo']);
    });

    it('triggers additional poll cycles on interval', async () => {
      const issues = [makeIssue('i1', 'SYM-1')];
      const client = makeLinearClient(issues);
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig({ pollingIntervalMs: 1_000 }), client, factory, ws);

      await orch.start();
      // Advance past the interval multiple times
      jest.advanceTimersByTime(3_000);
      orch.stop();

      // Initial call + 3 interval calls = 4
      expect(client.fetchCandidates.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── FR 5.2: Concurrency limit ─────────────────────────────────────────────

  describe('FR 5.2 – concurrency limit', () => {
    it('dispatches at most maxConcurrentAgents sessions', async () => {
      const issues = [
        makeIssue('i1', 'SYM-1'),
        makeIssue('i2', 'SYM-2'),
        makeIssue('i3', 'SYM-3'),
      ];
      const client = makeLinearClient(issues);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig({ maxConcurrentAgents: 2 }), client, factory, ws);

      await orch.pollCycle();

      // Only 2 runners should have been created
      expect(runners.size).toBe(2);
      expect(orch.runningCount()).toBe(2);
    });

    it('dispatches remaining issue on next cycle when a slot opens', async () => {
      const issue1 = makeIssue('i1', 'SYM-1');
      const issue2 = makeIssue('i2', 'SYM-2');
      const issue3 = makeIssue('i3', 'SYM-3');
      const client = makeLinearClient([issue1, issue2, issue3]);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig({ maxConcurrentAgents: 2 }), client, factory, ws);

      await orch.pollCycle(); // dispatches SYM-1, SYM-2
      expect(orch.runningCount()).toBe(2);

      // Simulate SYM-1 completing and going terminal
      const r1 = runners.get('i1')!;
      const fetchIssueMock = client.fetchIssue as jest.MockedFunction<typeof client.fetchIssue>;
      fetchIssueMock.mockResolvedValue(makeIssue('i1', 'SYM-1', 'Done'));
      r1.emit('turn_complete');

      // Allow async callbacks to resolve
      await Promise.resolve();
      await Promise.resolve();

      // SYM-1 session should be cleaned up
      expect(orch.runningCount()).toBe(1);

      // Update fetchCandidates: SYM-1 is Done (not active), SYM-2 still running, SYM-3 still waiting
      (client.fetchCandidates as jest.Mock).mockResolvedValue([issue2, issue3]);

      // Next cycle should dispatch SYM-3
      await orch.pollCycle();
      expect(runners.has('i3')).toBe(true);
    });

    it('does not exceed concurrency limit even with many issues', async () => {
      const issues = Array.from({ length: 10 }, (_, i) => makeIssue(`i${i}`, `SYM-${i}`));
      const client = makeLinearClient(issues);
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig({ maxConcurrentAgents: 3 }), client, factory, ws);

      await orch.pollCycle();

      expect(orch.runningCount()).toBe(3);
    });
  });

  // ── FR 5.3: Retry with exponential backoff ────────────────────────────────

  describe('FR 5.3 – retry queue with exponential backoff', () => {
    it('enqueues retry when completed session issue is still active', async () => {
      const issue = makeIssue('i1', 'SYM-1', 'In Progress');
      const client = makeLinearClient([issue], issue); // fetchIssue returns same active issue
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig({ maxConcurrentAgents: 2 }), client, factory, ws);

      await orch.pollCycle();
      expect(runners.has('i1')).toBe(true);

      // Emit turn_complete while issue is still active
      runners.get('i1')!.emit('turn_complete');
      await Promise.resolve();
      await Promise.resolve();

      expect(orch.queue.has('i1')).toBe(true);
    });

    it('does NOT enqueue retry when completed session issue is terminal', async () => {
      const issue = makeIssue('i1', 'SYM-1', 'In Progress');
      const doneIssue = makeIssue('i1', 'SYM-1', 'Done');
      const client = makeLinearClient([issue], doneIssue);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();
      runners.get('i1')!.emit('turn_complete');
      await Promise.resolve();
      await Promise.resolve();

      expect(orch.queue.has('i1')).toBe(false);
      expect(ws.remove).toHaveBeenCalledWith({ id: 'i1' });
    });

    it('dispatches retry entry after backoff delay elapses', async () => {
      const issue = makeIssue('i1', 'SYM-1', 'In Progress');
      const client = makeLinearClient([issue], issue);
      let createCallCount = 0;
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      // Track workspace create calls as a proxy for dispatch count
      (ws.create as jest.Mock).mockImplementation(async () => {
        createCallCount++;
        return '/tmp/ws';
      });
      const orch = new Orchestrator(makeConfig({ maxRetryBackoffMs: 5_000 }), client, factory, ws);

      // Dispatch and complete first session (createCallCount = 1)
      await orch.pollCycle();
      expect(createCallCount).toBe(1);

      const runners = new Map<string, MockRunner>();
      // We need to re-get the runner; the factory map is captured in factory closure
      // Instead, access via activeSessions
      const session = [...orch.activeSessions.values()][0]!;
      (session.runner as MockRunner).emit('turn_complete');
      await Promise.resolve();
      await Promise.resolve();

      expect(orch.queue.has('i1')).toBe(true);

      // Poll again before backoff elapses — should not re-dispatch
      await orch.pollCycle();
      expect(createCallCount).toBe(1); // no new dispatch

      // Advance past the retry delay (attempt 1 = 2000ms)
      jest.advanceTimersByTime(2_001);
      await orch.pollCycle();

      expect(createCallCount).toBe(2); // retry dispatched
    });

    it('uses exponential backoff for successive retries', async () => {
      const { RetryQueue } = await import('../RetryQueue');
      const q = new RetryQueue(300_000);
      expect(q.computeDelay(0)).toBe(1_000);
      expect(q.computeDelay(1)).toBe(2_000);
      expect(q.computeDelay(2)).toBe(4_000);
      expect(q.computeDelay(3)).toBe(8_000);
    });

    it('caps backoff at maxRetryBackoffMs', async () => {
      const { RetryQueue } = await import('../RetryQueue');
      const q = new RetryQueue(5_000);
      // attempt 3 would be 8000ms but capped at 5000
      expect(q.computeDelay(3)).toBe(5_000);
      expect(q.computeDelay(10)).toBe(5_000);
    });
  });

  // ── State machine transitions ─────────────────────────────────────────────

  describe('session state machine', () => {
    it('transitions: DISPATCHED → RUNNING after runner.start resolves', async () => {
      const issue = makeIssue('i1', 'SYM-1');
      const client = makeLinearClient([issue]);
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();

      const session = orch.activeSessions.get('i1');
      expect(session?.state).toBe('RUNNING');
    });

    it('transitions: RUNNING → CLEANED_UP when issue leaves active set', async () => {
      const issue = makeIssue('i1', 'SYM-1');

      const client = makeLinearClient([issue]);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();
      expect(orch.runningCount()).toBe(1);

      // Next cycle: issue gone terminal — fetchCandidates returns [] (Done issues excluded by activeStates filter)
      (client.fetchCandidates as jest.Mock).mockResolvedValue([]);
      await orch.pollCycle();

      expect(orch.runningCount()).toBe(0);
      expect(runners.get('i1')!.killCalled).toBe(true);
      expect(ws.remove).toHaveBeenCalledWith({ id: 'i1' });
    });

    it('kills all running sessions on stop()', async () => {
      const issues = [makeIssue('i1', 'SYM-1'), makeIssue('i2', 'SYM-2')];
      const client = makeLinearClient(issues);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();
      orch.stop();

      expect(runners.get('i1')!.killCalled).toBe(true);
      expect(runners.get('i2')!.killCalled).toBe(true);
    });
  });

  // ── Structured logging ────────────────────────────────────────────────────

  describe('structured JSON logging', () => {
    it('emits session_dispatched log on dispatch', async () => {
      const issue = makeIssue('i1', 'SYM-1');
      const client = makeLinearClient([issue]);
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();

      const calls = (stdoutSpy.mock.calls as [string][])
        .map((c) => JSON.parse(c[0]!.trim()) as Record<string, unknown>);
      const dispatched = calls.find((l) => l['event'] === 'session_dispatched');
      expect(dispatched).toBeDefined();
      expect(dispatched!['issue_id']).toBe('i1');
      expect(dispatched!['session_id']).toBeDefined();
      expect(dispatched!['ts']).toBeDefined();
      expect(dispatched!['level']).toBe('info');
    });

    it('emits session_cleaned_up log when issue goes terminal', async () => {
      const issue = makeIssue('i1', 'SYM-1');
      const client = makeLinearClient([issue]);
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();
      (client.fetchCandidates as jest.Mock).mockResolvedValue([]);
      await orch.pollCycle();

      const calls = (stdoutSpy.mock.calls as [string][])
        .map((c) => JSON.parse(c[0]!.trim()) as Record<string, unknown>);
      const cleaned = calls.find((l) => l['event'] === 'session_cleaned_up');
      expect(cleaned).toBeDefined();
      expect(cleaned!['issue_id']).toBe('i1');
    });

    it('emits session_queued_retry log when retry is enqueued', async () => {
      const issue = makeIssue('i1', 'SYM-1', 'In Progress');
      const client = makeLinearClient([issue], issue);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();
      runners.get('i1')!.emit('turn_complete');
      await Promise.resolve();
      await Promise.resolve();

      const calls = (stdoutSpy.mock.calls as [string][])
        .map((c) => JSON.parse(c[0]!.trim()) as Record<string, unknown>);
      const queued = calls.find((l) => l['event'] === 'session_queued_retry');
      expect(queued).toBeDefined();
      expect(queued!['issue_id']).toBe('i1');
    });
  });

  // ── Error resilience ──────────────────────────────────────────────────────

  describe('error resilience', () => {
    it('continues polling after fetchCandidates throws', async () => {
      const client = makeLinearClient([]);
      (client.fetchCandidates as jest.Mock).mockRejectedValueOnce(new Error('network fail'));
      const { factory } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await expect(orch.pollCycle()).resolves.not.toThrow();
    });

    it('cleans up session on runner error event', async () => {
      const issue = makeIssue('i1', 'SYM-1');
      const client = makeLinearClient([issue]);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();
      runners.get('i1')!.emit('error', new Error('agent crashed'));
      await Promise.resolve();

      expect(orch.runningCount()).toBe(0);
    });

    it('cleans up session on stall_timeout event', async () => {
      const issue = makeIssue('i1', 'SYM-1');
      const client = makeLinearClient([issue]);
      const { factory, runners } = makeRunnerFactory();
      const ws = makeWorkspaceManager();
      const orch = new Orchestrator(makeConfig(), client, factory, ws);

      await orch.pollCycle();
      runners.get('i1')!.emit('stall_timeout', {});
      await Promise.resolve();

      expect(orch.runningCount()).toBe(0);
    });
  });
});
