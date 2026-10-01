// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BatchingSender,
  KuzzleLogger,
  NonRetryableError,
  createBatchingSender,
  createHttpSender,
  createKuzzleSender,
} from '../src/browser';
import { BrowserLogEntry, BrowserLogsPayload, validateBatch } from '../src/protocol';

const info = (msg: string): BrowserLogEntry => ({ level: 'info', msg });

function recorder(fail: (call: number) => Error | null = () => null) {
  const calls: { keepalive: boolean; payload: BrowserLogsPayload }[] = [];
  const transport = vi.fn(async (payload: BrowserLogsPayload, { keepalive }) => {
    calls.push({ keepalive, payload: structuredClone(payload) });

    const error = fail(calls.length);

    if (error) {
      throw error;
    }
  });

  return { calls, transport };
}

const msgs = (payload: BrowserLogsPayload) => payload.entries.map(({ msg }) => msg);

describe('createBatchingSender', () => {
  let sender: BatchingSender | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    sender?.close();
    sender = undefined;
    vi.useRealTimers();
  });

  it('sends a batch after flushInterval', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport, { app: { name: 'front' }, flushInterval: 1000 });

    sender.send(info('a'));
    sender.send(info('b'));
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([
      {
        keepalive: false,
        payload: { app: { name: 'front' }, entries: [info('a'), info('b')], version: 1 },
      },
    ]);
  });

  it('sends as soon as maxBatchSize entries are pending', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport, { maxBatchSize: 2 });

    sender.send(info('a'));
    sender.send(info('b'));
    await vi.advanceTimersByTimeAsync(0);

    expect(calls.map(({ payload }) => msgs(payload))).toEqual([['a', 'b']]);
  });

  it.each(['error', 'fatal'] as const)('sends immediately on %s', async (level) => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport);

    sender.send(info('context'));
    sender.send({ level, msg: 'boom' });
    await vi.advanceTimersByTimeAsync(0);

    expect(calls.map(({ payload }) => msgs(payload))).toEqual([['context', 'boom']]);
  });

  it('flush() sends everything, in batches of maxBatchSize', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport, { maxBatchSize: 2, maxBufferSize: 10 });

    for (const msg of ['a', 'b', 'c', 'd', 'e']) {
      sender.send(info(msg));
    }

    await sender.flush();

    expect(calls.flatMap(({ payload }) => msgs(payload))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(calls.every(({ payload }) => payload.entries.length <= 2)).toBe(true);
  });

  it('drops the oldest entries when the buffer is full, and reports them', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport, { maxBatchSize: 3, maxBufferSize: 3 });

    // The first full batch is in flight while the next entries are buffered
    for (const msg of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      sender.send(info(msg));
    }

    await sender.flush();

    const sent = calls.flatMap(({ payload }) => msgs(payload));
    const reported = calls.reduce((sum, { payload }) => sum + (payload.dropped ?? 0), 0);

    expect(sent.length + reported).toBe(8);
    expect(reported).toBeGreaterThan(0);
    expect(sent.at(-1)).toBe('h');
  });

  it('retries failed batches with an exponential backoff, keeping the order', async () => {
    const { calls, transport } = recorder((call) => (call <= 2 ? new Error('offline') : null));
    sender = createBatchingSender(transport, { retryDelay: 100 });

    sender.send({ level: 'error', msg: 'a' });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);

    sender.send(info('b'));
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(199);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);

    expect(calls).toHaveLength(3);
    expect(msgs(calls[2].payload)).toEqual(['a', 'b']);
    expect(calls[2].payload).not.toHaveProperty('dropped');
  });

  it('drops a batch after maxRetries, and reports it as dropped', async () => {
    const { calls, transport } = recorder((call) => (call <= 2 ? new Error('offline') : null));
    sender = createBatchingSender(transport, { maxRetries: 1, retryDelay: 10 });

    sender.send({ level: 'error', msg: 'lost' });
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toHaveLength(2);

    sender.send({ level: 'error', msg: 'next' });
    await vi.advanceTimersByTimeAsync(0);

    expect(calls[2].payload).toMatchObject({ dropped: 1, entries: [{ msg: 'next' }] });
  });

  it('does not retry NonRetryableError', async () => {
    const { calls, transport } = recorder((call) =>
      call === 1 ? new NonRetryableError('400') : null,
    );
    sender = createBatchingSender(transport, { retryDelay: 10 });

    sender.send({ level: 'error', msg: 'invalid' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);

    sender.send({ level: 'error', msg: 'next' });
    await vi.advanceTimersByTimeAsync(0);

    expect(calls[1].payload).toMatchObject({ dropped: 1, entries: [{ msg: 'next' }] });
  });

  it('never throws, even when the transport throws synchronously', async () => {
    const transport = vi.fn(() => {
      throw new Error('sync');
    }) as unknown as () => Promise<void>;
    sender = createBatchingSender(transport, { maxRetries: 0 });

    expect(() => sender!.send({ level: 'fatal', msg: 'x' })).not.toThrow();
    await expect(sender.flush()).resolves.toBeUndefined();
  });

  it('flushes with keepalive when the page is hidden', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport);

    sender.send(info('a'));
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);

    sender.send(info('b'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

    expect(calls).toEqual([
      { keepalive: true, payload: expect.objectContaining({ entries: [info('a')] }) },
      { keepalive: true, payload: expect.objectContaining({ entries: [info('b')] }) },
    ]);
  });

  it('close() stops timers and listeners', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport);

    sender.send(info('a'));
    sender.close();
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(10000);
    sender.send(info('b'));

    expect(calls).toHaveLength(0);
  });

  it('works as the sender of the browser logger, with valid v1 payloads', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport);
    const logger = new KuzzleLogger({ console: false, sender });

    logger.child('map').info({ assetId: 'abc' }, 'loaded');
    logger.error(new TypeError('boom'));
    await logger.flush();

    expect(calls).toHaveLength(1);
    expect(validateBatch(calls[0].payload)).toMatchObject({ rejected: [], valid: true });
    expect(calls[0].payload.entries).toMatchObject([
      { level: 'info', msg: 'loaded', namespace: 'map' },
      { err: { message: 'boom', name: 'TypeError' }, level: 'error', msg: 'boom' },
    ]);
  });
});

describe('createHttpSender', () => {
  let sender: BatchingSender | undefined;

  afterEach(() => {
    sender?.close();
    vi.unstubAllGlobals();
  });

  function stubFetch(status = 200) {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status }),
    );
    vi.stubGlobal('fetch', fetch);

    return fetch;
  }

  it('POSTs the payload to the Kuzzle HTTP route by default', async () => {
    const fetch = stubFetch();
    sender = createHttpSender({ headers: () => ({ 'X-App': 'front' }) });

    sender.send(info('a'));
    await sender.flush();

    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, init] = fetch.mock.calls[0];

    expect(url).toBe('/_/browser-logs/_push');
    expect(init).toMatchObject({
      headers: { 'Content-Type': 'application/json', 'X-App': 'front' },
      keepalive: false,
      method: 'POST',
    });
    expect(JSON.parse(init.body as string)).toEqual({ entries: [info('a')], version: 1 });
  });

  it('supports a custom URL', async () => {
    const fetch = stubFetch();
    sender = createHttpSender({ url: 'https://logs.example.com/ingest' });

    sender.send(info('a'));
    await sender.flush();

    expect(fetch.mock.calls[0][0]).toBe('https://logs.example.com/ingest');
  });

  it.each([
    [400, 1],
    [403, 1],
    [429, 2],
    [503, 2],
  ])('HTTP %i: %i call(s) with one retry allowed', async (status, expected) => {
    vi.useFakeTimers();
    const fetch = stubFetch(status);
    sender = createHttpSender({ maxRetries: 1, retryDelay: 10 });

    sender.send({ level: 'error', msg: 'a' });
    await vi.advanceTimersByTimeAsync(100);
    vi.useRealTimers();

    expect(fetch).toHaveBeenCalledTimes(expected);
  });
});

describe('createKuzzleSender', () => {
  let sender: BatchingSender | undefined;

  afterEach(() => {
    sender?.close();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses sdk.query with the browser-logs controller', async () => {
    const sdk = { query: vi.fn(async () => ({})) };
    sender = createKuzzleSender(sdk, { app: { version: '1.0.0' } });

    sender.send(info('a'));
    await sender.flush();

    expect(sdk.query).toHaveBeenCalledWith({
      action: 'push',
      body: { app: { version: '1.0.0' }, entries: [info('a')], version: 1 },
      controller: 'browser-logs',
    });
  });

  it('supports custom controller and action names', async () => {
    const sdk = { query: vi.fn(async () => ({})) };
    sender = createKuzzleSender(sdk, { action: 'ingest', controller: 'logs' });

    sender.send(info('a'));
    await sender.flush();

    expect(sdk.query).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ingest', controller: 'logs' }),
    );
  });

  it('does not retry 4xx Kuzzle errors, but retries network errors', async () => {
    vi.useFakeTimers();
    const rejected = {
      query: vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { status: 403 }))),
    };
    const offline = { query: vi.fn(async () => Promise.reject(new Error('offline'))) };
    const a = createKuzzleSender(rejected, { maxRetries: 1, retryDelay: 10 });
    const b = createKuzzleSender(offline, { maxRetries: 1, retryDelay: 10 });

    a.send({ level: 'error', msg: 'a' });
    b.send({ level: 'error', msg: 'b' });
    await vi.advanceTimersByTimeAsync(100);
    a.close();
    b.close();

    expect(rejected.query).toHaveBeenCalledTimes(1);
    expect(offline.query).toHaveBeenCalledTimes(2);
  });

  it('uses fetch keepalive with the SDK token when the page is hidden and keepaliveUrl is set', async () => {
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const sdk = { jwt: 'token-1', query: vi.fn(async () => ({})) };
    sender = createKuzzleSender(sdk, {
      keepaliveUrl: 'https://api.example.com/_/browser-logs/_push',
    });

    sender.send(info('a'));
    window.dispatchEvent(new Event('pagehide'));
    await sender.flush();

    expect(sdk.query).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/_/browser-logs/_push',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1', 'Content-Type': 'application/json' },
        keepalive: true,
      }),
    );
  });
});
