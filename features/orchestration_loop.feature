Feature: Orchestration Loop
  As a Symphony orchestrator
  I want to manage agent sessions against active Linear issues
  So that each active issue is worked by an agent within concurrency limits

  Background:
    Given the orchestrator is configured with max 2 concurrent agents
    And the polling interval is 1000ms
    And the max retry backoff is 5000ms

  Scenario: Dispatch sessions up to the concurrency limit
    Given 3 active issues exist: "SYM-1", "SYM-2", "SYM-3"
    And no sessions are currently running
    When a poll cycle runs
    Then exactly 2 sessions should be dispatched
    And "SYM-3" should remain undispatched

  Scenario: Stop session when issue reaches terminal state
    Given a running session exists for issue "SYM-10"
    And "SYM-10" is no longer in the active issues list
    When a poll cycle runs
    Then the runner for "SYM-10" should be killed
    And the workspace for "SYM-10" should be removed
    And the session for "SYM-10" should be cleaned up

  Scenario: Retry completed session with exponential backoff
    Given a completed session for issue "SYM-20" with attempt 0
    And "SYM-20" is still in the active issues list
    When the session completes
    Then "SYM-20" should be enqueued in the retry queue
    And the retry delay for attempt 0 should be 1000ms
    And the retry delay for attempt 1 should be 2000ms
    And the retry delay for attempt 2 should be 4000ms
    And the retry delay for attempt 3 should be capped at 5000ms

  Scenario: Concurrency queue drains as slots free up
    Given the concurrency limit is 2
    And 2 sessions are currently running for "SYM-30" and "SYM-31"
    And 1 active issue "SYM-32" is waiting for a slot
    When one running session completes and frees a slot
    And a poll cycle runs
    Then "SYM-32" should be dispatched
