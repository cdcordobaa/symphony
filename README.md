# Symphony

Symphony is an AI orchestration tool that forms a continuous bridge between your task tracker (Linear) and your local AI coding agent (like Claude Code). 

Instead of manually fetching context and instructing an AI agent on what to work on, Symphony observes your Linear project autonomously. When a ticket enters an active state (like `Todo` or `In Progress`), Symphony automatically spins up isolated workspaces, templates out explicit instructions, and spawns AI coding agents to execute the requested work using BDD/TDD principles.

## How It Works

Symphony operates on an autonomous polling and execution loop. Here is the high-level lifecycle:

1. **Polling:** Symphony checks your Linear project via GraphQL at a designated interval to find active tickets.
2. **Workspace Provisioning:** Once an active ticket is found, Symphony clones the target repository into a fresh, isolated workspace. This prevents the agent from accidentally corrupting your regular local development environment.
3. **Workflow Templating:** Symphony reads the provided configuration document (`WORKFLOW.md`). This file dictates the guardrails, acceptable states, and rules of engagement. Symphony compiles a customized prompt, injecting the exact Linear issue details (title, description, status, blockers).
4. **Agent Invocation:** Symphony spawns the local AI process (e.g., `claude`) via the terminal inside that newly isolated workspace and passes it the templated workflow instructions.
5. **Autorecovery & Retries:** If the agent finishes a session (burns through its context/turns) but the ticket remains in an active state on Linear, Symphony detects the discrepancy. It then places the ticket back onto a retry queue, launching another cycle until the ticket either reaches a terminal state (`Done`) or a human review state.

## Setup

1. Configure your `.env` with your Linear API key:
   ```env
   LINEAR_API_KEY=lin_api_your_key_here
   ```
2. Run `npm install` to install dependencies required by the orchestrator.

## Usage

To run the orchestrator, you must provide a "Workflow Document" as an argument. 

> [!IMPORTANT]
> Make sure to explicitly load your localized environment variables before running the application so that the process has access to your `LINEAR_API_KEY`.

```bash
# Explicitly load the environment variables
source .env # Or use: export $(cat .env)

# Launch the orchestrator and point it to your workflow file
npm start WORKFLOW.md
```

## Running Tests

Execute the BDD test suite directly:
```bash
npm test
```
