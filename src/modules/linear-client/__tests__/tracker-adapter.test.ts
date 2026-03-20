import { TrackerAdapter } from '../tracker-adapter';
import type { RawLinearIssue } from '../types';

const makeRawIssue = (overrides?: Partial<RawLinearIssue>): RawLinearIssue => ({
  id: 'abc-123',
  identifier: 'SYM-12',
  title: 'Fix the thing',
  description: 'Some description',
  state: { name: 'In Progress' },
  labels: { nodes: [{ name: 'bug' }, { name: 'high-priority' }] },
  relations: {
    nodes: [
      {
        relatedIssue: {
          identifier: 'SYM-10',
          state: { name: 'Todo' },
        },
      },
    ],
  },
  ...overrides,
});

describe('TrackerAdapter', () => {
  describe('normalizeIssue()', () => {
    it('maps all fields from raw Linear issue to core Issue model', () => {
      const raw = makeRawIssue();
      const issue = TrackerAdapter.normalizeIssue(raw);

      expect(issue.id).toBe('abc-123');
      expect(issue.identifier).toBe('SYM-12');
      expect(issue.title).toBe('Fix the thing');
      expect(issue.description).toBe('Some description');
      expect(issue.state).toBe('In Progress');
      expect(issue.labels).toEqual(['bug', 'high-priority']);
      expect(issue.blockers).toEqual([
        { identifier: 'SYM-10', state: 'Todo' },
      ]);
    });

    it('uses empty string for null description', () => {
      const raw = makeRawIssue({ description: null });
      const issue = TrackerAdapter.normalizeIssue(raw);
      expect(issue.description).toBe('');
    });

    it('returns empty labels array when no labels', () => {
      const raw = makeRawIssue({ labels: { nodes: [] } });
      const issue = TrackerAdapter.normalizeIssue(raw);
      expect(issue.labels).toEqual([]);
    });

    it('returns empty blockers array when no relations', () => {
      const raw = makeRawIssue({ relations: { nodes: [] } });
      const issue = TrackerAdapter.normalizeIssue(raw);
      expect(issue.blockers).toEqual([]);
    });

    it('handles multiple labels', () => {
      const raw = makeRawIssue({
        labels: { nodes: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
      });
      const issue = TrackerAdapter.normalizeIssue(raw);
      expect(issue.labels).toEqual(['a', 'b', 'c']);
    });

    it('handles multiple blockers', () => {
      const raw = makeRawIssue({
        relations: {
          nodes: [
            { relatedIssue: { identifier: 'SYM-1', state: { name: 'Done' } } },
            { relatedIssue: { identifier: 'SYM-2', state: { name: 'Todo' } } },
          ],
        },
      });
      const issue = TrackerAdapter.normalizeIssue(raw);
      expect(issue.blockers).toEqual([
        { identifier: 'SYM-1', state: 'Done' },
        { identifier: 'SYM-2', state: 'Todo' },
      ]);
    });
  });

  describe('normalizeIssues()', () => {
    it('normalizes a list of raw issues', () => {
      const raws = [
        makeRawIssue({ id: '1', identifier: 'SYM-1' }),
        makeRawIssue({ id: '2', identifier: 'SYM-2' }),
      ];
      const issues = TrackerAdapter.normalizeIssues(raws);
      expect(issues).toHaveLength(2);
      expect(issues[0]?.identifier).toBe('SYM-1');
      expect(issues[1]?.identifier).toBe('SYM-2');
    });

    it('returns empty array for empty input', () => {
      const issues = TrackerAdapter.normalizeIssues([]);
      expect(issues).toEqual([]);
    });
  });
});
