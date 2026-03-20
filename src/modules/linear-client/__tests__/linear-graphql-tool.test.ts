import { LinearClient } from '../linear-client';
import { LinearGraphQLTool } from '../linear-graphql-tool';

jest.mock('../linear-client');

describe('LinearGraphQLTool', () => {
  let mockClient: jest.Mocked<LinearClient>;

  beforeEach(() => {
    mockClient = new LinearClient('key') as jest.Mocked<LinearClient>;
    mockClient.executeGraphQL = jest.fn();
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    it('proxies query to LinearClient.executeGraphQL', async () => {
      mockClient.executeGraphQL.mockResolvedValue({ viewer: { id: 'user-1' } });

      const tool = new LinearGraphQLTool(mockClient);
      const result = await tool.execute('query { viewer { id } }');

      expect(mockClient.executeGraphQL).toHaveBeenCalledWith(
        'query { viewer { id } }',
        undefined
      );
      expect(result).toEqual({ viewer: { id: 'user-1' } });
    });

    it('passes variables to executeGraphQL', async () => {
      mockClient.executeGraphQL.mockResolvedValue({ issues: { nodes: [] } });
      const vars = { id: 'issue-42' };

      const tool = new LinearGraphQLTool(mockClient);
      await tool.execute('query Issue($id: String!) { issue(id: $id) { id } }', vars);

      expect(mockClient.executeGraphQL).toHaveBeenCalledWith(
        'query Issue($id: String!) { issue(id: $id) { id } }',
        vars
      );
    });

    it('returns raw response without normalization', async () => {
      const rawResponse = { customField: 'raw-value', nested: { foo: 'bar' } };
      mockClient.executeGraphQL.mockResolvedValue(rawResponse);

      const tool = new LinearGraphQLTool(mockClient);
      const result = await tool.execute('query { custom }');

      expect(result).toBe(rawResponse);
    });

    it('propagates errors from the client', async () => {
      mockClient.executeGraphQL.mockRejectedValue(new Error('Linear API request failed: 401'));

      const tool = new LinearGraphQLTool(mockClient);
      await expect(tool.execute('query { viewer { id } }')).rejects.toThrow(
        'Linear API request failed: 401'
      );
    });
  });
});
