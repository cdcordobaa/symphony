import type { Issue, RawLinearIssue } from './types';

/**
 * TrackerAdapter normalizes raw Linear API responses into the core Issue model.
 */
export class TrackerAdapter {
  static normalizeIssue(raw: RawLinearIssue): Issue {
    return {
      id: raw.id,
      identifier: raw.identifier,
      title: raw.title,
      description: raw.description ?? '',
      state: raw.state.name,
      labels: raw.labels.nodes.map((label) => label.name),
      blockers: raw.relations.nodes.map((relation) => ({
        identifier: relation.relatedIssue.identifier,
        state: relation.relatedIssue.state.name,
      })),
    };
  }

  static normalizeIssues(raws: RawLinearIssue[]): Issue[] {
    return raws.map((raw) => TrackerAdapter.normalizeIssue(raw));
  }
}
