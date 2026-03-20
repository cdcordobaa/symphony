import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { WorkspaceManager, sanitizeIssueId, type Issue } from "./WorkspaceManager.js";
import { HookRunner } from "./HookRunner.js";

describe("sanitizeIssueId", () => {
  it("passes through normal identifiers unchanged", () => {
    expect(sanitizeIssueId("SYM-12")).toBe("SYM-12");
  });

  it("replaces path separators with dashes", () => {
    expect(sanitizeIssueId("SYM-42/evil")).toBe("SYM-42-evil");
  });

  it("collapses multiple unsafe characters into a single dash", () => {
    expect(sanitizeIssueId("SYM-42/evil/../path")).toBe("SYM-42-evil-path");
  });

  it("strips leading and trailing dashes", () => {
    expect(sanitizeIssueId("/SYM-42/")).toBe("SYM-42");
  });

  it("preserves underscores", () => {
    expect(sanitizeIssueId("SYM_42")).toBe("SYM_42");
  });
});

describe("WorkspaceManager", () => {
  let tmpRoot: string;
  let manager: WorkspaceManager;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ws-manager-test-"));
    manager = new WorkspaceManager({ root: tmpRoot });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe("create()", () => {
    it("creates the workspace directory", async () => {
      const issue: Issue = { id: "SYM-12" };
      const wsPath = await manager.create(issue);
      expect(fs.existsSync(wsPath)).toBe(true);
      expect(wsPath).toBe(path.join(tmpRoot, "SYM-12"));
    });

    it("sanitizes the issue id in the path", async () => {
      const issue: Issue = { id: "SYM-42/evil/../path" };
      const wsPath = await manager.create(issue);
      expect(path.basename(wsPath)).toBe("SYM-42-evil-path");
      expect(fs.existsSync(wsPath)).toBe(true);
    });

    it("runs the after_create hook in the workspace directory", async () => {
      const issue: Issue = {
        id: "SYM-42",
        hooks: { after_create: "touch hook-ran.txt" },
      };
      const wsPath = await manager.create(issue);
      expect(fs.existsSync(path.join(wsPath, "hook-ran.txt"))).toBe(true);
    });

    it("creates workspace even when no hooks are defined", async () => {
      const issue: Issue = { id: "SYM-99" };
      await expect(manager.create(issue)).resolves.not.toThrow();
    });
  });

  describe("remove()", () => {
    it("deletes the workspace directory", async () => {
      const issue: Issue = { id: "SYM-12" };
      await manager.create(issue);
      await manager.remove(issue);
      expect(fs.existsSync(path.join(tmpRoot, "SYM-12"))).toBe(false);
    });

    it("runs the before_remove hook before deleting", async () => {
      let hookRan = false;
      const mockRunner = {
        exec: jest.fn().mockImplementation(async () => {
          hookRan = true;
          return { exitCode: 0, timedOut: false, stdout: "", stderr: "" };
        }),
      } as unknown as HookRunner;

      const m = new WorkspaceManager({ root: tmpRoot, hookRunner: mockRunner });
      const issue: Issue = {
        id: "SYM-12",
        hooks: { before_remove: "echo removing" },
      };
      await m.create(issue);
      await m.remove(issue);

      expect(hookRan).toBe(true);
      expect(fs.existsSync(path.join(tmpRoot, "SYM-12"))).toBe(false);
    });

    it("removes directory even if before_remove hook times out", async () => {
      const slowRunner = new HookRunner();
      const m = new WorkspaceManager({
        root: tmpRoot,
        hookRunner: slowRunner,
        hooksTimeoutMs: 100,
      });
      const issue: Issue = {
        id: "SYM-12",
        hooks: { before_remove: "sleep 10" },
      };
      await m.create(issue);
      await m.remove(issue); // should not throw
      expect(fs.existsSync(path.join(tmpRoot, "SYM-12"))).toBe(false);
    });

    it("is a no-op when workspace does not exist", async () => {
      const issue: Issue = { id: "SYM-nonexistent" };
      await expect(manager.remove(issue)).resolves.not.toThrow();
    });
  });

  describe("workspacePath()", () => {
    it("returns deterministic sanitized path under root", () => {
      const issue: Issue = { id: "ARK-7" };
      const p = manager.workspacePath(issue);
      expect(p).toBe(path.join(tmpRoot, "ARK-7"));
    });
  });
});
