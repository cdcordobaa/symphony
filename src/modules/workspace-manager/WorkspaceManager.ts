import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { HookRunner } from "./HookRunner.js";

export interface Issue {
  id: string;
  hooks?: {
    after_create?: string;
    before_run?: string;
    after_run?: string;
    before_remove?: string;
  };
}

export interface WorkspaceManagerConfig {
  root?: string;
  hookRunner?: HookRunner;
  hooksTimeoutMs?: number;
}

export function sanitizeIssueId(issueId: string): string {
  // Replace any character that is not alphanumeric, dash, or underscore with a dash,
  // then collapse consecutive dashes and strip leading/trailing dashes.
  return issueId
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export class WorkspaceManager {
  private readonly root: string;
  private readonly hookRunner: HookRunner;
  private readonly hooksTimeoutMs: number;

  constructor(config: WorkspaceManagerConfig = {}) {
    this.root = config.root ?? path.join(os.homedir(), "symphony-workspaces");
    this.hookRunner = config.hookRunner ?? new HookRunner();
    this.hooksTimeoutMs = config.hooksTimeoutMs ?? 60000;
  }

  workspacePath(issue: Issue): string {
    return path.join(this.root, sanitizeIssueId(issue.id));
  }

  /**
   * Create the workspace directory for `issue` and run the `after_create` hook.
   */
  async create(issue: Issue): Promise<string> {
    const wsPath = this.workspacePath(issue);
    fs.mkdirSync(wsPath, { recursive: true });

    const hookScript = issue.hooks?.after_create;
    if (hookScript) {
      await this.hookRunner.exec(hookScript, wsPath, this.hooksTimeoutMs);
    }

    return wsPath;
  }

  /**
   * Run the `before_remove` hook then delete the workspace directory.
   */
  async remove(issue: Issue): Promise<void> {
    const wsPath = this.workspacePath(issue);

    const hookScript = issue.hooks?.before_remove;
    if (hookScript && fs.existsSync(wsPath)) {
      try {
        await this.hookRunner.exec(hookScript, wsPath, this.hooksTimeoutMs);
      } catch {
        // Log but continue with removal even if hook fails
      }
    }

    if (fs.existsSync(wsPath)) {
      fs.rmSync(wsPath, { recursive: true, force: true });
    }
  }
}
