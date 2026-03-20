import axios from 'axios';
import { LinearClient } from '../linear-client';
import type { RawLinearIssue } from '../types';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

const makeRawIssue = (
  id: string,
  identifier: string,
  stateName: string
): RawLinearIssue => ({
  id,
  identifier,
  title: `Issue ${identifier}`,
  description: `Description for ${identifier}`,
  state: { name: stateName },
  labels: { nodes: [] },
  relations: { nodes: [] },
});

describe('LinearClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, LINEAR_API_KEY: 'test-key' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('reads LINEAR_API_KEY from environment', () => {
      expect(() => new LinearClient()).not.toThrow();
    });

    it('accepts apiKey as constructor argument', () => {
      delete process.env['LINEAR_API_KEY'];
      expect(() => new LinearClient('explicit-key')).not.toThrow();
    });

    it('throws when no api key is available', () => {
      delete process.env['LINEAR_API_KEY'];
      expect(() => new LinearClient()).toThrow('LINEAR_API_KEY is required');
    });
  });

  describe('executeGraphQL()', () => {
    it('posts to the Linear API with Authorization header', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { data: { someField: 'value' }, errors: undefined },
      });

      const client = new LinearClient('my-api-key');
      const result = await client.executeGraphQL('query { viewer { id } }');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.linear.app/graphql',
        { query: 'query { viewer { id } }', variables: undefined },
        {
          headers: {
            Authorization: 'my-api-key',
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual({ someField: 'value' });
    });

    it('passes variables to the API', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { data: { issues: { nodes: [] } } },
      });

      const client = new LinearClient('key');
      const vars = { projectSlug: 'SYM', states: ['In Progress'] };
      await client.executeGraphQL('query Foo($x: String!) { x }', vars);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        { query: 'query Foo($x: String!) { x }', variables: vars },
        expect.any(Object)
      );
    });

    it('throws when GraphQL errors are returned', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { errors: [{ message: 'Unauthorized' }] },
      });
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(false);

      const client = new LinearClient('key');
      await expect(client.executeGraphQL('query { viewer { id } }')).rejects.toThrow(
        'Linear API GraphQL errors: Unauthorized'
      );
    });

    it('throws with "Linear API" prefix on HTTP errors', async () => {
      const axiosError = Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        response: { status: 401 },
      });
      mockedAxios.post = jest.fn().mockRejectedValue(axiosError);
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);

      const client = new LinearClient('key');
      await expect(
        client.executeGraphQL('query { viewer { id } }')
      ).rejects.toThrow('Linear API request failed: 401');
    });
  });

  describe('fetchCandidates()', () => {
    it('returns normalized issues filtered by project slug and active states', async () => {
      const raw1 = makeRawIssue('id-1', 'SYM-1', 'In Progress');
      const raw2 = makeRawIssue('id-2', 'SYM-2', 'Todo');
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: {
          data: { issues: { nodes: [raw1, raw2] } },
        },
      });

      const client = new LinearClient('key');
      const issues = await client.fetchCandidates('SYM', ['In Progress', 'Todo']);

      expect(issues).toHaveLength(2);
      expect(issues[0]).toMatchObject({
        id: 'id-1',
        identifier: 'SYM-1',
        state: 'In Progress',
      });
      expect(issues[1]).toMatchObject({
        id: 'id-2',
        identifier: 'SYM-2',
        state: 'Todo',
      });
    });

    it('returns empty array when no issues match', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { data: { issues: { nodes: [] } } },
      });

      const client = new LinearClient('key');
      const issues = await client.fetchCandidates('SYM', ['In Progress']);
      expect(issues).toEqual([]);
    });

    it('propagates API errors', async () => {
      const axiosError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        response: undefined,
      });
      mockedAxios.post = jest.fn().mockRejectedValue(axiosError);
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);

      const client = new LinearClient('key');
      await expect(
        client.fetchCandidates('SYM', ['In Progress'])
      ).rejects.toThrow('Linear API request failed');
    });
  });

  describe('fetchIssue()', () => {
    it('returns a single normalized issue by id', async () => {
      const raw = makeRawIssue('issue-123', 'SYM-99', 'In Progress');
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { data: { issue: raw } },
      });

      const client = new LinearClient('key');
      const issue = await client.fetchIssue('issue-123');

      expect(issue).toMatchObject({
        id: 'issue-123',
        identifier: 'SYM-99',
        state: 'In Progress',
      });
    });
  });

  describe('fetchTerminalIssues()', () => {
    it('returns normalized terminal issues by project slug and terminal states', async () => {
      const raw1 = makeRawIssue('done-1', 'SYM-3', 'Done');
      const raw2 = makeRawIssue('done-2', 'SYM-4', 'Cancelled');
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: {
          data: { issues: { nodes: [raw1, raw2] } },
        },
      });

      const client = new LinearClient('key');
      const issues = await client.fetchTerminalIssues('SYM', ['Done', 'Cancelled']);

      expect(issues).toHaveLength(2);
      expect(issues[0]?.state).toBe('Done');
      expect(issues[1]?.state).toBe('Cancelled');
    });
  });
});
