Feature: Agent Communication
  As the Symphony orchestrator
  I want to spawn a coding agent subprocess and communicate via JSON-line protocol
  So that the agent can process issues using the workflow prompt

  Scenario: Subprocess launch with codex command
    Given a mock agent subprocess that implements the JSON-line protocol
    When I start the AgentRunner with issue "SYM-1" and attempt 1
    Then a subprocess should be running

  Scenario: Protocol handshake completes
    Given a mock agent subprocess that implements the JSON-line protocol
    When I start the AgentRunner with issue "SYM-1" and attempt 1
    Then the initialize message should have been sent
    And the thread/start message should have been sent
    And the turn/start message should have been sent

  Scenario: Prompt rendered with issue and attempt variables
    Given a workflow template "Hello {{ issue.identifier }}, attempt {{ attempt }}"
    And a mock agent subprocess that implements the JSON-line protocol
    When I start the AgentRunner with issue "SYM-42" and attempt 3
    Then the turn/start content should be "Hello SYM-42, attempt 3"

  Scenario: Stall timeout kills subprocess
    Given a mock agent subprocess that never sends turn/complete
    And a stall timeout of 200ms
    When I start the AgentRunner with issue "SYM-1" and attempt 1
    Then a "stall_timeout" event should be emitted
    And the subprocess should be killed

  Scenario: Subprocess crash is handled
    Given a mock agent subprocess that crashes after sending initialized
    When I start the AgentRunner with issue "SYM-1" and attempt 1
    Then an "error" event should be emitted
