# Unit of Work Story Map

This document maps functional requirements from the [Requirements Analysis](../../inception/requirements/requirements.md) to specific units of work.

| Requirement ID | Requirement Name | Assigned Unit |
| --- | --- | --- |
| **FR 1.1** | `WORKFLOW.md` Parsing | **Unit 1**: Workflow Loader & Config |
| **FR 1.2** | Environment Resolution | **Unit 1**: Workflow Loader & Config |
| **FR 1.3** | Dynamic File Watching | **Unit 1**: Workflow Loader & Config |
| **FR 2.1** | Candidate Issue Fetch | **Unit 2**: Linear Tracker Client |
| **FR 2.2** | State Reconciliation | **Unit 2**: Linear Tracker Client |
| **FR 2.3** | Startup Terminal Sweep | **Unit 2**: Linear Tracker Client |
| **FR 3.1** | Deterministic Workspaces | **Unit 3**: Workspace Manager |
| **FR 3.2** | Shell Lifecycle Hooks | **Unit 3**: Workspace Manager |
| **FR 3.3** | Workspace Cleanup | **Unit 3**: Workspace Manager |
| **FR 4.1** | Subprocess Launching | **Unit 4**: Agent Runner (Subprocess) |
| **FR 4.2** | JSON-RPC Handshake | **Unit 4**: Agent Runner (Subprocess) |
| **FR 4.3** | Strict Prompt Rendering | **Unit 4**: Agent Runner (Subprocess) |
| **FR 5.1** | Central Orchestration Loop | **Unit 5**: Orchestrator Core (The Brain) |
| **FR 5.2** | Concurrency Enforcement | **Unit 5**: Orchestrator Core (The Brain) |
| **FR 5.3** | Exponential Retry Queue | **Unit 5**: Orchestrator Core (The Brain) |
| **FR 6.1** | Linear GraphQL Extension | **Unit 2**: Linear Tracker Client |
