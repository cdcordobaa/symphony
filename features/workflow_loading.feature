Feature: Workflow Loading
  As a Symphony orchestrator
  I want to load and parse WORKFLOW.md
  So that I can configure the workflow engine

  Scenario: Load a valid WORKFLOW.md with YAML front-matter
    Given a WORKFLOW.md file with the following YAML front-matter:
      """
      ---
      tracker:
        type: linear
        project: SYMPHONY
      polling:
        interval: 30
      workspace:
        path: /tmp/workspace
      ---
      # Workflow
      Some markdown body
      """
    When I load the workflow config
    Then the config should have tracker type "linear"
    And the config should have polling interval 30
    And the config should have workspace path "/tmp/workspace"

  Scenario: Missing WORKFLOW.md file
    Given no WORKFLOW.md file exists at the path
    When I try to load the workflow config
    Then an error should be thrown with a message containing "not found"

  Scenario: Environment variable resolution in config values
    Given an environment variable "SYMPHONY_WORKSPACE" is set to "/home/user/projects"
    And a WORKFLOW.md file with the following YAML front-matter:
      """
      ---
      workspace:
        path: $SYMPHONY_WORKSPACE/app
      ---
      """
    When I load the workflow config
    Then the workspace path should be resolved to "/home/user/projects/app"

  Scenario: Tilde expansion in path values
    Given a WORKFLOW.md file with the following YAML front-matter:
      """
      ---
      workspace:
        path: ~/symphony/workspace
      ---
      """
    When I load the workflow config
    Then the workspace path should start with the home directory

  Scenario: Hot-reload event emission on file change
    Given a WorkflowLoader is watching a WORKFLOW.md file
    When the WORKFLOW.md file is modified with new content
    Then the loader should emit a "reload" event
    And the reload event payload should contain the updated config
