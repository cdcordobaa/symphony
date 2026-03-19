# Symphony AI-DLC Working Units

This document outlines the AI-DLC working units required to build the Symphony orchestrator port based on the [OpenAI Symphony Specification](https://github.com/openai/symphony/blob/main/SPEC.md). These units are formatted for easy ingestion into Linear and are designed to be executed by an AI agent (like Claude Code) following the AI-DLC framework.

## Phase 1: Inception & Foundation (Scaffolding & Core Types)

### Unit 1.1: Project Initialization & Core Domain Models
- **Title:** Initialize Project and Define Core Entities
- **Description:** 
  - Set up the base project structure (package manager, linting, formatting).
  - Implement the core domain models as defined in section 4.1 of the spec: `Issue`, `WorkflowDefinition`, `Workspace`, `RunAttempt`, and `LiveSession`.
  - Add strict type definitions (e.g., TypeScript interfaces or Python dataclasses) to ensure type safety across all components.
- **Acceptance Criteria:**
  - Project compiles/runs.
  - Core domain models are defined with type safety.
  - Basic unit tests for entity instantiation pass.

### Unit 1.2: Configuration & Workflow Loader
- **Title:** Implement Workflow Loader and Typed Config Layer
- **Description:**
  - Build the `Workflow Loader` to read `WORKFLOW.md` from the filesystem.
  - Parse YAML front-matter into a typed `Service Config` object.
  - Extract the markdown body as the `prompt_template`.
  - Support `$VAR` and `~` (home directory) environment variable indirection.
- **Acceptance Criteria:**
  - Loading a valid `WORKFLOW.md` successfully returns config and template.
  - Missing or invalid front-matter throws typed errors.
  - Environment variables in config strings are correctly interpolated.

## Phase 2: Integration & Environment (External Systems)

### Unit 2.1: Workspace Manager
- **Title:** Implement Deterministic Workspace Manager
- **Description:**
  - Build the `Workspace Manager` to handle per-issue filesystem isolation.
  - Ensure deterministic directory creation using sanitized issue identifiers (e.g., `MT-649`).
  - Implement lifecycle hooks execution (`after_create`, `before_run`, `after_run`, `before_remove`) via shell commands.
  - Enforce directory sanitization and containment within the configured `workspace.root`.
- **Acceptance Criteria:**
  - Workspaces are created cleanly and paths are sanitized.
  - Hook shell commands execute successfully and timeout correctly.
  - Fails safely if path escapes the workspace root.

### Unit 2.2: Issue Tracker Client (Linear Adapter)
- **Title:** Build Linear Issue Tracker Client
- **Description:**
  - Implement the `Issue Tracker Client` specifically for the `linear` kind.
  - Fetch candidate issues in active states filtered by project slug.
  - Fetch specific issue states by IDs for reconciliation.
  - Normalize Linear API responses into the core `Issue` domain model (handling labels, blocked_by relations, etc.).
- **Acceptance Criteria:**
  - Successfully authenticates with Linear using `LINEAR_API_KEY`.
  - Can fetch and normalize a list of candidate issues.
  - Properly handles API errors and pagination.

## Phase 3: Execution & Coordination (The Brain)

### Unit 3.1: Agent Runner Subprocess Client
- **Title:** Implement Agent Runner and App-Server Protocol
- **Description:**
  - Build the `Agent Runner` that spawns the coding agent subprocess (`bash -lc <codex.command>`).
  - Implement the JSON-line stdio protocol handshake (`initialize`, `thread/start`, `turn/start`).
  - Construct the agent prompt using the `WORKFLOW.md` template, issue data, and attempt counters.
  - Stream state updates, token usage, and rate limits back to the parent process.
- **Acceptance Criteria:**
  - Correctly spawns a dummy/mock agent subprocess and completes the handshake.
  - Successfully parses JSON lines from stdout and ignores non-JSON stderr.
  - Turn timeouts and protocol read timeouts are enforced.

### Unit 3.2: The Orchestrator State Machine
- **Title:** Build Core Orchestrator Polling & Dispatch Loop
- **Description:**
  - Implement the central `Orchestrator` tick loop (poll -> reconcile -> dispatch).
  - Manage in-memory state for `running`, `claimed`, and `retry_attempts`.
  - Enforce `max_concurrent_agents` limits.
  - Implement sorting logic (priority then oldest creation time) for dispatching issues.
- **Acceptance Criteria:**
  - The loop correctly dispatches work up to the concurrency limit.
  - Idle loop handles zero candidates gracefully.
  - State object accurately tracks running tasks.

### Unit 3.3: Reconciliation and Retry Logic
- **Title:** Implement Issue Reconciliation and Exponential Backoff
- **Description:**
  - Add reconciliation logic to the Orchestrator tick to check active runs against the tracker.
  - Stop running agents and trigger workspace cleanup if an issue enters a terminal state.
  - Stop running agents (without cleanup) if an issue enters a non-active state.
  - Implement exponential backoff for worker failures and immediate continuation retries for normal exits.
- **Acceptance Criteria:**
  - Terminal issues actively running are correctly killed and cleaned up.
  - Worker failures increment retry counters with exponential delay up to the max cap.

## Phase 4: Operations & Polish (Observability)

### Unit 4.1: Logging & Observability Layer
- **Title:** Implement Structured Logging and Status Tracking
- **Description:**
  - Integrate a structured JSON logger emitting logs to stdout/file.
  - Attach `issue_id`, `issue_identifier`, and `session_id` context to all logs originating from worker execution.
  - Track aggregate metrics (input tokens, output tokens, seconds running) across all sessions.
- **Acceptance Criteria:**
  - Logs are structured and include correct context.
  - Orchestrator accurately maintains token totals and runtime metrics.

### Unit 4.2: CLI Entrypoint and Host Lifecycle
- **Title:** Build CLI Application Entrypoint
- **Description:**
  - Implement the main CLI executable that accepts an optional `path-to-WORKFLOW.md` argument.
  - Wire up the Orchestrator, Workspace Manager, Agent Runner, and Tracker Client.
  - Handle OS signals (SIGINT/SIGTERM) for graceful shutdown of running agent subprocesses.
  - Implement a dynamic file watcher for `WORKFLOW.md` to hot-reload configuration safely.
- **Acceptance Criteria:**
  - CLI starts successfully with a valid config.
  - CLI exits gracefully on SIGINT, cleaning up active subprocesses.
  - Modifying `WORKFLOW.md` dynamically updates the orchestrator's interval/limits without a hard restart.

### Unit 4.3: (Optional) HTTP Status API
- **Title:** Implement Observability HTTP Server
- **Description:**
  - Build the optional read-only JSON REST API under `/api/v1/*`.
  - Expose `/api/v1/state` for aggregate dashboard metrics.
  - Expose `/api/v1/<issue_identifier>` for specific run details.
  - Expose `POST /api/v1/refresh` for immediate poll triggering.
- **Acceptance Criteria:**
  - HTTP server binds to `server.port` (or CLI `--port`).
  - Endpoints return the expected JSON shapes defined in the spec.