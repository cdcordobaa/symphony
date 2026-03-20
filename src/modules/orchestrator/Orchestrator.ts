import { randomUUID } from 'crypto';
import { RetryQueue } from './RetryQueue.js';
import type {
  OrchestratorConfig,
  Session,
  AgentRunnerFactory,
  LinearClientLike,
  WorkspaceManagerLike,
  LogEntry,
  Issue,
} from './types.js';

/**
 * Orchestrator is the central polling loop and state authority for Symphony.
 *
 * State machine per issue:
 *   IDLE → DISPATCHED → RUNNING → COMPLETED → (retry? → QUEUED → RUNNING)
 *                                 ↓ (terminal state)
 *                               CLEANED_UP
 *
 * Reconciliation on each poll cycle:
 *   1. Fetch active issues from LinearClient
 *   2. For each running session: if issue now terminal/inactive → stop, cleanup
 *   3. For each active issue not running: if under limit → dispatch
 *   4. Drain ready retry entries: if under limit → dispatch
 */
export class Orchestrator {
  private readonly config: OrchestratorConfig;
  private readonly linearClient: LinearClientLike;
  private readonly agentRunnerFactory: AgentRunnerFactory;
  private readonly workspaceManager: WorkspaceManagerLike;
  private readonly retryQueue: RetryQueue;
  private readonly sessions: Map<string, Session> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: OrchestratorConfig,
    linearClient: LinearClientLike,
    agentRunnerFactory: AgentRunnerFactory,
    workspaceManager: WorkspaceManagerLike,
  ) {
    this.config = config;
    this.linearClient = linearClient;
    this.agentRunnerFactory = agentRunnerFactory;
    this.workspaceManager = workspaceManager;
    this.retryQueue = new RetryQueue(config.maxRetryBackoffMs);
  }

  /**
   * Starts the polling loop. Runs one immediate cycle then on the configured interval.
   */
  async start(): Promise<void> {
    await this.pollCycle();
    this.timer = setInterval(() => {
      void this.pollCycle();
    }, this.config.pollingIntervalMs);
  }

  /**
   * Stops the polling loop and kills all running sessions.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const session of this.sessions.values()) {
      if (session.state === 'RUNNING' || session.state === 'DISPATCHED') {
        session.runner.kill();
        this.emit('info', 'session_stopped', session);
      }
    }
    this.sessions.clear();
  }

  /** Returns the count of sessions currently in RUNNING or DISPATCHED state. */
  runningCount(): number {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.state === 'RUNNING' || s.state === 'DISPATCHED') count++;
    }
    return count;
  }

  /** Exposes the retry queue for inspection (tests). */
  get queue(): RetryQueue {
    return this.retryQueue;
  }

  /** Exposes current sessions for inspection (tests). */
  get activeSessions(): ReadonlyMap<string, Session> {
    return this.sessions;
  }

  /**
   * One reconciliation cycle:
   *   1. Fetch active issues
   *   2. Stop sessions for issues no longer active
   *   3. Dispatch new sessions for active issues within concurrency limit
   *   4. Drain ready retry entries within concurrency limit
   */
  async pollCycle(): Promise<void> {
    let activeIssues: Issue[];
    try {
      activeIssues = await this.linearClient.fetchCandidates(
        this.config.projectSlug,
        this.config.activeStates,
      );
    } catch (err) {
      this.log({ level: 'error', event: 'poll_error', issue_id: '', session_id: '', ts: new Date().toISOString(), error: String(err) });
      return;
    }

    const activeIssueIds = new Set(activeIssues.map((i) => i.id));

    // Step 2: Stop sessions for issues no longer active
    for (const session of [...this.sessions.values()]) {
      if (
        (session.state === 'RUNNING' || session.state === 'DISPATCHED') &&
        !activeIssueIds.has(session.issueId)
      ) {
        session.runner.kill();
        session.state = 'CLEANED_UP';
        this.emit('info', 'session_cleaned_up', session);
        try {
          await this.workspaceManager.remove({ id: session.issueId });
        } catch {
          // Best-effort cleanup
        }
        this.sessions.delete(session.issueId);
        // Remove any stale retry entry
        this.retryQueue.remove(session.issueId);
      }
    }

    // Step 3: Dispatch for active issues not currently running and not in retry queue
    for (const issue of activeIssues) {
      if (this.sessions.has(issue.id) || this.retryQueue.has(issue.id)) {
        continue;
      }
      if (this.runningCount() < this.config.maxConcurrentAgents) {
        await this.dispatch(issue, 0);
      }
      // Issues that exceed the limit are naturally picked up on subsequent poll cycles
    }

    // Step 4: Drain ready retry entries
    const ready = this.retryQueue.dequeue();
    for (const entry of ready) {
      if (!activeIssueIds.has(entry.issueId)) {
        // Issue went terminal while in retry queue — skip
        continue;
      }
      if (this.sessions.has(entry.issueId)) {
        // Already dispatched by another path
        continue;
      }
      if (this.runningCount() < this.config.maxConcurrentAgents) {
        const issue = activeIssues.find((i) => i.id === entry.issueId);
        if (issue) {
          await this.dispatch(issue, entry.attempt);
        }
      } else {
        // Re-enqueue with same attempt and delay (immediate re-check on next cycle)
        this.retryQueue.enqueue(entry.issueId, entry.sessionId, entry.attempt);
      }
    }
  }

  /** Dispatches a new agent session for the given issue. */
  private async dispatch(issue: Issue, attempt: number): Promise<void> {
    const sessionId = randomUUID();
    let workspacePath: string;

    try {
      workspacePath = await this.workspaceManager.create({ id: issue.id });
    } catch (err) {
      this.log({
        level: 'error',
        event: 'workspace_create_error',
        issue_id: issue.id,
        session_id: sessionId,
        ts: new Date().toISOString(),
        error: String(err),
      });
      return;
    }

    const runner = this.agentRunnerFactory(issue.id);

    const session: Session = {
      issueId: issue.id,
      sessionId,
      issue,
      workspacePath,
      attempt,
      state: 'DISPATCHED',
      runner,
    };

    this.sessions.set(issue.id, session);
    this.emit('info', 'session_dispatched', session);

    // Wire up runner lifecycle events
    runner.on('turn_complete', () => {
      if (session.state !== 'RUNNING' && session.state !== 'DISPATCHED') return;
      session.state = 'COMPLETED';
      this.emit('info', 'session_completed', session);
      void this.onSessionComplete(session);
    });

    runner.on('error', (err) => {
      if (session.state === 'CLEANED_UP') return;
      session.state = 'COMPLETED';
      this.log({
        level: 'error',
        event: 'session_error',
        issue_id: session.issueId,
        session_id: session.sessionId,
        ts: new Date().toISOString(),
        error: String(err),
      });
      void this.cleanup(session);
    });

    runner.on('stall_timeout', (info) => {
      if (session.state === 'CLEANED_UP') return;
      session.state = 'COMPLETED';
      this.log({
        level: 'warn',
        event: 'session_stall_timeout',
        issue_id: session.issueId,
        session_id: session.sessionId,
        ts: new Date().toISOString(),
        info,
      });
      void this.cleanup(session);
    });

    try {
      await runner.start(
        {
          identifier: issue.identifier,
          title: issue.title,
          state: issue.state,
          description: issue.description,
          labels: issue.labels,
          blockers: issue.blockers.map((b) => b.identifier),
        },
        attempt,
        workspacePath,
        this.config.promptTemplate,
      );
      session.state = 'RUNNING';
      this.emit('info', 'session_running', session);
    } catch (err) {
      this.log({
        level: 'error',
        event: 'session_start_error',
        issue_id: session.issueId,
        session_id: session.sessionId,
        ts: new Date().toISOString(),
        error: String(err),
      });
      this.sessions.delete(session.issueId);
      try {
        await this.workspaceManager.remove({ id: session.issueId });
      } catch {
        // Best-effort
      }
    }
  }

  /**
   * Called when a session completes normally (turn_complete).
   * Re-fetches issue state: if still active → enqueue retry; else → cleanup.
   */
  private async onSessionComplete(session: Session): Promise<void> {
    let currentIssue: Issue;
    try {
      currentIssue = await this.linearClient.fetchIssue(session.issueId);
    } catch (err) {
      this.log({
        level: 'error',
        event: 'fetch_issue_error',
        issue_id: session.issueId,
        session_id: session.sessionId,
        ts: new Date().toISOString(),
        error: String(err),
      });
      await this.cleanup(session);
      return;
    }

    const isActive = this.config.activeStates.includes(currentIssue.state);

    if (isActive) {
      this.retryQueue.enqueue(session.issueId, session.sessionId, session.attempt + 1);
      this.sessions.delete(session.issueId);
      this.emit('info', 'session_queued_retry', session);
    } else {
      await this.cleanup(session);
    }
  }

  /** Removes workspace and session record; logs cleaned_up. */
  private async cleanup(session: Session): Promise<void> {
    this.sessions.delete(session.issueId);
    session.state = 'CLEANED_UP';
    this.emit('info', 'session_cleaned_up', session);
    try {
      await this.workspaceManager.remove({ id: session.issueId });
    } catch {
      // Best-effort
    }
  }

  /** Emits a structured JSON log entry to stdout. */
  private emit(level: 'info' | 'warn' | 'error', event: string, session: Session, extra?: Record<string, unknown>): void {
    this.log({
      level,
      event,
      issue_id: session.issueId,
      session_id: session.sessionId,
      ts: new Date().toISOString(),
      ...extra,
    });
  }

  /** Writes a structured JSON log entry to stdout. */
  private log(entry: LogEntry): void {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
