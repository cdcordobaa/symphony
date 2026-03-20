import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { HookRunner, type HookError } from "./HookRunner.js";

describe("HookRunner", () => {
  let tmpDir: string;
  let runner: HookRunner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hookrunner-test-"));
    runner = new HookRunner();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("executes a script in the given cwd and captures stdout", async () => {
    const result = await runner.exec("echo hello", tmpDir, 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.timedOut).toBe(false);
  });

  it("captures stderr output", async () => {
    const result = await runner.exec("echo error-msg >&2", tmpDir, 5000);
    expect(result.stderr.trim()).toBe("error-msg");
  });

  it("runs hook with access to cwd", async () => {
    const outFile = path.join(tmpDir, "marker.txt");
    await runner.exec(`touch marker.txt`, tmpDir, 5000);
    expect(fs.existsSync(outFile)).toBe(true);
  });

  it("kills hook and rejects when timeout is exceeded", async () => {
    const start = Date.now();
    let error: HookError | undefined;

    await runner.exec("sleep 10", tmpDir, 200).catch((e: HookError) => {
      error = e;
    });

    const elapsed = Date.now() - start;
    expect(error).toBeDefined();
    expect(error?.reason).toMatch(/exceeded timeout/i);
    expect(elapsed).toBeLessThan(2000); // should be killed well before 10s
  });

  it("resolves with non-zero exit code for failing scripts", async () => {
    const result = await runner.exec("exit 1", tmpDir, 5000);
    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
  });
});
