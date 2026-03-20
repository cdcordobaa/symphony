import axios from 'axios';
import type { Issue, RawLinearIssue, GraphQLResponse } from './types';
import { TrackerAdapter } from './tracker-adapter';

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  state {
    name
  }
  labels {
    nodes {
      name
    }
  }
  relations {
    nodes {
      relatedIssue {
        identifier
        state {
          name
        }
      }
    }
  }
`;

const ISSUES_BY_PROJECT_AND_STATE_QUERY = `
  query IssuesByProjectAndState($projectSlug: String!, $states: [String!]!) {
    issues(
      filter: {
        project: { slugId: { eq: $projectSlug } }
        state: { name: { in: $states } }
      }
    ) {
      nodes {
        ${ISSUE_FIELDS}
      }
    }
  }
`;

const ISSUE_BY_ID_QUERY = `
  query IssueById($id: String!) {
    issue(id: $id) {
      ${ISSUE_FIELDS}
    }
  }
`;

/**
 * LinearClient authenticates with the Linear GraphQL API using LINEAR_API_KEY
 * and provides methods to fetch and query issues.
 */
export class LinearClient {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(apiKey?: string, endpoint?: string) {
    const key = apiKey ?? process.env['LINEAR_API_KEY'];
    if (!key) {
      throw new Error(
        'LinearClient: LINEAR_API_KEY is required. Set the environment variable or pass apiKey to the constructor.'
      );
    }
    this.apiKey = key;
    this.endpoint = endpoint ?? LINEAR_GRAPHQL_URL;
  }

  /**
   * Executes a raw GraphQL query against the Linear API.
   * Used internally and exposed as the linear_graphql tool proxy.
   */
  async executeGraphQL(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<unknown> {
    try {
      const response = await axios.post<GraphQLResponse<unknown>>(
        this.endpoint,
        { query, variables },
        {
          headers: {
            Authorization: this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const body = response.data;
      if (body.errors && body.errors.length > 0) {
        const messages = body.errors.map((e) => e.message).join('; ');
        throw new Error(`Linear API GraphQL errors: ${messages}`);
      }

      return body.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        throw new Error(
          `Linear API request failed: ${err.response?.status ?? 'network error'} ${err.message}`
        );
      }
      throw err;
    }
  }

  /**
   * FR 2.1: Fetch candidate issues by project slug filtered to active states.
   */
  async fetchCandidates(
    projectSlug: string,
    activeStates: string[]
  ): Promise<Issue[]> {
    const data = (await this.executeGraphQL(ISSUES_BY_PROJECT_AND_STATE_QUERY, {
      projectSlug,
      states: activeStates,
    })) as { issues: { nodes: RawLinearIssue[] } };

    return TrackerAdapter.normalizeIssues(data.issues.nodes);
  }

  /**
   * FR 2.2: Fetch a specific issue by ID for state reconciliation.
   */
  async fetchIssue(id: string): Promise<Issue> {
    const data = (await this.executeGraphQL(ISSUE_BY_ID_QUERY, {
      id,
    })) as { issue: RawLinearIssue };

    return TrackerAdapter.normalizeIssue(data.issue);
  }

  /**
   * FR 2.3: On startup, fetch terminal-state issues for cleanup sweep.
   */
  async fetchTerminalIssues(
    projectSlug: string,
    terminalStates: string[]
  ): Promise<Issue[]> {
    const data = (await this.executeGraphQL(ISSUES_BY_PROJECT_AND_STATE_QUERY, {
      projectSlug,
      states: terminalStates,
    })) as { issues: { nodes: RawLinearIssue[] } };

    return TrackerAdapter.normalizeIssues(data.issues.nodes);
  }
}
