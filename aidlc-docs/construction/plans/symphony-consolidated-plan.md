# Consolidated Code Generation Plan - Symphony Orchestrator

This plan covers the implementation of all 5 core units for the Symphony port, optimized for a 1-hour completion time using a modular BDD/TDD approach.

## Unit Context & Stories
- **Units**: Workflow Loader, Linear Client, Workspace Manager, Agent Runner, Orchestrator Core.
- **Methodology**: BDD (Cucumber Feature Files) -> TDD (Jest Unit/Integration Tests) -> Implementation.
- **Tech Stack**: TypeScript, Node.js, Jest, `jest-cucumber`.

## Phase 1: Project Scaffolding (All Units)
- [ ] Step 1: Initialize `package.json` with dependencies (jest, typescript, cucumber, yaml, axios, ts-node).
- [ ] Step 2: Configure `tsconfig.json` and Jest environment for BDD.
- [ ] Step 3: Create directory structure (`src/modules/`, `features/`, `src/__tests__/`).

## Phase 2: Unit 1 - Workflow Loader & Config
- [ ] Step 4: Write `features/workflow_loading.feature`.
- [ ] Step 5: Implement TDD tests for `WorkflowLoader`.
- [ ] Step 6: Implement `src/modules/workflow/WorkflowLoader.ts` (YAML parsing, ENV resolution, file watching).
- [ ] Step 7: Verify Unit 1 BDD steps pass.

## Phase 3: Unit 3 - Workspace Manager
- [ ] Step 8: Write `features/workspace_management.feature`.
- [ ] Step 9: Implement TDD tests for `WorkspaceManager` (directory creation, sanitization, shell hooks).
- [ ] Step 10: Implement `src/modules/workspace/WorkspaceManager.ts`.
- [ ] Step 11: Verify Unit 3 BDD steps pass.

## Phase 4: Unit 4 - Agent Runner (Subprocess)
- [ ] Step 12: Write `features/agent_communication.feature`.
- [ ] Step 13: Implement TDD tests for `AgentRunner` (stdio JSON-line protocol, handshake).
- [ ] Step 14: Implement `src/modules/agent/AgentRunner.ts`.
- [ ] Step 15: Verify Unit 4 BDD steps pass.

## Phase 5: Unit 2 - Linear Tracker Client
- [ ] Step 16: Write `features/issue_polling.feature`.
- [ ] Step 17: Implement TDD tests for `LinearClient` (mocking Axios for candidate fetch, reconciliation, GraphQL tool).
- [ ] Step 18: Implement `src/modules/tracker/LinearClient.ts`.
- [ ] Step 19: Verify Unit 2 BDD steps pass.

## Phase 6: Unit 5 - Orchestrator Core (The Brain)
- [ ] Step 20: Write `features/orchestration_loop.feature`.
- [ ] Step 21: Implement TDD integration tests for `Orchestrator` (loop logic, concurrency, retries).
- [ ] Step 22: Implement `src/modules/core/Orchestrator.ts`.
- [ ] Step 23: Verify Unit 5 BDD steps pass.

## Phase 7: CLI Entrypoint & Final Assembly
- [ ] Step 24: Create `src/index.ts` to wire all modules together into a CLI.
- [ ] Step 25: Generate `README.md` and basic `WORKFLOW.md` example.
- [ ] Step 26: Final verification run of all tests.
