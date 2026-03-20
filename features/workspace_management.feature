Feature: Workspace Management

  Background:
    Given the workspace root is a temporary directory

  Scenario: Create workspace directory for an issue
    When I create a workspace for issue "SYM-42"
    Then the directory "<root>/SYM-42" should exist

  Scenario: Sanitize path from issue identifier
    When I create a workspace for issue "SYM-42/evil/../path"
    Then the directory name should be "SYM-42-evil-path"

  Scenario: Run after_create hook on workspace creation
    Given a hook script "after_create" that writes "hook-ran" to a file
    When I create a workspace for issue "SYM-42"
    Then the hook should have been executed in the workspace directory

  Scenario: Hook timeout enforcement
    Given a hook script that runs for 10 seconds
    When I run the hook with a timeout of 100ms
    Then the hook process should be killed
    And an error should be emitted

  Scenario: Cleanup workspace on terminal state
    Given a workspace exists for issue "SYM-42"
    When I remove the workspace for issue "SYM-42"
    Then the directory "<root>/SYM-42" should not exist
