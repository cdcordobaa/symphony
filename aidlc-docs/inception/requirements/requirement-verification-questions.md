# Requirement Verification Questions

Please provide answers after the `[Answer]:` tags to help clarify the requirements for the Symphony orchestrator port.

## 1. Programming Language and Tech Stack
The original Symphony specification is language-agnostic. Which programming language and core framework should we use for this implementation?
A) TypeScript / Node.js
B) Python
C) Go
D) Rust
X) Other (please describe after [Answer]: tag below)
[Answer]: A) TypeScript / Node.js. Selected for maximum development speed and robust asynchronous handling (crucial for polling and stdio subprocess communication).

## 2. Optional Extensions (HTTP Status API)
The specification defines an optional HTTP server extension for a human-readable dashboard and JSON REST API (`/api/v1/state`). Should this be included in the initial implementation?
A) Yes, implement the HTTP API and a simple dashboard.
B) Yes, implement the JSON API only.
C) No, skip the HTTP API for now.
X) Other (please describe after [Answer]: tag below)
[Answer]: C) No, skip the HTTP API for now. To meet the aggressive 1-hour deadline, we will strictly focus on Core Conformance (the CLI and orchestrator engine).

## 3. Optional Extensions (Linear GraphQL Tool)
The specification describes an optional `linear_graphql` client-side tool extension that allows the agent to make raw Linear GraphQL queries using Symphony's auth. Should this be included?
A) Yes
B) No
X) Other (please describe after [Answer]: tag below)
[Answer]: B) No. Skipped to minimize scope and ensure rapid delivery within the timebox.

## 4. Testing Strategy
The specification requires Core Conformance tests. Which testing framework should be utilized for writing unit and integration tests?
[Answer]: Jest alongside Cucumber.js (or equivalent like `jest-cucumber`) to strictly enforce the requested Behavior-Driven Design (BDD) and Test-Driven Development (TDD) engineering practices.

## 5. Security Extension
Should security extension rules be enforced for this project?
A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)
[Answer]: B) No — skip all SECURITY rules (to prioritize the 1-hour completion target).