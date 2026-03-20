# Symphony

Symphony is an AI orchestration tool that connects Linear tickets with a local AI coding agent (like Claude Code). It polls Linear, creates isolated workspaces, and delegates the ticket resolution to the agent based on BDD-defined workflows.

## Setup

1. Configure your `.env` with your Linear API key:
   ```env
   LINEAR_API_KEY=lin_api_your_key_here
   ```
2. Run `npm install` to install dependencies.

## Usage

To start Symphony, you need a configuration document (like `WORKFLOW.md`). Launch the orchestrator using:

```bash
npm start WORKFLOW.md
```

## Running Tests

Execute the BDD test suite:
```bash
npm test
```
