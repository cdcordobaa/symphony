import type {
  AgentConfig,
  CodexConfig,
  HooksConfig,
  PollingConfig,
  ServerConfig,
  TrackerConfig,
  WorkflowConfig,
  WorkspaceConfig,
} from './types';

/**
 * ConfigLayer provides typed, ergonomic access to values within a WorkflowConfig.
 * All env var resolution happens at parse time in WorkflowLoader; ConfigLayer is
 * a pure read-only accessor.
 */
export class ConfigLayer {
  constructor(private readonly config: WorkflowConfig) {}

  /** Returns the tracker section of the config. */
  getTracker(): TrackerConfig | undefined {
    return this.config.tracker;
  }

  /** Returns the polling section of the config. */
  getPolling(): PollingConfig | undefined {
    return this.config.polling;
  }

  /** Returns the workspace section of the config. */
  getWorkspace(): WorkspaceConfig | undefined {
    return this.config.workspace;
  }

  /** Returns the resolved workspace path string, if set. */
  getWorkspacePath(): string | undefined {
    return this.config.workspace?.path;
  }

  /** Returns the hooks section of the config. */
  getHooks(): HooksConfig | undefined {
    return this.config.hooks;
  }

  /** Returns the agent section of the config. */
  getAgent(): AgentConfig | undefined {
    return this.config.agent;
  }

  /** Returns the codex section of the config. */
  getCodex(): CodexConfig | undefined {
    return this.config.codex;
  }

  /** Returns the server section of the config. */
  getServer(): ServerConfig | undefined {
    return this.config.server;
  }

  /** Returns the server port number, if set. */
  getServerPort(): number | undefined {
    return this.config.server?.port;
  }

  /** Returns the full raw WorkflowConfig object. */
  getRaw(): WorkflowConfig {
    return this.config;
  }
}
