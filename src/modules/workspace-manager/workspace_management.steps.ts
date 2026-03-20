import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadFeature, defineFeature } from "jest-cucumber";
import { WorkspaceManager, sanitizeIssueId } from "./WorkspaceManager";
import { HookRunner } from "./HookRunner";

const feature = loadFeature("features/workspace_management.feature");

defineFeature(feature, (test) => {
  let tmpRoot: string;
  let manager: WorkspaceManager;
  let hookRunner: HookRunner;
  let createdPath: string | null;
  let sanitizedName: string | null;
  let hookError: unknown;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-ws-test-"));
    manager = new WorkspaceManager({ root: tmpRoot });
    hookRunner = new HookRunner();
    createdPath = null;
    sanitizedName = null;
    hookError = null;
  });

  afterEach(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("Create workspace directory for an issue", ({ given, when, then }) => {
    given("the workspace root is a temporary directory", () => {
      // handled in beforeEach
    });

    when(/^I create a workspace for issue "(.+)"$/, async (issueId: string) => {
      createdPath = await manager.create({ id: issueId });
    });

    then(/^the directory "<root>\/(.+)" should exist$/, (dirName: string) => {
      const fullPath = path.join(tmpRoot, dirName);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  test("Sanitize path from issue identifier", ({ given, when, then }) => {
    given("the workspace root is a temporary directory", () => {
      // handled in beforeEach
    });

    when(/^I create a workspace for issue "(.+)"$/, async (issueId: string) => {
      sanitizedName = sanitizeIssueId(issueId);
      createdPath = await manager.create({ id: issueId });
    });

    then(/^the directory name should be "(.+)"$/, (expectedName: string) => {
      expect(sanitizedName).toBe(expectedName);
      expect(fs.existsSync(path.join(tmpRoot, expectedName))).toBe(true);
    });
  });

  test("Run after_create hook on workspace creation", ({ given, when, then }) => {
    given("the workspace root is a temporary directory", () => {
      // handled in beforeEach
    });

    given(
      /^a hook script "(.+)" that writes "(.+)" to a file$/,
      (_hookName: string, _content: string) => {
        manager = new WorkspaceManager({ root: tmpRoot, hooksTimeoutMs: 5000 });
      },
    );

    when(/^I create a workspace for issue "(.+)"$/, async (issueId: string) => {
      createdPath = await manager.create({
        id: issueId,
        hooks: { after_create: "touch hook-ran.txt" },
      });
    });

    then("the hook should have been executed in the workspace directory", () => {
      expect(createdPath).not.toBeNull();
      const marker = path.join(createdPath!, "hook-ran.txt");
      expect(fs.existsSync(marker)).toBe(true);
    });
  });

  test("Hook timeout enforcement", ({ given, when, then }) => {
    given("the workspace root is a temporary directory", () => {
      // handled in beforeEach
    });

    given("a hook script that runs for 10 seconds", () => {
      // recorded for when step
    });

    when(/^I run the hook with a timeout of (\d+)ms$/, async (timeoutMs: string) => {
      hookError = null;
      try {
        await hookRunner.exec("sleep 10", tmpRoot, parseInt(timeoutMs, 10));
      } catch (e) {
        hookError = e;
      }
    });

    then("the hook process should be killed", () => {
      expect(hookError).not.toBeNull();
    });

    then("an error should be emitted", () => {
      expect(hookError).not.toBeNull();
      const err = hookError as { reason: string };
      expect(err.reason).toMatch(/timeout/i);
    });
  });

  test("Cleanup workspace on terminal state", ({ given, when, then }) => {
    given("the workspace root is a temporary directory", () => {
      // handled in beforeEach
    });

    given(/^a workspace exists for issue "(.+)"$/, async (issueId: string) => {
      await manager.create({ id: issueId });
    });

    when(/^I remove the workspace for issue "(.+)"$/, async (issueId: string) => {
      await manager.remove({ id: issueId });
    });

    then(/^the directory "<root>\/(.+)" should not exist$/, (dirName: string) => {
      const fullPath = path.join(tmpRoot, dirName);
      expect(fs.existsSync(fullPath)).toBe(false);
    });
  });
});
