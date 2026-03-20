import { spawn } from "child_process";

export interface HookResult {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export interface HookError {
  hookScript: string;
  cwd: string;
  timeoutMs: number;
  reason: string;
}

export class HookRunner {
  /**
   * Execute a shell hook script in the given working directory.
   * If the process exceeds timeoutMs it is SIGKILL'd and the returned
   * promise rejects with a HookError.
   */
  exec(hookScript: string, cwd: string, timeoutMs: number = 60000): Promise<HookResult> {
    return new Promise((resolve, reject) => {
      const child = spawn("sh", ["-c", hookScript], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        process.stdout.write(
          JSON.stringify({ stream: "stdout", data: chunk.toString() }) + "\n",
        );
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        process.stderr.write(
          JSON.stringify({ stream: "stderr", data: chunk.toString() }) + "\n",
        );
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
        const err: HookError = {
          hookScript,
          cwd,
          timeoutMs,
          reason: `Hook exceeded timeout of ${timeoutMs}ms and was killed`,
        };
        reject(err);
      }, timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timer);
        if (!timedOut) {
          resolve({ exitCode: code, timedOut: false, stdout, stderr });
        }
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject({ hookScript, cwd, timeoutMs, reason: err.message } as HookError);
        }
      });
    });
  }
}
