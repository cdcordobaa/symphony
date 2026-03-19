# Execution Plan

## Detailed Analysis Summary

### Change Impact Assessment
- **User-facing changes**: No - This is a backend orchestrator daemon/CLI, there is no UI.
- **Structural changes**: Yes - Building a completely new orchestrator engine and subprocess runner.
- **Data model changes**: Yes - Implementing in-memory states (running, claimed, retry queues) and domain entities (Issues, Workspaces).
- **API changes**: Yes - Implementing the `linear` tracker integration and JSON-line protocol for the agent subprocess.
- **NFR impact**: Yes - Strict enforcement of BDD/TDD, statelessness on restart, and structural JSON logging.

### Risk Assessment
- **Risk Level**: Medium (Time-constrained, complex async/polling orchestration logic).
- **Rollback Complexity**: Easy (Greenfield, no existing production state).
- **Testing Complexity**: Moderate (Requires mocks for Linear API and stdio subprocesses to adhere to BDD/TDD requirements).

## Workflow Visualization

```mermaid
flowchart TD
    Start(["User Request"])
    
    subgraph INCEPTION["🔵 INCEPTION PHASE"]
        WD["Workspace Detection<br/><b>COMPLETED</b>"]
        RE["Reverse Engineering<br/><b>SKIPPED</b>"]
        RA["Requirements Analysis<br/><b>COMPLETED</b>"]
        US["User Stories<br/><b>SKIPPED</b>"]
        WP["Workflow Planning<br/><b>IN PROGRESS</b>"]
        AD["Application Design<br/><b>SKIP</b>"]
        UP["Units Planning<br/><b>SKIP</b>"]
        UG["Units Generation<br/><b>EXECUTE</b>"]
    end
    
    subgraph CONSTRUCTION["🟢 CONSTRUCTION PHASE"]
        FD["Functional Design<br/><b>SKIP</b>"]
        NFRA["NFR Requirements<br/><b>SKIP</b>"]
        NFRD["NFR Design<br/><b>SKIP</b>"]
        ID["Infrastructure Design<br/><b>SKIP</b>"]
        CP["Code Planning<br/><b>EXECUTE</b>"]
        CG["Code Generation<br/><b>EXECUTE</b>"]
        BT["Build and Test<br/><b>EXECUTE</b>"]
    end
    
    subgraph OPERATIONS["🟡 OPERATIONS PHASE"]
        OPS["Operations<br/><b>PLACEHOLDER</b>"]
    end
    
    Start --> WD
    WD --> RA
    RA --> WP
    WP --> UG
    UG --> CP
    CP --> CG
    CG --> BT
    BT --> End(["Complete"])
    
    style WD fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style RE fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style RA fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style US fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style WP fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    style AD fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style UP fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style UG fill:#FFA726,stroke:#E65100,stroke-width:3px,stroke-dasharray: 5 5,color:#000
    
    style FD fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style NFRA fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style NFRD fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style ID fill:#BDBDBD,stroke:#424242,stroke-width:2px,stroke-dasharray: 5 5,color:#000
    style CP fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style CG fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    style BT fill:#4CAF50,stroke:#1B5E20,stroke-width:3px,color:#fff
    
    style Start fill:#CE93D8,stroke:#6A1B9A,stroke-width:3px,color:#000
    style End fill:#CE93D8,stroke:#6A1B9A,stroke-width:3px,color:#000
    linkStyle default stroke:#333,stroke-width:2px
```

## Phases to Execute

### 🔵 INCEPTION PHASE
- [x] Workspace Detection (COMPLETED)
- [x] Reverse Engineering (SKIPPED - Greenfield)
- [x] Requirements Elaboration (COMPLETED)
- [x] User Stories (SKIPPED - Backend orchestration daemon, no explicit UI personas)
- [x] Execution Plan (IN PROGRESS)
- [ ] Application Design - SKIP
  - **Rationale**: Strict TDD/BDD means we design through tests; detailed application design phase would slow us down given the 1-hour timebox.
- [ ] Units Planning - SKIP
  - **Rationale**: Bypassed in favor of direct Units Generation.
- [ ] Units Generation - EXECUTE
  - **Rationale**: The user explicitly requested we generate the "AIDLC working units" formatted for Linear. We need to create these to define the BDD steps.

### 🟢 CONSTRUCTION PHASE
- [ ] Functional Design - SKIP
  - **Rationale**: Covered by the BDD test specifications we will write.
- [ ] NFR Requirements - SKIP
  - **Rationale**: NFRs are already defined in the main requirements document.
- [ ] NFR Design - SKIP
  - **Rationale**: Simple stateless daemon architecture.
- [ ] Infrastructure Design - SKIP
  - **Rationale**: No cloud infrastructure needed, just a local CLI tool.
- [ ] Code Planning - EXECUTE (ALWAYS)
  - **Rationale**: Needed to map units to BDD feature files and TDD test suites.
- [ ] Code Generation - EXECUTE (ALWAYS)
  - **Rationale**: Actual implementation of the orchestrator.
- [ ] Build and Test - EXECUTE (ALWAYS)
  - **Rationale**: Verify the Core Conformance test suite passes.

### 🟡 OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER
  - **Rationale**: Future deployment and monitoring workflows

## Estimated Timeline
- **Total Phases**: 5 remaining (Units Generation, Code Planning, Code Gen, Build/Test).
- **Estimated Duration**: ~1 Hour (Timebox target).

## Success Criteria
- **Primary Goal**: Complete an executable Node.js CLI that implements the Core Conformance of the Symphony Spec.
- **Key Deliverables**: 
  - Working Units exported for Linear.
  - BDD Feature files (`.feature`).
  - TDD Unit/Integration tests.
  - Executable TypeScript codebase.
- **Quality Gates**: All BDD/TDD tests must pass locally.