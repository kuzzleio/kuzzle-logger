import { describe, expect, it } from 'vitest';

import {
  BrowserLogsRequest,
  BrowserLogsTargetLogger,
  createBrowserLogsController,
} from '../src/kuzzle';
import { createMemoryLogger } from './helpers';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJhZG1pbiJ9.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

function setup(options: Parameters<typeof createBrowserLogsController>[1] = {}) {
  const { logger, lines } = createMemoryLogger({
    getMergingObject: () => ({ namespace: 'kuzzle:app', nodeId: 'node-1', requestId: 'req-1' }),
    level: 'trace',
  });
  const controller = createBrowserLogsController(logger, options);

  return { controller, lines, push: controller.actions[options.action ?? 'push'].handler };
}

function request(
  body: unknown,
  {
    headers = {},
    kuid = 'user-1',
  }: { headers?: Record<string, unknown>; kuid?: string | null } = {},
): BrowserLogsRequest {
  return {
    context: { connection: { misc: { headers } } },
    getKuid: () => kuid,
    input: { body },
  };
}

describe('createBrowserLogsController', () => {
  it('returns a plain controller definition with a push action and its HTTP route', () => {
    const { controller } = setup();

    expect(Object.keys(controller.actions)).toEqual(['push']);
    expect(controller.actions.push.http).toEqual([{ path: 'browser-logs/_push', verb: 'post' }]);
    expect(typeof controller.actions.push.handler).toBe('function');
  });

  it('supports custom action and HTTP route names, or no HTTP route', () => {
    expect(
      setup({ action: 'ingest', httpPath: '/logs/_ingest' }).controller.actions.ingest.http,
    ).toEqual([{ path: '/logs/_ingest', verb: 'post' }]);
    expect(setup({ httpPath: null }).controller.actions.push).not.toHaveProperty('http');
  });

  it('forwards entries through a "browser" child logger, enriched server-side', async () => {
    const { lines, push } = setup();
    const result = await push(
      request(
        {
          app: { name: 'my-frontend', version: '1.2.3' },
          entries: [
            {
              context: { assetId: 'abc' },
              level: 'info',
              msg: 'Assets loaded',
              time: 1759312800000,
            },
          ],
          version: 1,
        },
        { headers: { origin: 'https://app.example.com', 'user-agent': 'Mozilla/5.0' } },
      ),
    );

    expect(result).toEqual({ accepted: 1, rejected: [] });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      app: { name: 'my-frontend', version: '1.2.3' },
      clientTime: 1759312800000,
      context: { assetId: 'abc' },
      level: 30,
      msg: 'Assets loaded',
      namespace: 'kuzzle:app:browser',
      nodeId: 'node-1',
      origin: 'https://app.example.com',
      requestId: 'req-1',
      source: 'browser',
      userAgent: 'Mozilla/5.0',
      userId: 'user-1',
    });
    expect(lines[0].fingerprint).toMatch(/^[0-9a-f]{14}$/);
    expect(lines[0].time).not.toBe(1759312800000);
  });

  it('maps every level', async () => {
    const { lines, push } = setup();
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

    await push(request({ entries: levels.map((level) => ({ level })), version: 1 }));

    expect(lines.map(({ level }) => level)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('logs errors under "err", using their message by default', async () => {
    const { lines, push } = setup();

    await push(
      request({
        entries: [
          {
            err: {
              message: 'boom',
              name: 'TypeError',
              stack: 'TypeError: boom\n    at f (a.js:1:1)',
            },
            level: 'error',
          },
        ],
        version: 1,
      }),
    );

    expect(lines[0]).toMatchObject({
      err: { message: 'boom', name: 'TypeError', stack: 'TypeError: boom\n    at f (a.js:1:1)' },
      msg: 'boom',
    });
  });

  it('appends the client namespace to the server-side namespace', async () => {
    const { lines, push } = setup({ namespace: 'front' });

    await push(request({ entries: [{ level: 'info', namespace: 'dashboard:map' }], version: 1 }));

    expect(lines[0].namespace).toBe('kuzzle:app:front:dashboard:map');
  });

  it('bounds the number of client namespaces (label cardinality)', async () => {
    const { lines, push } = setup({ maxNamespaces: 2 });

    await push(
      request({
        entries: ['a', 'b', 'c', 'a'].map((namespace) => ({ level: 'info', namespace })),
        version: 1,
      }),
    );

    expect(lines.map(({ namespace }) => namespace)).toEqual([
      'kuzzle:app:browser:a',
      'kuzzle:app:browser:b',
      'kuzzle:app:browser',
      'kuzzle:app:browser:a',
    ]);
    expect(lines[2].clientNamespace).toBe('c');
    expect(lines[0]).not.toHaveProperty('clientNamespace');
  });

  it('never lets the client override server-side fields', async () => {
    const { lines, push } = setup();

    await push(
      request({
        entries: [
          {
            context: { namespace: 'x', nodeId: 'spoofed', source: 'server', userId: 'admin' },
            level: 'info',
            nodeId: 'spoofed',
            source: 'server',
            userId: 'admin',
          },
        ],
        version: 1,
      }),
    );

    expect(lines[0]).toMatchObject({
      context: { namespace: 'x', nodeId: 'spoofed', source: 'server', userId: 'admin' },
      namespace: 'kuzzle:app:browser',
      nodeId: 'node-1',
      source: 'browser',
      userId: 'user-1',
    });
  });

  it('sanitizes entries before logging them', async () => {
    const { lines, push } = setup({ sanitize: { denylist: ['email'] } });

    await push(
      request({
        entries: [
          {
            context: { email: 'a@b.c', password: 'hunter2' },
            level: 'warn',
            msg: `GET /api?access_token=abc with ${JWT}`,
          },
        ],
        version: 1,
      }),
    );

    expect(lines[0]).toMatchObject({
      context: { email: '[REDACTED]', password: '[REDACTED]' },
      msg: 'GET /api?access_token=[REDACTED] with [REDACTED]',
    });
    expect(JSON.stringify(lines)).not.toContain(JWT);
  });

  it('keeps anonymous users and requests without headers', async () => {
    const { lines, push } = setup();

    await push({
      getKuid: () => null,
      input: { body: { entries: [{ level: 'info' }], version: 1 } },
    });

    expect(lines[0]).toMatchObject({ source: 'browser', userId: null });
    expect(lines[0]).not.toHaveProperty('userAgent');
    expect(lines[0]).not.toHaveProperty('origin');
  });

  it('truncates long headers', async () => {
    const { lines, push } = setup();

    await push(
      request(
        { entries: [{ level: 'info' }], version: 1 },
        { headers: { 'user-agent': 'x'.repeat(2000) } },
      ),
    );

    expect(lines[0].userAgent).toHaveLength(512);
  });

  it('reports rejected entries with their index in the payload', async () => {
    const { lines, push } = setup();
    const result = await push(
      request({
        entries: [{ level: 'info' }, { level: 'nope' }, { level: 'warn' }, 42],
        version: 1,
      }),
    );

    expect(result.accepted).toBe(2);
    expect(result.rejected.map(({ index }) => index)).toEqual([1, 3]);
    expect(lines).toHaveLength(2);
  });

  it('logs a warning when the browser dropped entries', async () => {
    const { lines, push } = setup();

    await push(request({ dropped: 7, entries: [], version: 1 }));

    expect(lines[0]).toMatchObject({
      dropped: 7,
      level: 40,
      msg: 'Browser dropped 7 log entries (buffer overflow)',
      namespace: 'kuzzle:app:browser',
    });
  });

  it('applies batch limits', async () => {
    const { push } = setup({ limits: { levels: ['error'] } });

    expect(await push(request({ entries: [{ level: 'info' }], version: 1 }))).toMatchObject({
      accepted: 0,
      rejected: [{ index: 0 }],
    });
  });

  describe('invalid batches', () => {
    it('throws a 400 error by default, without logging', async () => {
      const { lines, push } = setup();

      await expect(push(request({ entries: [], version: 2 }))).rejects.toMatchObject({
        message: expect.stringMatching(/^Invalid browser logs batch: unsupported payload version/),
        status: 400,
      });
      expect(lines).toHaveLength(0);
    });

    it('uses the badRequest factory (e.g. Kuzzle BadRequestError)', async () => {
      class BadRequestError extends Error {}
      const { push } = setup({ badRequest: (message) => new BadRequestError(message) });

      await expect(push(request(null))).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  it('reports entries the logger failed to forward, without throwing', async () => {
    const failing = (namespace: string): BrowserLogsTargetLogger => {
      const log = (obj: object, msg?: string) => {
        if (msg === 'fail') {
          throw new Error('transport down');
        }
      };

      return {
        child: (name: string) => failing(`${namespace}:${name}`),
        debug: log,
        error: log,
        fatal: log,
        info: log,
        trace: log,
        warn: log,
      };
    };
    const controller = createBrowserLogsController(failing('root'));
    const result = await controller.actions.push.handler(
      request({
        entries: [{ level: 'info', msg: 'ok' }, { level: 'bad' }, { level: 'info', msg: 'fail' }],
        version: 1,
      }),
    );

    expect(result).toEqual({
      accepted: 1,
      rejected: [
        { index: 1, reason: expect.any(String) },
        { index: 2, reason: 'forwarding failed' },
      ],
    });
  });
});
