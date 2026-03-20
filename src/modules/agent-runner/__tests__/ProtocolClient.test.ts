import { EventEmitter } from 'events';
import { ProtocolClient } from '../ProtocolClient.js';

/**
 * Creates a mock child process with controllable stdin/stdout streams.
 */
function makeMockProcess() {
  const stdoutEmitter = new EventEmitter() as NodeJS.ReadableStream & EventEmitter;
  const stdinLines: string[] = [];
  const stdin = {
    write: jest.fn((line: string) => stdinLines.push(line)),
    end: jest.fn(),
  };
  const processEmitter = new EventEmitter();

  const mockProcess = Object.assign(processEmitter, {
    stdout: stdoutEmitter,
    stderr: Object.assign(new EventEmitter(), { on: jest.fn() }),
    stdin,
    kill: jest.fn(),
    pid: 12345,
  });

  return { mockProcess, stdoutEmitter, stdinLines };
}

describe('ProtocolClient', () => {
  it('sends initialize message on handshake', async () => {
    const { mockProcess, stdoutEmitter, stdinLines } = makeMockProcess();
    const client = new ProtocolClient(mockProcess as any);

    const handshakePromise = client.handshake('thread-1', 'Hello world');

    // Simulate server responding with initialized
    process.nextTick(() => {
      stdoutEmitter.emit('data', Buffer.from(JSON.stringify({ type: 'initialized' }) + '\n'));
    });

    await handshakePromise;

    const sent = stdinLines.map(l => JSON.parse(l));
    expect(sent[0]).toMatchObject({ type: 'initialize' });
  });

  it('sends thread/start after initialized', async () => {
    const { mockProcess, stdoutEmitter, stdinLines } = makeMockProcess();
    const client = new ProtocolClient(mockProcess as any);

    const handshakePromise = client.handshake('thread-abc', 'Hello');

    process.nextTick(() => {
      stdoutEmitter.emit('data', Buffer.from(JSON.stringify({ type: 'initialized' }) + '\n'));
    });

    await handshakePromise;

    const sent = stdinLines.map(l => JSON.parse(l));
    expect(sent[1]).toMatchObject({ type: 'thread/start', thread_id: 'thread-abc' });
  });

  it('sends turn/start with rendered prompt', async () => {
    const { mockProcess, stdoutEmitter, stdinLines } = makeMockProcess();
    const client = new ProtocolClient(mockProcess as any);

    const handshakePromise = client.handshake('thread-xyz', 'My rendered prompt');

    process.nextTick(() => {
      stdoutEmitter.emit('data', Buffer.from(JSON.stringify({ type: 'initialized' }) + '\n'));
    });

    await handshakePromise;

    const sent = stdinLines.map(l => JSON.parse(l));
    expect(sent[2]).toMatchObject({ type: 'turn/start', content: 'My rendered prompt' });
  });

  it('emits turn_event for each streamed turn event', (done) => {
    const { mockProcess, stdoutEmitter, stdinLines } = makeMockProcess();
    const client = new ProtocolClient(mockProcess as any);

    const events: unknown[] = [];
    client.on('turn_event', (evt) => events.push(evt));
    client.on('turn_complete', () => {
      expect(events).toHaveLength(2);
      done();
    });

    const handshakePromise = client.handshake('t', 'prompt');

    process.nextTick(() => {
      stdoutEmitter.emit('data', Buffer.from([
        JSON.stringify({ type: 'initialized' }),
        JSON.stringify({ type: 'message', content: 'hello' }),
        JSON.stringify({ type: 'message', content: 'world' }),
        JSON.stringify({ type: 'turn/complete' }),
        '',
      ].join('\n')));
    });

    void handshakePromise;
  });

  it('emits turn_complete on turn/complete message', (done) => {
    const { mockProcess, stdoutEmitter } = makeMockProcess();
    const client = new ProtocolClient(mockProcess as any);

    client.on('turn_complete', () => done());

    const handshakePromise = client.handshake('t', 'prompt');

    process.nextTick(() => {
      stdoutEmitter.emit('data', Buffer.from([
        JSON.stringify({ type: 'initialized' }),
        JSON.stringify({ type: 'turn/complete' }),
        '',
      ].join('\n')));
    });

    void handshakePromise;
  });

  it('skips non-JSON lines from stdout', async () => {
    const { mockProcess, stdoutEmitter } = makeMockProcess();
    const client = new ProtocolClient(mockProcess as any);

    const handshakePromise = client.handshake('t', 'prompt');

    process.nextTick(() => {
      stdoutEmitter.emit('data', Buffer.from([
        'not json at all',
        JSON.stringify({ type: 'initialized' }),
        '',
      ].join('\n')));
    });

    // Should resolve without throwing
    await expect(handshakePromise).resolves.not.toThrow();
  });
});
