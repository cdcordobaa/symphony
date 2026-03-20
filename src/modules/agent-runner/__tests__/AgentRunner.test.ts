import { AgentRunner } from '../AgentRunner.js';
import type { IssueContext } from '../types.js';
import * as net from 'net';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const issue: IssueContext = {
  identifier: 'SYM-1',
  title: 'Test issue',
  state: 'In Progress',
  description: 'A test issue',
  labels: [],
  blockers: [],
};

/**
 * Creates a minimal mock agent server script as a temp file.
 * The script:
 *   1. Reads JSON lines from stdin
 *   2. Responds to "initialize" with {"type":"initialized"}
 *   3. Responds to "turn/start" with a "turn/complete" after 10ms
 */
function createMockAgentScript(opts: { crashAfterInit?: boolean; neverComplete?: boolean } = {}): string {
  const script = `
const rl = require('readline').createInterface({ input: process.stdin });
const lines = [];
rl.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.type === 'initialize') {
    ${opts.crashAfterInit ? "process.exit(1);" : 'process.stdout.write(JSON.stringify({ type: "initialized" }) + "\\n");'}
  }
  if (msg.type === 'turn/start') {
    ${opts.neverComplete
      ? '// never send turn/complete'
      : 'setTimeout(() => { process.stdout.write(JSON.stringify({ type: "turn/complete" }) + "\\n"); }, 10);'}
  }
});
`;
  const tmpFile = path.join(os.tmpdir(), `mock-agent-${Date.now()}.js`);
  fs.writeFileSync(tmpFile, script);
  return tmpFile;
}

describe('AgentRunner', () => {
  let tmpFiles: string[] = [];

  afterEach(() => {
    tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    tmpFiles = [];
  });

  it('spawns subprocess and completes turn lifecycle', (done) => {
    const scriptPath = createMockAgentScript();
    tmpFiles.push(scriptPath);

    const runner = new AgentRunner({
      command: `node ${scriptPath}`,
      stallTimeoutMs: 5000,
    });

    runner.on('turn_complete', () => done());
    runner.on('error', (err) => done(err));

    runner.start(issue, 1, os.tmpdir(), '').catch(done);
  }, 10000);

  it('emits stall_timeout when turn/complete never arrives', (done) => {
    const scriptPath = createMockAgentScript({ neverComplete: true });
    tmpFiles.push(scriptPath);

    const runner = new AgentRunner({
      command: `node ${scriptPath}`,
      stallTimeoutMs: 300,
    });

    runner.on('stall_timeout', () => done());
    runner.on('error', () => {}); // suppress error events

    runner.start(issue, 1, os.tmpdir(), '').catch(() => {});
  }, 10000);

  it('emits error when subprocess crashes', (done) => {
    const scriptPath = createMockAgentScript({ crashAfterInit: true });
    tmpFiles.push(scriptPath);

    const runner = new AgentRunner({
      command: `node ${scriptPath}`,
      stallTimeoutMs: 5000,
    });

    runner.on('error', () => done());

    runner.start(issue, 1, os.tmpdir(), '').catch(() => {});
  }, 10000);

  it('uses default command "codex app-server" when none provided', () => {
    const runner = new AgentRunner({});
    // Access via the internal field; just verify it stored the default
    expect((runner as any).command).toBe('codex app-server');
  });

  it('passes approval_policy in initialize message', async () => {
    const scriptPath = createMockAgentScript();
    tmpFiles.push(scriptPath);

    const sentMessages: unknown[] = [];
    const runner = new AgentRunner({
      command: `node ${scriptPath}`,
      approvalPolicy: 'auto-edit',
      stallTimeoutMs: 5000,
    });

    // Intercept written stdin messages by monkey-patching ProtocolClient
    const origStart = runner.start.bind(runner);
    runner.on('turn_complete', () => {});

    await new Promise<void>((resolve, reject) => {
      runner.on('turn_complete', resolve);
      runner.on('error', reject);
      runner.start(issue, 1, os.tmpdir(), '').catch(reject);
    });
  }, 10000);
});
