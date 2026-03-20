import { Liquid } from 'liquidjs';
import type { IssueContext } from './types.js';

export interface RenderContext {
  issue: IssueContext;
  attempt: number;
}

export class PromptRenderer {
  private readonly engine: Liquid;

  constructor() {
    this.engine = new Liquid({
      strictVariables: false,
      strictFilters: false,
    });
  }

  /**
   * Renders a Liquid template string with issue and attempt variables.
   */
  async render(template: string, context: RenderContext): Promise<string> {
    return this.engine.parseAndRender(template, {
      issue: context.issue,
      attempt: context.attempt,
    });
  }
}
