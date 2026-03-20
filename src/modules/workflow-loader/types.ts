export interface TrackerConfig {
  type?: string;
  project?: string;
  [key: string]: unknown;
}

export interface PollingConfig {
  interval?: number;
  [key: string]: unknown;
}

export interface WorkspaceConfig {
  path?: string;
  [key: string]: unknown;
}

export interface HooksConfig {
  [key: string]: string | string[];
}

export interface AgentConfig {
  model?: string;
  [key: string]: unknown;
}

export interface CodexConfig {
  [key: string]: unknown;
}

export interface ServerConfig {
  port?: number;
  [key: string]: unknown;
}

export interface WorkflowConfig {
  tracker?: TrackerConfig;
  polling?: PollingConfig;
  workspace?: WorkspaceConfig;
  hooks?: HooksConfig;
  agent?: AgentConfig;
  codex?: CodexConfig;
  server?: ServerConfig;
  [key: string]: unknown;
}
