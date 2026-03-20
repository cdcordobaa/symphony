# Integration Test Instructions

## Prerequisites
- A functional `WORKFLOW.md` configuration.
- A valid `LINEAR_API_KEY` mapped in `.env`.

## Instructions
Integration tests run naturally during standard usage. To verify everything is correctly wired:
`npm start test-workflow.md`

All subsystems (WorkspaceManager, LinearClient, AgentRunner, Orchestrator) will run in unison, verifying correct integration.
