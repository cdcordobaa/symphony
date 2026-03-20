import { LinearClient } from './linear-client';

/**
 * LinearGraphQLTool proxies raw GraphQL queries to the Linear API using
 * Symphony's auth (LINEAR_API_KEY). This satisfies FR 6.1 by exposing
 * the linear_graphql capability in agent sessions.
 */
export class LinearGraphQLTool {
  private readonly client: LinearClient;

  constructor(client?: LinearClient) {
    this.client = client ?? new LinearClient();
  }

  /**
   * Execute a raw GraphQL query against the Linear API.
   * Returns the raw `data` object from the API without normalization.
   */
  async execute(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<unknown> {
    return this.client.executeGraphQL(query, variables);
  }
}
