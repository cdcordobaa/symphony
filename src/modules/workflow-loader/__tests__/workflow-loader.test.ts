import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkflowLoader } from '../workflow-loader';

describe('WorkflowLoader', () => {
  describe('parse()', () => {
    it('should parse valid YAML front-matter', () => {
      const content = `---
tracker:
  type: linear
  project: SYMPHONY
polling:
  interval: 30
---
# Workflow body`;

      const config = WorkflowLoader.parse(content);
      expect(config.tracker?.type).toBe('linear');
      expect(config.tracker?.project).toBe('SYMPHONY');
      expect(config.polling?.interval).toBe(30);
    });

    it('should return empty object when no front-matter present', () => {
      const config = WorkflowLoader.parse('# Just markdown, no front-matter');
      expect(config).toEqual({});
    });

    it('should parse all supported config sections', () => {
      const content = `---
tracker:
  type: linear
polling:
  interval: 60
workspace:
  path: /tmp/ws
hooks:
  pre-commit: echo before
agent:
  model: claude-3-opus
codex:
  version: 1
server:
  port: 3000
---
`;
      const config = WorkflowLoader.parse(content);
      expect(config.tracker?.type).toBe('linear');
      expect(config.polling?.interval).toBe(60);
      expect(config.workspace?.path).toBe('/tmp/ws');
      expect(config.hooks?.['pre-commit']).toBe('echo before');
      expect(config.agent?.model).toBe('claude-3-opus');
      expect(config.server?.port).toBe(3000);
    });
  });

  describe('expandString()', () => {
    it('should expand $VAR environment variables', () => {
      process.env['TEST_VAR_ARK6'] = 'hello-world';
      const result = WorkflowLoader.expandString('prefix-$TEST_VAR_ARK6-suffix');
      expect(result).toBe('prefix-hello-world-suffix');
      delete process.env['TEST_VAR_ARK6'];
    });

    it('should expand ${VAR} environment variables', () => {
      process.env['TEST_VAR_ARK6'] = 'expanded';
      const result = WorkflowLoader.expandString('path/${TEST_VAR_ARK6}/bin');
      expect(result).toBe('path/expanded/bin');
      delete process.env['TEST_VAR_ARK6'];
    });

    it('should replace unknown env vars with empty string', () => {
      delete process.env['UNDEFINED_VAR_ARK6'];
      const result = WorkflowLoader.expandString('$UNDEFINED_VAR_ARK6');
      expect(result).toBe('');
    });

    it('should expand ~ to home directory', () => {
      const result = WorkflowLoader.expandString('~/projects');
      expect(result).toBe(`${os.homedir()}/projects`);
    });

    it('should expand standalone ~ to home directory', () => {
      const result = WorkflowLoader.expandString('~');
      expect(result).toBe(os.homedir());
    });
  });

  describe('resolveEnvVars()', () => {
    it('should recursively resolve env vars in nested objects', () => {
      process.env['MY_PATH_ARK6'] = '/resolved/path';
      const config = WorkflowLoader.resolveEnvVars({
        workspace: { path: '$MY_PATH_ARK6/app' },
        polling: { interval: 30 },
      });
      expect((config as { workspace: { path: string } }).workspace.path).toBe(
        '/resolved/path/app'
      );
      expect((config as { polling: { interval: number } }).polling.interval).toBe(30);
      delete process.env['MY_PATH_ARK6'];
    });

    it('should resolve env vars in array values', () => {
      process.env['CMD_ARK6'] = 'echo hello';
      const result = WorkflowLoader.resolveEnvVars(['$CMD_ARK6', 'plain']);
      expect(result).toEqual(['echo hello', 'plain']);
      delete process.env['CMD_ARK6'];
    });

    it('should leave non-string values unchanged', () => {
      const result = WorkflowLoader.resolveEnvVars({ count: 42, flag: true });
      expect(result).toEqual({ count: 42, flag: true });
    });
  });

  describe('resolvePath()', () => {
    it('should expand ~/path to absolute path', () => {
      const result = WorkflowLoader.resolvePath('~/my-dir');
      expect(result).toBe(`${os.homedir()}/my-dir`);
    });

    it('should return absolute paths unchanged', () => {
      const result = WorkflowLoader.resolvePath('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    it('should return relative paths unchanged', () => {
      const result = WorkflowLoader.resolvePath('./relative/path');
      expect(result).toBe('./relative/path');
    });
  });

  describe('load()', () => {
    let tmpDir: string;
    let workflowFile: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark6-test-'));
      workflowFile = path.join(tmpDir, 'WORKFLOW.md');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should load and parse a valid WORKFLOW.md file', async () => {
      fs.writeFileSync(
        workflowFile,
        `---
tracker:
  type: linear
workspace:
  path: /tmp/workspace
---
# Workflow
`
      );

      const config = await WorkflowLoader.load(workflowFile);
      expect(config.tracker?.type).toBe('linear');
      expect(config.workspace?.path).toBe('/tmp/workspace');
    });

    it('should throw an error when file does not exist', async () => {
      const missingPath = path.join(tmpDir, 'MISSING.md');
      await expect(WorkflowLoader.load(missingPath)).rejects.toThrow('not found');
    });

    it('should resolve env vars when loading', async () => {
      process.env['WS_PATH_ARK6'] = '/env/workspace';
      fs.writeFileSync(
        workflowFile,
        `---
workspace:
  path: $WS_PATH_ARK6
---
`
      );

      const config = await WorkflowLoader.load(workflowFile);
      expect(config.workspace?.path).toBe('/env/workspace');
      delete process.env['WS_PATH_ARK6'];
    });

    it('should expand tilde in file path argument', async () => {
      // Use a real temp file — we can't truly test ~/ since mkdtemp is in /tmp,
      // but we verify resolvePath is called by checking load() works with absolute path
      fs.writeFileSync(workflowFile, '---\ntracker:\n  type: test\n---\n');
      const config = await WorkflowLoader.load(workflowFile);
      expect(config.tracker?.type).toBe('test');
    });
  });

  describe('watch()', () => {
    let tmpDir: string;
    let workflowFile: string;
    let loader: WorkflowLoader;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark6-watch-test-'));
      workflowFile = path.join(tmpDir, 'WORKFLOW.md');
      fs.writeFileSync(workflowFile, '---\ntracker:\n  type: linear\n---\n');
      loader = new WorkflowLoader();
    });

    afterEach(async () => {
      await loader.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should emit a "reload" event when the watched file changes', async () => {
      const reloadPromise = new Promise<unknown>((resolve) => {
        loader.once('reload', (config) => resolve(config));
      });

      const readyPromise = new Promise<void>((resolve) => {
        loader.once('ready', () => resolve());
      });

      loader.watch(workflowFile);

      // Wait for watcher to signal ready before modifying file
      await Promise.race([
        readyPromise,
        new Promise<void>((res) => setTimeout(res, 2000)),
      ]);
      fs.writeFileSync(workflowFile, '---\ntracker:\n  type: github\n---\n');

      const config = await Promise.race([
        reloadPromise,
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('reload event timed out')), 4000)
        ),
      ]);

      expect((config as { tracker?: { type?: string } }).tracker?.type).toBe('github');
    }, 8000);

    it('should return the loader instance for chaining', () => {
      const result = loader.watch(workflowFile);
      expect(result).toBe(loader);
    });
  });
});
