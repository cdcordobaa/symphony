# Symphony Orchestrator Port Requirements

## Intent Analysis Summary
- **User Request**: Implement the OpenAI Symphony specification (a long-running coding agent orchestrator tied to Linear).
- **Request Type**: New Project (Greenfield).
- **Scope Estimate**: System-wide (Core orchestrator loop, CLI, Tracker integration, Subprocess management).
- **Complexity Estimate**: Moderate (Complex orchestration logic, but bounded by skipping optional UI/API features).
- **Primary Constraints**: 
  - Extreme time-pressure (target: ~1 hour).
  - Mandatory use of Behavior-Driven Design (BDD) and Test-Driven Development (TDD).

## Core Decisions & Tech Stack (Optimized for Speed)
- **Language**: TypeScript / Node.js
- **Testing Framework**: Jest with Cucumber.js (BDD/TDD enforcement)
- **Optional Features**: Including the `linear_graphql` client-side tool extension as requested. Excluding the HTTP API and Web UI to maintain focus on the 1-hour timebox.

## Functional Requirements (Core Conformance)
1. **CLI & Workflow Loader**: 
   - Workflow path selection must support an explicit runtime path or default to cwd.
   - Parse `WORKFLOW.md` (YAML front-matter + markdown body).
   - Support typed configuration extraction and environment variable resolution (`$VAR`, `~`).
   - Implement dynamic `WORKFLOW.md` file watching to hot-reload and re-apply config and prompt without a restart.
2. **Issue Tracker Client (Linear)**: 
   - Fetch active candidate issues using a project slug.
   - Fetch specific issues for state reconciliation.
   - Fetch terminal-state issues during startup for initial cleanup sweeps.
3. **Workspace Manager**: 
   - Create deterministic, sanitized per-issue isolated directories.
   - Execute shell hooks (`after_create`, `before_run`, `after_run`, `before_remove`) with configurable timeouts (`hooks.timeout_ms`, default `60000`).
   - Clean up workspaces for terminal issues (both on startup sweep and active transition).
4. **Agent Runner Subprocess**: 
   - Launch the coding agent using `codex.command` (default: `codex app-server`).
   - Communicate via the defined JSON-line protocol over `stdio` (initialize -> thread/start -> turn/start).
   - Perform strict prompt rendering, injecting `issue` and `attempt` variables.
5. **Orchestrator Core**:
   - Polling orchestrator maintaining a single-authority mutable state.
   - Reconcile running sessions (stop runs on terminal/non-active tracker states).
   - Dispatch work up to concurrency limits.
   - Implement an exponential retry queue with continuation retries after normal exit.
   - Enforce a configurable retry backoff cap (`agent.max_retry_backoff_ms`, default 5m).

## Functional Requirements (Extensions)
1. **Linear GraphQL Tool**:
   - Implement the optional `linear_graphql` client-side tool extension.
   - Expose raw Linear GraphQL access through the app-server session using the configured Symphony auth.

## Non-Functional Requirements
1. **Methodology**: 
   - Strict adherence to **BDD** (writing feature files first).
   - Strict adherence to **TDD** (writing failing unit/integration tests before implementation).
2. **Statelessness**: The orchestrator must keep its state in-memory and recover by reading the file system/tracker on restart.
3. **Observability**: Must emit structured JSON logs to stdout including `issue_id` and `session_id` context.

## Excluded (Out of Scope)
- HTTP Server (`/api/v1/state`) and Web Dashboard.
- Persistent database storage.