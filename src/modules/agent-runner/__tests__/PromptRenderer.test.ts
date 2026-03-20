import { PromptRenderer } from '../PromptRenderer.js';
import type { IssueContext } from '../types.js';

const issue: IssueContext = {
  identifier: 'SYM-42',
  title: 'Fix the bug',
  state: 'In Progress',
  description: 'A detailed description',
  labels: ['bug', 'urgent'],
  blockers: ['SYM-10'],
};

describe('PromptRenderer', () => {
  let renderer: PromptRenderer;

  beforeEach(() => {
    renderer = new PromptRenderer();
  });

  it('renders issue.identifier into template', async () => {
    const result = await renderer.render('Issue: {{ issue.identifier }}', { issue, attempt: 1 });
    expect(result).toBe('Issue: SYM-42');
  });

  it('renders issue.title into template', async () => {
    const result = await renderer.render('Title: {{ issue.title }}', { issue, attempt: 1 });
    expect(result).toBe('Title: Fix the bug');
  });

  it('renders attempt counter into template', async () => {
    const result = await renderer.render('Attempt: {{ attempt }}', { issue, attempt: 3 });
    expect(result).toBe('Attempt: 3');
  });

  it('renders issue.state into template', async () => {
    const result = await renderer.render('State: {{ issue.state }}', { issue, attempt: 1 });
    expect(result).toBe('State: In Progress');
  });

  it('renders issue.description into template', async () => {
    const result = await renderer.render('Desc: {{ issue.description }}', { issue, attempt: 1 });
    expect(result).toBe('Desc: A detailed description');
  });

  it('renders issue.labels as array via liquid', async () => {
    const result = await renderer.render('{% for l in issue.labels %}{{ l }} {% endfor %}', { issue, attempt: 1 });
    expect(result).toBe('bug urgent ');
  });

  it('renders issue.blockers as array via liquid', async () => {
    const result = await renderer.render('{% for b in issue.blockers %}{{ b }} {% endfor %}', { issue, attempt: 1 });
    expect(result).toBe('SYM-10 ');
  });

  it('handles template without variables', async () => {
    const result = await renderer.render('No variables here', { issue, attempt: 1 });
    expect(result).toBe('No variables here');
  });

  it('renders empty string for missing variable gracefully', async () => {
    const result = await renderer.render('{{ issue.nonexistent }}', { issue, attempt: 1 });
    expect(result).toBe('');
  });
});
