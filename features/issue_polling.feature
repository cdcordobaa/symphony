Feature: Issue Polling
  As a Symphony orchestrator
  I want to fetch and normalize Linear issues
  So that I can track workflow state against my project

  Background:
    Given the LINEAR_API_KEY environment variable is set to "test-api-key"

  Scenario: Fetch active issues by project slug and state filter
    Given the Linear API returns issues for project "SYM" with states "In Progress,Todo"
    When I call fetchCandidates with project slug "SYM" and active states ["In Progress", "Todo"]
    Then the result should be a list of normalized Issue objects
    And each issue should have id, identifier, title, description, state, labels, and blockers fields

  Scenario: Filter issues by active state
    Given the Linear API returns issues with mixed states for project "SYM"
    When I call fetchCandidates with project slug "SYM" and active states ["In Progress"]
    Then only issues in "In Progress" state should be returned

  Scenario: Startup terminal sweep fetches terminal-state issues
    Given the Linear API returns terminal issues for project "SYM" with states "Done,Cancelled"
    When I call fetchTerminalIssues with project slug "SYM" and terminal states ["Done", "Cancelled"]
    Then the result should be a list of normalized Issue objects in terminal states

  Scenario: Normalize raw Linear issue model into core Issue model
    Given the Linear API returns a raw issue with all fields populated
    When the TrackerAdapter normalizes the raw issue
    Then the normalized issue should have the correct id
    And the normalized issue should have the correct identifier like "SYM-12"
    And the normalized issue should have the correct title
    And the normalized issue should have the correct description
    And the normalized issue should have the correct state name
    And the normalized issue should have labels as an array of strings
    And the normalized issue should have blockers as an array with identifier and state fields

  Scenario: Fetch single issue by ID
    Given the Linear API returns a single issue with id "issue-123"
    When I call fetchIssue with id "issue-123"
    Then the result should be a single normalized Issue with id "issue-123"

  Scenario: Handle API errors gracefully
    Given the Linear API returns an HTTP 401 error
    When I call fetchCandidates with project slug "SYM" and active states ["In Progress"]
    Then an error should be thrown with a message containing "Linear API"

  Scenario: Proxy raw GraphQL query via linear_graphql tool
    Given the Linear API accepts a raw GraphQL query
    When I call executeGraphQL with a raw query string and variables
    Then the raw API response should be returned without normalization
