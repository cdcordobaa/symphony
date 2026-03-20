import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { ProtocolClient } from './ProtocolClient.js';
import { PromptRenderer } from './PromptRenderer.js';
import type { AgentRunnerConfig, IssueContext } from './types.js';

/**
 * AgentRunner spawns the coding agent as a subprocess and manages its lifecycle.
 *
 * Events:
 *   - 'turn_event'    — proxied from ProtocolClient for each streamed turn event
 *   - 'turn_complete' — proxied from ProtocolClient when the agent turn finishes
 *   - 'stall_timeout' — emitted when stallTimeoutMs elapses after turn/start
 *   - 'error'         — emitted on subprocess error or crash
 */
export class AgentRunner extends EventEmitter {
  readonly command: string;
  private readonly approvalPolicy: string | undefined;
  private readonly stallTimeoutMs: number;
  private readonly renderer: PromptRenderer;
  private child: ChildProcess | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: AgentRunnerConfig) {
    super();
    this.command = config.command ?? 'codex app-server';
    this.approvalPolicy = config.approvalPolicy;
    this.stallTimeoutMs = config.stallTimeoutMs ?? 300_000;
    this.renderer = new PromptRenderer();
  }

  /**
   * Spawns the agent subprocess, runs the protocol handshake, and starts the
   * stall timeout timer. Resolves once handshake is complete (turn/start sent).
   *
   * @param issue        - The issue context to render into the prompt template
   * @param attempt      - Retry attempt counter (passed to template as `attempt`)
   * @param workspacePath - Working directory for the subprocess
   * @param promptTemplate - Liquid template string (WORKFLOW.md body)
   */
  async start(
    issue: IssueContext,
    attempt: number,
    workspacePath: string,
    promptTemplate: string,
  ): Promise<void> {
    const renderedPrompt = await this.renderer.render(promptTemplate, { issue, attempt });

    this.child = spawn('bash', ['-lc', this.command], {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    const client = new ProtocolClient(this.child);

    // Proxy protocol events
    client.on('turn_event', (evt) => this.emit('turn_event', evt));
    client.on('error', (err) => {
      this.clearStallTimer();
      this.emit('error', err);
    });
    client.on('turn_complete', (evt) => {
      this.clearStallTimer();
      this.emit('turn_complete', evt);
    });

    // Start stall timeout after sending turn/start
    await client.handshake(issue.identifier, renderedPrompt);

    this.stallTimer = setTimeout(() => {
      this.kill();
      this.emit('stall_timeout', { stallTimeoutMs: this.stallTimeoutMs });
    }, this.stallTimeoutMs);
  }

  /**
   * Sends SIGTERM to the subprocess if it is running.
   */
  kill(): void {
    this.clearStallTimer();
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
    }
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }
}
