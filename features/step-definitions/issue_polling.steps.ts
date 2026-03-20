import { defineFeature, loadFeature } from 'jest-cucumber';
import axios from 'axios';
import { LinearClient } from '../../src/modules/linear-client/linear-client';
import { TrackerAdapter } from '../../src/modules/linear-client/tracker-adapter';
import type { RawLinearIssue } from '../../src/modules/linear-client/types';
import type { Issue } from '../../src/modules/linear-client/types';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

const feature = loadFeature('./features/issue_polling.feature');

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
  labels: { nodes: [{ name: 'test-label' }] },
  relations: {
    nodes: [
      { relatedIssue: { identifier: 'SYM-0', state: { name: 'Done' } } },
    ],
  },
});

const makeFullRawIssue = (): RawLinearIssue => ({
  id: 'full-id-123',
  identifier: 'SYM-12',
  title: 'Full Issue Title',
  description: 'Full description text',
  state: { name: 'In Progress' },
  labels: { nodes: [{ name: 'bug' }, { name: 'critical' }] },
  relations: {
    nodes: [
      { relatedIssue: { identifier: 'SYM-10', state: { name: 'Todo' } } },
    ],
  },
});

defineFeature(feature, (test) => {
  let client: LinearClient;
  let issues: Issue[];
  let singleIssue: Issue;
  let thrownError: Error | null;
  let rawResult: unknown;

  beforeEach(() => {
    process.env['LINEAR_API_KEY'] = 'test-api-key';
    jest.clearAllMocks();
    issues = [];
    thrownError = null;
  });

  afterEach(() => {
    delete process.env['LINEAR_API_KEY'];
  });

  test('Fetch active issues by project slug and state filter', ({
    given,
    when,
    then,
    and,
  }) => {
    // Background step first
    given(
      /^the LINEAR_API_KEY environment variable is set to "(.*)"$/,
      (key: string) => {
        process.env['LINEAR_API_KEY'] = key;
      }
    );

    given(
      /^the Linear API returns issues for project "(.*)" with states "(.*)"$/,
      (_project: string, _states: string) => {
        const nodes = [
          makeRawIssue('id-1', 'SYM-1', 'In Progress'),
          makeRawIssue('id-2', 'SYM-2', 'Todo'),
        ];
        mockedAxios.post = jest.fn().mockResolvedValue({
          data: { data: { issues: { nodes } } },
        });
      }
    );

    when(
      /^I call fetchCandidates with project slug "(.*)" and active states \["(.*)"\]$/,
      async (slug: string, statesStr: string) => {
        client = new LinearClient('test-api-key');
        const states = statesStr.split('", "');
        issues = await client.fetchCandidates(slug, states);
      }
    );

    then(
      'the result should be a list of normalized Issue objects',
      () => {
        expect(issues.length).toBeGreaterThan(0);
      }
    );

    and(
      'each issue should have id, identifier, title, description, state, labels, and blockers fields',
      () => {
        for (const issue of issues) {
          expect(issue).toHaveProperty('id');
          expect(issue).toHaveProperty('identifier');
          expect(issue).toHaveProperty('title');
          expect(issue).toHaveProperty('description');
          expect(issue).toHaveProperty('state');
          expect(issue).toHaveProperty('labels');
          expect(issue).toHaveProperty('blockers');
        }
      }
    );
  });

  test('Filter issues by active state', ({ given, when, then }) => {
    given(
      /^the LINEAR_API_KEY environment variable is set to "(.*)"$/,
      (key: string) => {
        process.env['LINEAR_API_KEY'] = key;
      }
    );

    given(
      /^the Linear API returns issues with mixed states for project "(.*)"$/,
      (_project: string) => {
        const nodes = [makeRawIssue('id-1', 'SYM-1', 'In Progress')];
        mockedAxios.post = jest.fn().mockResolvedValue({
          data: { data: { issues: { nodes } } },
        });
      }
    );

    when(
      /^I call fetchCandidates with project slug "(.*)" and active states \["(.*)"\]$/,
      async (slug: string, state: string) => {
        client = new LinearClient('test-api-key');
        issues = await client.fetchCandidates(slug, [state]);
      }
    );

    then(
      /^only issues in "(.*)" state should be returned$/,
      (state: string) => {
        expect(issues.every((i) => i.state === state)).toBe(true);
      }
    );
  });

  test('Startup terminal sweep fetches terminal-state issues', ({
    given,
    when,
    then,
  }) => {
    given(
      /^the LINEAR_API_KEY environment variable is set to "(.*)"$/,
      (key: string) => {
        process.env['LINEAR_API_KEY'] = key;
      }
    );

    given(
      /^the Linear API returns terminal issues for project "(.*)" with states "(.*)"$/,
      (_project: string, _states: string) => {
        const nodes = [
          makeRawIssue('done-1', 'SYM-3', 'Done'),
          makeRawIssue('done-2', 'SYM-4', 'Cancelled'),
        ];
        mockedAxios.post = jest.fn().mockResolvedValue({
          data: { data: { issues: { nodes } } },
        });
      }
    );

    when(
      /^I call fetchTerminalIssues with project slug "(.*)" and terminal states \["(.*)"\]$/,
      async (slug: string, statesStr: string) => {
        client = new LinearClient('test-api-key');
        const states = statesStr.split('", "');
        issues = await client.fetchTerminalIssues(slug, states);
      }
    );

    then(
      'the result should be a list of normalized Issue objects in terminal states',
      () => {
        expect(issues.length).toBeGreaterThan(0);
        const terminalStates = new Set(['Done', 'Cancelled']);
        expect(issues.every((i) => terminalStates.has(i.state))).toBe(true);
      }
    );
  });

  test('Normalize raw Linear issue model into core Issue model', ({
    given,
    when,
    then,
    and,
  }) => {
    let rawIssue: RawLinearIssue;
    let normalizedIssue: Issue;

    given(
      /^the LINEAR_API_KEY environment variable is set to "(.*)"$/,
      (_key: string) => { /* already set in beforeEach */ }
    );

    given(
      'the Linear API returns a raw issue with all fields populated',
      () => {
        rawIssue = makeFullRawIssue();
      }
    );

    when('the TrackerAdapter normalizes the raw issue', () => {
      normalizedIssue = TrackerAdapter.normalizeIssue(rawIssue);
    });

    then('the normalized issue should have the correct id', () => {
      expect(normalizedIssue.id).toBe('full-id-123');
    });

    and(
      /^the normalized issue should have the correct identifier like "(.*)"$/,
      (_expected: string) => {
        expect(normalizedIssue.identifier).toBe('SYM-12');
      }
    );

    and('the normalized issue should have the correct title', () => {
      expect(normalizedIssue.title).toBe('Full Issue Title');
    });

    and('the normalized issue should have the correct description', () => {
      expect(normalizedIssue.description).toBe('Full description text');
    });

    and('the normalized issue should have the correct state name', () => {
      expect(normalizedIssue.state).toBe('In Progress');
    });

    and('the normalized issue should have labels as an array of strings', () => {
      expect(Array.isArray(normalizedIssue.labels)).toBe(true);
      expect(normalizedIssue.labels).toContain('bug');
    });

    and(
      'the normalized issue should have blockers as an array with identifier and state fields',
      () => {
        expect(Array.isArray(normalizedIssue.blockers)).toBe(true);
        expect(normalizedIssue.blockers[0]).toHaveProperty('identifier');
        expect(normalizedIssue.blockers[0]).toHaveProperty('state');
      }
    );
  });

  test('Fetch single issue by ID', ({ given, when, then }) => {
    given(
      /^the LINEAR_API_KEY environment variable is set to "(.*)"$/,
      (key: string) => {
        process.env['LINEAR_API_KEY'] = key;
      }
    );

    given(
      /^the Linear API returns a single issue with id "(.*)"$/,
      (id: string) => {
        const raw = makeRawIssue(id, 'SYM-99', 'In Progress');
        mockedAxios.post = jest.fn().mockResolvedValue({
          data: { data: { issue: raw } },
        });
      }
    );

    when(
      /^I call fetchIssue with id "(.*)"$/,
      async (id: string) => {
        client = new LinearClient('test-api-key');
        singleIssue = await client.fetchIssue(id);
      }
    );

    then(
      /^the result should be a single normalized Issue with id "(.*)"$/,
      (id: string) => {
        expect(singleIssue.id).toBe(id);
      }
    );
  });

  test('Handle API errors gracefully', ({ given, when, then }) => {
    given(
      /^the LINEAR_API_KEY environment variable is set to "(.*)"$/,
      (key: string) => {
        process.env['LINEAR_API_KEY'] = key;
      }
    );

    given('the Linear API returns an HTTP 401 error', () => {
      const axiosError = Object.assign(
        new Error('Request failed with status code 401'),
        {
          isAxiosError: true,
          response: { status: 401 },
        }
      );
      mockedAxios.post = jest.fn().mockRejectedValue(axiosError);
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
    });

    when(
      /^I call fetchCandidates with project slug "(.*)" and active states \["(.*)"\]$/,
      async (slug: string, state: string) => {
        client = new LinearClient('test-api-key');
        try {
          await client.fetchCandidates(slug, [state]);
        } catch (e) {
          thrownError = e as Error;
        }
      }
    );

    then(
      /^an error should be thrown with a message containing "(.*)"$/,
      (msgPart: string) => {
        expect(thrownError).not.toBeNull();
        expect(thrownError?.message).toContain(msgPart);
      }
    );
  });

  test('Proxy raw GraphQL query via linear_graphql tool', ({
    given,
    when,
    then,
  }) => {
    given(
      /^the LINEAR_API_KEY environment variable is set to "(.*)"$/,
      (key: string) => {
        process.env['LINEAR_API_KEY'] = key;
      }
    );

    given('the Linear API accepts a raw GraphQL query', () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { data: { rawField: 'raw-value' } },
      });
    });

    when(
      'I call executeGraphQL with a raw query string and variables',
      async () => {
        client = new LinearClient('test-api-key');
        rawResult = await client.executeGraphQL(
          'query { viewer { id } }',
          { someVar: 'value' }
        );
      }
    );

    then(
      'the raw API response should be returned without normalization',
      () => {
        expect(rawResult).toEqual({ rawField: 'raw-value' });
      }
    );
  });
});
