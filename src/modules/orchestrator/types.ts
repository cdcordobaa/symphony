import type { Issue } from '../linear-client/types.js';
import type { IssueContext } from '../agent-runner/types.js';

export type { Issue, IssueContext };

/** Lifecycle state for a single agent session. */
export type SessionState =
  | 'DISPATCHED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'QUEUED'
  | 'CLEANED_UP';

/** Minimal interface for an agent runner (injectable for testing). */
export interface AgentRunnerLike {
  start(
    issue: IssueContext,
    attempt: number,
    workspacePath: string,
    promptTemplate: string,
  ): Promise<void>;
  kill(): void;
  on(event: 'turn_complete', handler: () => void): this;
  on(event: 'error', handler: (err: unknown) => void): this;
  on(event: 'stall_timeout', handler: (info: unknown) => void): this;
  on(event: string, handler: (...args: unknown[]) => void): this;
}

/** Minimal interface for workspace management (injectable for testing). */
export interface WorkspaceManagerLike {
  create(issue: { id: string }): Promise<string>;
  remove(issue: { id: string }): Promise<void>;
}

/** Minimal interface for Linear client (injectable for testing). */
export interface LinearClientLike {
  fetchCandidates(projectSlug: string, activeStates: string[]): Promise<Issue[]>;
  fetchIssue(id: string): Promise<Issue>;
}

/** Factory that produces an AgentRunnerLike for a given issue. */
export type AgentRunnerFactory = (issueId: string) => AgentRunnerLike;

/** Configuration for the Orchestrator. */
export interface OrchestratorConfig {
  /** Milliseconds between poll cycles (from polling.interval_ms). */
  pollingIntervalMs: number;
  /** Maximum number of concurrently running agent sessions. */
  maxConcurrentAgents: number;
  /** Maximum retry backoff in milliseconds (from agent.max_retry_backoff_ms). Default 300000. */
  maxRetryBackoffMs: number;
  /** Issue states considered "active" (should have an agent running). */
  activeStates: string[];
  /** Issue states considered "terminal" (agent should be stopped). */
  terminalStates: string[];
  /** Linear project slug used to query issues. */
  projectSlug: string;
  /** Liquid template string used as the agent prompt (WORKFLOW.md body). */
  promptTemplate: string;
}

/** An active or recently completed agent session. */
export interface Session {
  issueId: string;
  sessionId: string;
  issue: Issue;
  workspacePath: string;
  attempt: number;
  state: SessionState;
  runner: AgentRunnerLike;
}

/** An entry in the retry queue. */
export interface RetryEntry {
  issueId: string;
  sessionId: string;
  attempt: number;
  nextRetryAt: number; // epoch ms
}

/** Structured log fields emitted for every state transition. */
export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  event: string;
  issue_id: string;
  session_id: string;
  ts: string;
  [key: string]: unknown;
}
