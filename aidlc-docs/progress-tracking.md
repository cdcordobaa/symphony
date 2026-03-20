# Progress Tracking: Where, Who, and How

## Where progress is saved

### 1. Repo-level AI-DLC (`aidlc-docs/`)
Lives **inside the repository**, committed to git. Two key files:

- **`aidlc-state.md`** — the workflow state machine. Records which INCEPTION/CONSTRUCTION stages are done, skipped, or pending. Updated by the AI at each stage gate.
- **`audit.md`** — append-only log of every user prompt and AI response with ISO timestamps. The paper trail.
- **`inception/`, `construction/`** — design artifacts (requirements, application design, plans) produced during each phase.

### 2. Linear tickets
Each ticket carries its own progress state via:
- **Issue state** (`Todo` → `In Progress` → `Human Review` → `Done`)
- **A single `## Workpad` comment** — the agent's live scratchpad. Contains the plan, acceptance criteria, validation checklist, and notes. Updated in-place throughout execution (not new comments — always the same one).
- **Attachments** — PR links added to the issue once a PR is open.

---

## Who updates what

| What | Who |
|------|-----|
| `aidlc-state.md` / `audit.md` | The **planning AI** (you + Claude Code in this session, during INCEPTION/CONSTRUCTION phases) |
| Linear issue state | The **agent** (Symphony's spawned Claude subprocess) — moves ticket `Todo → In Progress → Human Review` |
| Linear `## Workpad` comment | The **agent** — writes and edits this comment throughout its work session |
| `aidlc-docs/construction/` artifacts | The **planning AI** — generates code plans, functional design docs before the agent starts |

---

## How it flows end-to-end

```
Planning session (you + Claude Code)
  → writes aidlc-docs/construction/plans/
  → creates Linear tickets in Todo

Symphony starts (orchestrator polls Linear)
  → picks up Todo ticket
  → agent reads ticket description + WORKFLOW.md
  → creates ## Workpad comment, moves ticket to In Progress
  → implements, updates Workpad in-place
  → pushes PR, attaches to Linear issue
  → moves to Human Review

You review → approve → Merging → Done
```

---

## Source of truth

| Concern | Source of truth |
|---------|----------------|
| Design & architecture | Repo (`aidlc-docs/`) |
| Execution progress | Linear (issue state + Workpad comment) |
