export interface IssueContext {
  identifier: string;
  title: string;
  state: string;
  description?: string;
  labels?: string[];
  blockers?: string[];
}

export interface AgentRunnerConfig {
  /** Shell command to launch the agent (default: "codex app-server") */
  command?: string;
  /** Approval policy forwarded in the initialize message (e.g. "auto-edit") */
  approvalPolicy?: string;
  /** Milliseconds after turn/start before killing a stalled agent (default: 300000) */
  stallTimeoutMs?: number;
}

export interface JsonLineMessage {
  type: string;
  [key: string]: unknown;
}
