import { defineFeature, loadFeature } from 'jest-cucumber';
import { EventEmitter } from 'events';
import { Orchestrator } from '../../src/modules/orchestrator/Orchestrator';
import { RetryQueue } from '../../src/modules/orchestrator/RetryQueue';
import type {
  OrchestratorConfig,
  LinearClientLike,
  WorkspaceManagerLike,
  AgentRunnerFactory,
  AgentRunnerLike,
  Issue,
} from '../../src/modules/orchestrator/types';

const feature = loadFeature('./features/orchestration_loop.feature');

// ── Shared helpers ────────────────────────────────────────────────────────────

function makeIssue(identifier: string, state = 'In Progress'): Issue {
  return {
    id: identifier.toLowerCase().replace('-', ''),
    identifier,
    title: `Issue ${identifier}`,
    description: 'desc',
    state,
    labels: [],
    blockers: [],
  };
}

class MockRunner extends EventEmitter implements AgentRunnerLike {
  killCalled = false;
  async start(): Promise<void> { /* noop */ }
  kill(): void { this.killCalled = true; }
}

// ── Feature definition ────────────────────────────────────────────────────────

defineFeature(feature, (test) => {
  let orchestrator: Orchestrator;
  let linearClient: jest.Mocked<LinearClientLike>;
  let workspaceManager: jest.Mocked<WorkspaceManagerLike>;
  let runnerMap: Map<string, MockRunner>;
  let config: OrchestratorConfig;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    runnerMap = new Map();
    workspaceManager = {
      create: jest.fn().mockResolvedValue('/tmp/ws'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    linearClient = {
      fetchCandidates: jest.fn().mockResolvedValue([]),
      fetchIssue: jest.fn().mockResolvedValue(makeIssue('SYM-0')),
    };
  });

  afterEach(() => {
    orchestrator?.stop();
    jest.useRealTimers();
    stdoutSpy.mockRestore();
    jest.clearAllMocks();
  });

  function buildOrchestrator(overrides: Partial<OrchestratorConfig> = {}): void {
    config = {
      pollingIntervalMs: overrides.pollingIntervalMs ?? 1_000,
      maxConcurrentAgents: overrides.maxConcurrentAgents ?? 2,
      maxRetryBackoffMs: overrides.maxRetryBackoffMs ?? 5_000,
      activeStates: ['In Progress', 'Todo'],
      terminalStates: ['Done', 'Cancelled'],
      projectSlug: 'SYM',
      promptTemplate: 'Hello {{ issue.identifier }}',
      ...overrides,
    };
    const factory: AgentRunnerFactory = (issueId) => {
      const r = new MockRunner();
      runnerMap.set(issueId, r);
      return r;
    };
    orchestrator = new Orchestrator(config, linearClient, factory, workspaceManager);
  }

  // ── Scenario 1: Dispatch up to concurrency limit ──────────────────────────

  test('Dispatch sessions up to the concurrency limit', ({
    given,
    and,
    when,
    then,
  }) => {
    given(/^the orchestrator is configured with max (\d+) concurrent agents$/, (max: string) => {
      buildOrchestrator({ maxConcurrentAgents: parseInt(max, 10) });
    });

    and(/^the polling interval is (\d+)ms$/, (_interval: string) => { /* already set */ });

    and(/^the max retry backoff is (\d+)ms$/, (_ms: string) => { /* already set */ });

    given(/^(\d+) active issues exist: "(.*)", "(.*)", "(.*)"$/, (_count: string, id1: string, id2: string, id3: string) => {
      const issues = [makeIssue(id1), makeIssue(id2), makeIssue(id3)];
      (linearClient.fetchCandidates as jest.Mock).mockResolvedValue(issues);
    });

    and('no sessions are currently running', () => {
      // Default state — no sessions
    });

    when('a poll cycle runs', async () => {
      await orchestrator.pollCycle();
    });

    then(/^exactly (\d+) sessions should be dispatched$/, (count: string) => {
      expect(orchestrator.runningCount()).toBe(parseInt(count, 10));
    });

    and(/"(.*)" should remain undispatched/, (identifier: string) => {
      const id = identifier.toLowerCase().replace('-', '');
      expect(runnerMap.has(id)).toBe(false);
    });
  });

  // ── Scenario 2: Stop session on terminal state ────────────────────────────

  test('Stop session when issue reaches terminal state', ({
    given,
    and,
    when,
    then,
  }) => {
    given(/^the orchestrator is configured with max (\d+) concurrent agents$/, (max: string) => {
      buildOrchestrator({ maxConcurrentAgents: parseInt(max, 10) });
    });

    and(/^the polling interval is (\d+)ms$/, (_interval: string) => { /* noop */ });

    and(/^the max retry backoff is (\d+)ms$/, (_ms: string) => { /* noop */ });

    given(/^a running session exists for issue "(.*)"$/, async (identifier: string) => {
      const issue = makeIssue(identifier);
      (linearClient.fetchCandidates as jest.Mock).mockResolvedValue([issue]);
      await orchestrator.pollCycle();
      expect(orchestrator.runningCount()).toBe(1);
    });

    and(/"(.*)" is no longer in the active issues list/, (_identifier: string) => {
      (linearClient.fetchCandidates as jest.Mock).mockResolvedValue([]);
    });

    when('a poll cycle runs', async () => {
      await orchestrator.pollCycle();
    });

    then(/^the runner for "(.*)" should be killed$/, (identifier: string) => {
      const id = identifier.toLowerCase().replace('-', '');
      expect(runnerMap.get(id)!.killCalled).toBe(true);
    });

    and(/^the workspace for "(.*)" should be removed$/, (identifier: string) => {
      const id = identifier.toLowerCase().replace('-', '');
      expect(workspaceManager.remove).toHaveBeenCalledWith({ id });
    });

    and(/^the session for "(.*)" should be cleaned up$/, (_identifier: string) => {
      expect(orchestrator.runningCount()).toBe(0);
    });
  });

  // ── Scenario 3: Retry with exponential backoff ────────────────────────────

  test('Retry completed session with exponential backoff', ({
    given,
    and,
    when,
    then,
  }) => {
    let completedIssueId: string;

    given(/^the orchestrator is configured with max (\d+) concurrent agents$/, (max: string) => {
      buildOrchestrator({ maxConcurrentAgents: parseInt(max, 10), maxRetryBackoffMs: 5_000 });
    });

    and(/^the polling interval is (\d+)ms$/, (_interval: string) => { /* noop */ });

    and(/^the max retry backoff is (\d+)ms$/, (_ms: string) => { /* noop */ });

    given(/^a completed session for issue "(.*)" with attempt (\d+)$/, async (identifier: string, _attempt: string) => {
      completedIssueId = identifier.toLowerCase().replace('-', '');
      const issue = makeIssue(identifier, 'In Progress');
      (linearClient.fetchCandidates as jest.Mock).mockResolvedValue([issue]);
      (linearClient.fetchIssue as jest.Mock).mockResolvedValue(issue);
      await orchestrator.pollCycle();
    });

    and(/"(.*)" is still in the active issues list/, (_identifier: string) => {
      // fetchIssue already returns active issue
    });

    when('the session completes', async () => {
      runnerMap.get(completedIssueId)!.emit('turn_complete');
      await Promise.resolve();
      await Promise.resolve();
    });

    then(/"(.*)" should be enqueued in the retry queue/, (identifier: string) => {
      const id = identifier.toLowerCase().replace('-', '');
      expect(orchestrator.queue.has(id)).toBe(true);
    });

    and(/^the retry delay for attempt (\d+) should be (\d+)ms$/, (attempt: string, delay: string) => {
      const q = new RetryQueue(5_000);
      expect(q.computeDelay(parseInt(attempt, 10))).toBe(parseInt(delay, 10));
    });

    and(/^the retry delay for attempt (\d+) should be (\d+)ms$/, (attempt: string, delay: string) => {
      const q = new RetryQueue(5_000);
      expect(q.computeDelay(parseInt(attempt, 10))).toBe(parseInt(delay, 10));
    });

    and(/^the retry delay for attempt (\d+) should be (\d+)ms$/, (attempt: string, delay: string) => {
      const q = new RetryQueue(5_000);
      expect(q.computeDelay(parseInt(attempt, 10))).toBe(parseInt(delay, 10));
    });

    and(/^the retry delay for attempt (\d+) should be capped at (\d+)ms$/, (attempt: string, delay: string) => {
      const q = new RetryQueue(5_000);
      expect(q.computeDelay(parseInt(attempt, 10))).toBe(parseInt(delay, 10));
    });
  });

  // ── Scenario 4: Concurrency queue drain ──────────────────────────────────

  test('Concurrency queue drains as slots free up', ({
    given,
    and,
    when,
    then,
  }) => {
    // Background steps (prepended by jest-cucumber)
    given(/^the orchestrator is configured with max (\d+) concurrent agents$/, (max: string) => {
      buildOrchestrator({ maxConcurrentAgents: parseInt(max, 10) });
    });

    and(/^the polling interval is (\d+)ms$/, (_interval: string) => { /* noop */ });

    and(/^the max retry backoff is (\d+)ms$/, (_ms: string) => { /* noop */ });

    // Scenario steps
    given(/^the concurrency limit is (\d+)$/, (_limit: string) => {
      // Concurrency limit already set via Background step above
    });

    and(/^(\d+) sessions are currently running for "(.*)" and "(.*)"$/, async (_count: string, id1: string, id2: string) => {
      const issues = [makeIssue(id1), makeIssue(id2)];
      (linearClient.fetchCandidates as jest.Mock).mockResolvedValue(issues);
      await orchestrator.pollCycle();
      expect(orchestrator.runningCount()).toBe(2);
    });

    and(/^(\d+) active issue "(.*)" is waiting for a slot$/, (_count: string, id3: string) => {
      const currentIssues = [makeIssue('SYM-30'), makeIssue('SYM-31'), makeIssue(id3)];
      (linearClient.fetchCandidates as jest.Mock).mockResolvedValue(currentIssues);
    });

    when('one running session completes and frees a slot', async () => {
      // sym30 runner key (makeIssue 'SYM-30' → id='sym30')
      const r30 = runnerMap.get('sym30')!;
      (linearClient.fetchIssue as jest.Mock).mockResolvedValue(makeIssue('SYM-30', 'Done'));
      r30.emit('turn_complete');
      await Promise.resolve();
      await Promise.resolve();
      // SYM-30 is now Done — exclude it from subsequent fetchCandidates results
      (linearClient.fetchCandidates as jest.Mock).mockResolvedValue([makeIssue('SYM-31'), makeIssue('SYM-32')]);
    });

    and('a poll cycle runs', async () => {
      await orchestrator.pollCycle();
    });

    then(/"(.*)" should be dispatched/, (identifier: string) => {
      const id = identifier.toLowerCase().replace('-', '');
      expect(runnerMap.has(id)).toBe(true);
    });
  });
});
