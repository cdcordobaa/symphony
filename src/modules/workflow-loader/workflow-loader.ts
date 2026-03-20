import fs from 'node:fs';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { parse } from 'yaml';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import type { WorkflowConfig } from './types';

const FRONT_MATTER_REGEX = /^---\n([\s\S]*?)\n---/;
const FRONT_MATTER_STRIP_REGEX = /^---\n[\s\S]*?\n---\n?/;

function resolveValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return WorkflowLoader.expandString(value);
  }
  if (Array.isArray(value)) {
    return value.map(resolveValue);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = resolveValue(v);
    }
    return result;
  }
  return value;
}

export class WorkflowLoader extends EventEmitter {
  private watcher: FSWatcher | null = null;

  /**
   * Reads a WORKFLOW.md file, parses its YAML front-matter, and returns a
   * typed WorkflowConfig with all environment variables and tilde paths resolved.
   */
  static async load(filePath: string): Promise<WorkflowConfig> {
    const resolvedPath = WorkflowLoader.resolvePath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`WORKFLOW.md not found at: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return WorkflowLoader.parse(content);
  }

  /**
   * Reads a WORKFLOW.md file and returns both the parsed config and the raw body text.
   */
  static async loadWithBody(filePath: string): Promise<{ config: WorkflowConfig; body: string }> {
    const resolvedPath = WorkflowLoader.resolvePath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`WORKFLOW.md not found at: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return {
      config: WorkflowLoader.parse(content),
      body: WorkflowLoader.parseBody(content),
    };
  }

  /**
   * Extracts the markdown body (everything after the front-matter block).
   */
  static parseBody(content: string): string {
    return content.replace(FRONT_MATTER_STRIP_REGEX, '');
  }

  /**
   * Parses YAML front-matter from markdown content and resolves env vars.
   */
  static parse(content: string): WorkflowConfig {
    const match = FRONT_MATTER_REGEX.exec(content);
    if (!match || !match[1]) {
      return {};
    }

    const raw = parse(match[1]) as unknown;
    return WorkflowLoader.resolveEnvVars(raw) as WorkflowConfig;
  }

  /**
   * Resolves `~` and `~/` prefixes in file paths to the user's home directory.
   */
  static resolvePath(filePath: string): string {
    if (filePath === '~') return os.homedir();
    if (filePath.startsWith('~/')) {
      return os.homedir() + filePath.slice(1);
    }
    return filePath;
  }

  /**
   * Recursively resolves environment variables and tilde paths in an object.
   */
  static resolveEnvVars(value: unknown): unknown {
    return resolveValue(value);
  }

  /**
   * Expands `~` to home directory and `$VAR` / `${VAR}` to env var values
   * within a single string.
   */
  static expandString(str: string): string {
    // Expand ~ prefix to home directory
    let result = str;
    if (result === '~') return os.homedir();
    if (result.startsWith('~/')) {
      result = os.homedir() + result.slice(1);
    }

    // Expand $VAR and ${VAR}
    result = result.replace(
      /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (_match, braced: string | undefined, bare: string | undefined) => {
        const varName = braced ?? bare ?? '';
        return process.env[varName] ?? '';
      }
    );

    return result;
  }

  /**
   * Starts watching the given WORKFLOW.md file with chokidar.
   * Emits a `reload` event with the updated WorkflowConfig whenever the file changes.
   * Returns `this` for chaining.
   */
  watch(filePath: string): this {
    const resolvedPath = WorkflowLoader.resolvePath(filePath);

    if (this.watcher) {
      void this.watcher.close();
    }

    this.watcher = chokidar.watch(resolvedPath, {
      ignoreInitial: true,
    });

    this.watcher.on('ready', () => {
      this.emit('ready');
    });

    this.watcher.on('change', () => {
      WorkflowLoader.load(resolvedPath)
        .then((config) => {
          this.emit('reload', config);
        })
        .catch((err: unknown) => {
          this.emit('error', err);
        });
    });

    return this;
  }

  /**
   * Stops the file watcher if one is active.
   */
  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
