import { WorkflowLoader } from './modules/workflow-loader/index.js';
import { LinearClient } from './modules/linear-client/index.js';
import { WorkspaceManager } from './modules/workspace-manager/index.js';
import { AgentRunner } from './modules/agent-runner/index.js';
import { Orchestrator } from './modules/orchestrator/index.js';
import type { OrchestratorConfig } from './modules/orchestrator/index.js';

async function main(): Promise<void> {
  const workflowPath = process.argv[2] ?? './WORKFLOW.md';

  let config: Awaited<ReturnType<typeof WorkflowLoader.loadWithBody>>['config'];
  let promptTemplate: string;

  try {
    const result = await WorkflowLoader.loadWithBody(workflowPath);
    config = result.config;
    promptTemplate = result.body;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }

  const projectSlug = (config.tracker?.project as string | undefined) ?? '';
  const pollingIntervalMs =
    typeof config.polling?.interval === 'number'
      ? config.polling.interval
      : 30_000;
  const maxConcurrentAgents =
    typeof (config.agent as Record<string, unknown> | undefined)?.['max_concurrent'] === 'number'
      ? (config.agent as Record<string, unknown>)['max_concurrent'] as number
      : 3;
  const maxRetryBackoffMs =
    typeof (config.agent as Record<string, unknown> | undefined)?.['max_retry_backoff_ms'] === 'number'
      ? (config.agent as Record<string, unknown>)['max_retry_backoff_ms'] as number
      : 300_000;
  const activeStates: string[] =
    Array.isArray((config as Record<string, unknown>)['active_states'])
      ? ((config as Record<string, unknown>)['active_states'] as string[])
      : ['In Progress', 'Todo'];
  const terminalStates: string[] =
    Array.isArray((config as Record<string, unknown>)['terminal_states'])
      ? ((config as Record<string, unknown>)['terminal_states'] as string[])
      : ['Done', 'Canceled', 'Duplicate'];

  const orchestratorConfig: OrchestratorConfig = {
    pollingIntervalMs,
    maxConcurrentAgents,
    maxRetryBackoffMs,
    activeStates,
    terminalStates,
    projectSlug,
    promptTemplate,
  };

  const linearClient = new LinearClient();

  const workspaceRoot =
    typeof config.workspace?.path === 'string' ? config.workspace.path : undefined;
  const workspaceManager = new WorkspaceManager(
    workspaceRoot !== undefined ? { root: workspaceRoot } : {},
  );

  const agentCommand =
    typeof (config.agent as Record<string, unknown> | undefined)?.['command'] === 'string'
      ? (config.agent as Record<string, unknown>)['command'] as string
      : undefined;

  const agentRunnerFactory = (_issueId: string) =>
    new AgentRunner(agentCommand !== undefined ? { command: agentCommand } : {});

  const orchestrator = new Orchestrator(
    orchestratorConfig,
    linearClient,
    agentRunnerFactory,
    workspaceManager,
  );

  const shutdown = (): void => {
    process.stdout.write(JSON.stringify({ level: 'info', event: 'shutdown', ts: new Date().toISOString() }) + '\n');
    orchestrator.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await orchestrator.start();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${message}\n`);
  process.exit(1);
});
