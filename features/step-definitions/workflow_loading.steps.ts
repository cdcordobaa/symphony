import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { WorkflowLoader } from '../../src/modules/workflow-loader/workflow-loader';
import type { WorkflowConfig } from '../../src/modules/workflow-loader/types';

const feature = loadFeature('./features/workflow_loading.feature');

defineFeature(feature, (test) => {
  let tmpDir: string;
  let workflowFile: string;
  let loadedConfig: WorkflowConfig | undefined;
  let thrownError: Error | undefined;
  let loader: WorkflowLoader | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark6-bdd-'));
    workflowFile = path.join(tmpDir, 'WORKFLOW.md');
    loadedConfig = undefined;
    thrownError = undefined;
    loader = undefined;
  });

  afterEach(async () => {
    if (loader) {
      await loader.close();
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('Load a valid WORKFLOW.md with YAML front-matter', ({ given, when, then, and }) => {
    given(/^a WORKFLOW\.md file with the following YAML front-matter:$/, (docString: string) => {
      // Trim surrounding quotes/whitespace from docString
      fs.writeFileSync(workflowFile, docString.trim());
    });

    when('I load the workflow config', async () => {
      loadedConfig = await WorkflowLoader.load(workflowFile);
    });

    then(/^the config should have tracker type "([^"]*)"$/, (trackerType: string) => {
      expect(loadedConfig?.tracker?.type).toBe(trackerType);
    });

    and(/^the config should have polling interval (\d+)$/, (interval: string) => {
      expect(loadedConfig?.polling?.interval).toBe(parseInt(interval, 10));
    });

    and(/^the config should have workspace path "([^"]*)"$/, (workspacePath: string) => {
      expect(loadedConfig?.workspace?.path).toBe(workspacePath);
    });
  });

  test('Missing WORKFLOW.md file', ({ given, when, then }) => {
    given("no WORKFLOW.md file exists at the path", () => {
      workflowFile = path.join(tmpDir, 'NONEXISTENT.md');
    });

    when('I try to load the workflow config', async () => {
      try {
        await WorkflowLoader.load(workflowFile);
      } catch (err) {
        thrownError = err as Error;
      }
    });

    then(/^an error should be thrown with a message containing "([^"]*)"$/, (msg: string) => {
      expect(thrownError).toBeDefined();
      expect(thrownError?.message?.toLowerCase()).toContain(msg.toLowerCase());
    });
  });

  test('Environment variable resolution in config values', ({ given, when, then }) => {
    given(
      /^an environment variable "([^"]*)" is set to "([^"]*)"$/,
      (varName: string, varValue: string) => {
        process.env[varName] = varValue;
      }
    );

    given(/^a WORKFLOW\.md file with the following YAML front-matter:$/, (docString: string) => {
      fs.writeFileSync(workflowFile, docString.trim());
    });

    when('I load the workflow config', async () => {
      loadedConfig = await WorkflowLoader.load(workflowFile);
    });

    then(
      /^the workspace path should be resolved to "([^"]*)"$/,
      (expectedPath: string) => {
        expect(loadedConfig?.workspace?.path).toBe(expectedPath);
        delete process.env['SYMPHONY_WORKSPACE'];
      }
    );
  });

  test('Tilde expansion in path values', ({ given, when, then }) => {
    given(/^a WORKFLOW\.md file with the following YAML front-matter:$/, (docString: string) => {
      fs.writeFileSync(workflowFile, docString.trim());
    });

    when('I load the workflow config', async () => {
      loadedConfig = await WorkflowLoader.load(workflowFile);
    });

    then('the workspace path should start with the home directory', () => {
      expect(loadedConfig?.workspace?.path).toBeDefined();
      expect(loadedConfig?.workspace?.path as string).toContain(os.homedir());
    });
  });

  test('Hot-reload event emission on file change', ({ given, when, then, and }) => {
    let reloadPromise: Promise<WorkflowConfig>;
    let readyPromise: Promise<void>;

    given('a WorkflowLoader is watching a WORKFLOW.md file', () => {
      fs.writeFileSync(workflowFile, '---\ntracker:\n  type: linear\n---\n');
      loader = new WorkflowLoader();

      reloadPromise = new Promise<WorkflowConfig>((resolve) => {
        loader!.once('reload', (config: WorkflowConfig) => resolve(config));
      });
      readyPromise = new Promise<void>((resolve) => {
        loader!.once('ready', () => resolve());
      });

      loader.watch(workflowFile);
    });

    when('the WORKFLOW.md file is modified with new content', async () => {
      // Wait for watcher to signal ready before modifying file
      await Promise.race([
        readyPromise,
        new Promise<void>((res) => setTimeout(res, 2000)),
      ]);
      fs.writeFileSync(workflowFile, '---\ntracker:\n  type: github\n---\n');
    });

    then('the loader should emit a "reload" event', async () => {
      loadedConfig = await Promise.race([
        reloadPromise,
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('reload timed out')), 4000)
        ),
      ]);

      expect(loadedConfig).toBeDefined();
    });

    and('the reload event payload should contain the updated config', () => {
      expect(loadedConfig?.tracker?.type).toBe('github');
    });
  }, 10000);
});
