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

  it('keeps an oversized entry from taking its batch down', async () => {
    const { calls, transport } = recorder();
    // The backend rejects payloads over maxPayloadSize as a whole
    transport.mockImplementation(async (payload, { keepalive }) => {
      calls.push({ keepalive, payload: structuredClone(payload) });

      if (!validateBatch(payload).valid) {
        throw new NonRetryableError('400');
      }
    });
    sender = createBatchingSender(transport);

    sender.send(info('a'));
    sender.send({ context: { response: 'x'.repeat(70000) }, level: 'info', msg: 'b', time: 1 });
    sender.send(info('c'));
    await sender.flush();

    expect(calls.map(({ payload }) => payload.dropped)).toEqual([undefined]);
    expect(calls[0].payload.entries).toEqual([
      info('a'),
      { context: { truncated: true }, level: 'info', msg: 'b', time: 1 },
      info('c'),
    ]);
  });

  it('truncates the message and error of an oversized entry, or drops it', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport, { maxBatchBytes: 20000 });

    sender.send({
      err: {
        cause: { big: 'x'.repeat(20000) },
        message: 'm'.repeat(5000),
        name: 'E',
        stack: 's'.repeat(20000),
      },
      level: 'error',
      msg: 'x'.repeat(5000),
    });
    await vi.advanceTimersByTimeAsync(0);

    const [entry] = calls[0].payload.entries;

    expect(entry.msg).toHaveLength(2048);
    expect(entry.err).toEqual({
      message: expect.stringMatching(/^m+…\[truncated\]$/),
      name: 'E',
      stack: expect.stringMatching(/^s+…\[truncated\]$/),
    });
    expect(entry.err?.stack).toHaveLength(8192);

    sender.close();
    sender = createBatchingSender(transport, { maxBatchBytes: 1000 });
    sender.send({ level: 'error', msg: 'x'.repeat(5000) });
    sender.send(info('next'));
    await sender.flush();

    expect(calls[1].payload).toMatchObject({ dropped: 1, entries: [info('next')] });
  });

  it('splits batches by size (maxBatchBytes)', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport, { maxBatchBytes: 1000 });
    const entry = (msg: string) => info(msg + 'x'.repeat(250));

    for (const msg of ['a', 'b', 'c', 'd', 'e']) {
      sender.send(entry(msg));
    }
    await sender.flush();

    expect(calls.map(({ payload }) => msgs(payload).map((msg) => msg?.[0]))).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
    expect(calls.every(({ payload }) => JSON.stringify(payload).length <= 1000)).toBe(true);
  });

  it('sends as soon as maxBatchBytes are pending', async () => {
    const { calls, transport } = recorder();
    sender = createBatchingSender(transport, { maxBatchBytes: 1000 });

    for (const msg of ['a', 'b', 'c', 'd']) {
      sender.send(info(msg + 'x'.repeat(250)));
    }
    await vi.advanceTimersByTimeAsync(0);

    expect(calls.map(({ payload }) => msgs(payload).map((msg) => msg?.[0]))).toEqual([
      ['a', 'b', 'c'],
      ['d'],
    ]);
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

    // Throttled to flushInterval after a dropped batch
    sender.send({ level: 'error', msg: 'next' });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(5000);

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
    await vi.advanceTimersByTimeAsync(5000);

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

  it('keeps one transport call in flight when the transport logs synchronously', async () => {
    let running = 0;
    let maxRunning = 0;
    let calls = 0;
    const transport = vi.fn(async () => {
      calls++;
      running++;
      maxRunning = Math.max(maxRunning, running);

      // e.g. an HTTP sender headers() function that logs
      if (calls <= 3) {
        logger.error(`transport ${calls}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      running--;
    });
    sender = createBatchingSender(transport);
    const logger = new KuzzleLogger({ console: false, sender });

    expect(() => logger.error('boom')).not.toThrow();
    await vi.advanceTimersByTimeAsync(10000);

    expect(maxRunning).toBe(1);
    expect(transport.mock.calls.map(([payload]) => msgs(payload))).toEqual([
      ['boom'],
      ['transport 1'],
      ['transport 2'],
      ['transport 3'],
    ]);
  });

  it('throttles immediate flushes while batches are dropped', async () => {
    const { calls, transport } = recorder(() => {
      // The application logs each failed request, e.g. a 403 from the SDK
      setTimeout(() => logger.error('request failed'), 0);

      return new NonRetryableError('403');
    });
    sender = createBatchingSender(transport, { flushInterval: 5000 });
    const logger = new KuzzleLogger({ console: false, sender });

    logger.error('boom');
    await vi.advanceTimersByTimeAsync(11000);

    // One request per flushInterval instead of a loop at round-trip speed
    expect(calls).toHaveLength(3);
  });

  it('flushes immediately again once a batch is sent', async () => {
    const { calls, transport } = recorder((call) =>
      call === 1 ? new NonRetryableError('403') : null,
    );
    sender = createBatchingSender(transport, { flushInterval: 5000 });

    sender.send({ level: 'error', msg: 'rejected' });
    await vi.advanceTimersByTimeAsync(0);
    sender.send({ level: 'error', msg: 'throttled' });
    await vi.advanceTimersByTimeAsync(5000);
    sender.send({ level: 'error', msg: 'immediate' });
    await vi.advanceTimersByTimeAsync(0);

    expect(calls.map(({ payload }) => msgs(payload))).toEqual([
      ['rejected'],
      ['throttled'],
      ['immediate'],
    ]);
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

  it('sends with keepalive on pagehide without waiting for the request in flight', async () => {
    const hanging: { reject: (error: Error) => void }[] = [];
    const { calls, transport } = recorder();
    transport.mockImplementationOnce(async (payload, { keepalive }) => {
      calls.push({ keepalive, payload: structuredClone(payload) });

      // The page unloads: this request never completes
      return new Promise<void>((_resolve, reject) => {
        hanging.push({ reject });
      });
    });
    sender = createBatchingSender(transport);

    sender.send({ level: 'error', msg: 'in flight' });
    sender.send(info('buffered'));
    window.dispatchEvent(new Event('pagehide'));

    // Synchronously: the page may be gone at the next tick
    expect(calls.map(({ keepalive, payload }) => [keepalive, msgs(payload)])).toEqual([
      [false, ['in flight']],
      [true, ['in flight', 'buffered']],
    ]);

    // The keepalive request took over the batch: it is not retried
    hanging[0].reject(new Error('offline'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toHaveLength(2);
  });

  it('sends the entries buffered during a retry backoff with keepalive on pagehide', async () => {
    const { calls, transport } = recorder((call) => (call === 1 ? new Error('offline') : null));
    sender = createBatchingSender(transport, { maxBatchSize: 2, retryDelay: 10000 });

    sender.send({ level: 'error', msg: 'a' });
    await vi.advanceTimersByTimeAsync(0);
    for (const msg of ['b', 'c', 'd']) {
      sender.send(info(msg));
    }
    window.dispatchEvent(new Event('pagehide'));

    expect(calls.map(({ keepalive, payload }) => [keepalive, msgs(payload)])).toEqual([
      [false, ['a']],
      [true, ['a', 'b']],
      [true, ['c', 'd']],
    ]);
  });

  it('keeps keepalive requests within the browser budget', async () => {
    const { calls, transport } = recorder();
    // Larger than the keepalive budget
    sender = createBatchingSender(transport, { maxBatchBytes: 100000 });
    const big = (msg: string) => info(msg + 'x'.repeat(25000));

    sender.send(big('a'));
    sender.send(big('b'));
    sender.send(big('c'));
    window.dispatchEvent(new Event('pagehide'));

    // The 3 entries do not fit in one keepalive request: the batch is split
    expect(calls.map(({ payload }) => payload.entries.map(({ msg }) => msg?.[0]))).toEqual([
      ['a', 'b'],
    ]);

    // The page is visible again: the rest is sent normally
    await sender.flush();

    expect(
      calls.map(({ keepalive, payload }) => [
        keepalive,
        payload.entries.map(({ msg }) => msg?.[0]),
      ]),
    ).toEqual([
      [true, ['a', 'b']],
      [false, ['c']],
    ]);
  });

  it('requeues the entries of a failed keepalive request', async () => {
    const { calls, transport } = recorder((call) => (call === 1 ? new Error('offline') : null));
    sender = createBatchingSender(transport);

    sender.send(info('a'));
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(5000);

    expect(calls.map(({ keepalive, payload }) => [keepalive, msgs(payload)])).toEqual([
      [true, ['a']],
      [false, ['a']],
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
