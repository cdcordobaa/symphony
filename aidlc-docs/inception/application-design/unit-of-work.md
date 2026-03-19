# Unit of Work Definitions

This document defines the logical units of work (modules) for the Symphony Orchestrator port.

## Unit 1: Workflow Loader & Config
- **Responsibility**: Reading `WORKFLOW.md`, parsing YAML front-matter, resolving environment variables, and watching the file for dynamic reloads.
- **Key Symbols**: `WorkflowLoader`, `ConfigLayer`.
- **BDD Specification**: `features/workflow_loading.feature`

## Unit 2: Linear Tracker Client
- **Responsibility**: Authenticating with Linear, fetching candidate issues (Active/Terminal), and normalizing tracker data into the core `Issue` model.
- **Key Symbols**: `LinearClient`, `TrackerAdapter`.
- **BDD Specification**: `features/issue_polling.feature`

## Unit 3: Workspace Manager
- **Responsibility**: Creating sanitized per-issue directories, managing the lifecycle of these directories, and executing shell hooks with timeouts.
- **Key Symbols**: `WorkspaceManager`, `HookRunner`.
- **BDD Specification**: `features/workspace_management.feature`

## Unit 4: Agent Runner (Subprocess)
- **Responsibility**: Spawning the coding agent subprocess, managing the JSON-line protocol handshake, and streaming updates back to the orchestrator.
- **Key Symbols**: `AgentRunner`, `ProtocolClient`.
- **BDD Specification**: `features/agent_communication.feature`

## Unit 5: Orchestrator Core (The Brain)
- **Responsibility**: The central polling loop, task dispatching, concurrency management, and issue reconciliation logic.
- **Key Symbols**: `Orchestrator`, `RetryQueue`.
- **BDD Specification**: `features/orchestration_loop.feature`

## Code Organization Strategy
- **Root**: TypeScript source in `src/`.
- **Modules**: Each unit will reside in its own directory within `src/modules/`.
- **Tests**: BDD Feature files in `features/` and Jest unit tests in `src/__tests__/`.
