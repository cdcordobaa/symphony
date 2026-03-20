import { Orchestrator } from './modules/orchestrator/Orchestrator.js';
import { WorkflowLoader } from './modules/workflow-loader/workflow-loader.js';
import { LinearClient } from './modules/linear-client/linear-client.js';
import { WorkspaceManager } from './modules/workspace-manager/WorkspaceManager.js';
import { AgentRunner } from './modules/agent-runner/AgentRunner.js';
import type { OrchestratorConfig } from './modules/orchestrator/types.js';

async function bootstrap() {
  const workflowPath = process.argv[2] || 'WORKFLOW.md';
  
  console.log(`Loading workflow configuration from ${workflowPath}...`);
  const { config, body } = await WorkflowLoader.loadWithBody(workflowPath);
  
  const orchestratorConfig: OrchestratorConfig = {
    pollingIntervalMs: Number(config.polling?.interval_ms) || 5000,
    maxConcurrentAgents: Number(config.agent?.max_concurrent_agents) || 10,
    maxRetryBackoffMs: Number(config.agent?.max_retry_backoff_ms) || 300_000,
    activeStates: Array.isArray(config.tracker?.active_states) ? config.tracker.active_states as string[] : [],
    terminalStates: Array.isArray(config.tracker?.terminal_states) ? config.tracker.terminal_states as string[] : [],
    projectSlug: String(config.tracker?.project_slug || ''),
    promptTemplate: body
  };
  
  console.log('Initializing Symphony Orchestrator modules...');
  const client = new LinearClient(process.env.LINEAR_API_KEY || '');
  
  const rootPath = typeof config.workspace?.root === 'string' ? config.workspace.root : '~/symphony-workspaces';
  const workspaceManager = new WorkspaceManager({ root: rootPath });
  
  const codexCommand = typeof config.codex?.command === 'string' ? config.codex.command : 'claude';
  const agentRunnerFactory = (issueId: string) => new AgentRunner({ command: codexCommand });
  
  const orchestrator = new Orchestrator(orchestratorConfig, client, agentRunnerFactory, workspaceManager);
  
  const shutdown = async () => {
    console.log('\nReceived shutdown signal. Stopping active agents...');
    orchestrator.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('Starting the orchestration loop. Press Ctrl+C to stop.');
  await orchestrator.start();
}

bootstrap().catch(error => {
  console.error('Fatal error during initialization:', error);
  process.exit(1);
});
