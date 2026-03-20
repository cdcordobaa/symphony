import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import type { JsonLineMessage } from './types.js';

/**
 * ProtocolClient wraps a child process and manages the JSON-line stdio protocol.
 *
 * Protocol sequence:
 *   → {"type":"initialize", ...}
 *   ← {"type":"initialized", ...}
 *   → {"type":"thread/start", "thread_id": "<id>"}
 *   → {"type":"turn/start", "content": "<prompt>"}
 *   ← stream of turn events
 *   ← {"type":"turn/complete"}
 *
 * Events:
 *   - 'turn_event'    — emitted for each turn event message (not turn/complete)
 *   - 'turn_complete' — emitted when {"type":"turn/complete"} is received
 *   - 'error'         — emitted on process close with non-zero exit or error
 */
export class ProtocolClient extends EventEmitter {
  private readonly child: ChildProcess;
  private lineBuffer: string = '';

  constructor(child: ChildProcess) {
    super();
    this.child = child;
    this.attachStdoutParser();
  }

  /**
   * Runs the full handshake:
   *   send initialize → await initialized → send thread/start → send turn/start
   */
  async handshake(threadId: string, renderedPrompt: string): Promise<void> {
    await this.sendAndAwait(
      { type: 'initialize' },
      (msg) => msg.type === 'initialized',
    );
    this.send({ type: 'thread/start', thread_id: threadId });
    this.send({ type: 'turn/start', content: renderedPrompt });
  }

  /**
   * Sends a message and resolves once a response matching `predicate` arrives.
   * Rejects if the process exits before the predicate is met.
   */
  private sendAndAwait(
    message: JsonLineMessage,
    predicate: (msg: JsonLineMessage) => boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const onMessage = (msg: JsonLineMessage) => {
        if (predicate(msg)) {
          this.off('_message', onMessage);
          this.off('error', onError);
          resolve();
        }
      };
      const onError = (err: Error) => {
        this.off('_message', onMessage);
        reject(err);
      };
      this.on('_message', onMessage);
      this.once('error', onError);
      this.send(message);
    });
  }

  private send(message: JsonLineMessage): void {
    const line = JSON.stringify(message) + '\n';
    this.child.stdin?.write(line);
  }

  private attachStdoutParser(): void {
    this.child.stdout?.on('data', (chunk: Buffer) => {
      this.lineBuffer += chunk.toString();
      const lines = this.lineBuffer.split('\n');
      // Last element may be incomplete; keep it in the buffer
      this.lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg: JsonLineMessage;
        try {
          msg = JSON.parse(trimmed) as JsonLineMessage;
        } catch {
          // Non-JSON output — skip
          continue;
        }
        this.emit('_message', msg);

        if (msg.type === 'turn/complete') {
          this.emit('turn_complete', msg);
        } else if (msg.type !== 'initialized') {
          // Filter out internal protocol messages; only emit actual turn events
          this.emit('turn_event', msg);
        }
      }
    });

    this.child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        this.emit('error', new Error(`Agent process exited with code ${code}`));
      }
    });

    this.child.on('error', (err) => {
      this.emit('error', err);
    });
  }
}
