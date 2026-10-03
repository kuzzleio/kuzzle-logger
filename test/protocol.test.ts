import { describe, expect, it } from 'vitest';

import {
  BrowserLogEntry,
  DEFAULT_BATCH_LIMITS,
  fingerprint,
  normalizeMessage,
  redactString,
  sanitize,
  topFrame,
  validateBatch,
} from '../src/protocol';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJhZG1pbiJ9.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

function batch(entries: unknown[], extra: Record<string, unknown> = {}) {
  return { entries, version: 1, ...extra };
}

function validEntries(payload: unknown) {
  const result = validateBatch(payload);

  if (!result.valid) {
    throw new Error(`unexpected invalid batch: ${result.error}`);
  }

  return result;
}

describe('validateBatch', () => {
  describe('batch-level errors', () => {
    it.each([
      ['null', null],
      ['a string', 'hello'],
      ['an array', []],
      ['a class instance', new Date()],
    ])('rejects %s as payload', (_, payload) => {
      expect(validateBatch(payload)).toEqual({ error: 'payload must be an object', valid: false });
    });

    it.each([undefined, 0, 2, '1'])('rejects version %s', (version) => {
      expect(validateBatch({ entries: [], version })).toMatchObject({ valid: false });
    });

    it('rejects missing or non-array entries', () => {
      expect(validateBatch({ version: 1 })).toMatchObject({ valid: false });
      expect(validateBatch({ entries: {}, version: 1 })).toMatchObject({ valid: false });
    });

    it('rejects too many entries', () => {
      const entries = Array.from({ length: 3 }, () => ({ level: 'info' }));

      expect(validateBatch(batch(entries), { maxEntries: 2 })).toEqual({
        error: 'too many entries (max 2)',
        valid: false,
      });
    });

    it('rejects payloads bigger than maxPayloadSize', () => {
      const payload = batch([{ level: 'info', msg: 'x'.repeat(200) }]);

      expect(validateBatch(payload, { maxPayloadSize: 100 })).toMatchObject({
        error: 'payload too large (max 100)',
        valid: false,
      });
    });

    it('rejects non-serializable payloads without throwing', () => {
      const circular: Record<string, unknown> = { level: 'info' };
      circular.self = circular;

      expect(validateBatch(batch([circular]))).toEqual({
        error: 'payload is not serializable',
        valid: false,
      });
    });

    it('accepts an empty batch', () => {
      expect(validateBatch(batch([]))).toEqual({ entries: [], rejected: [], valid: true });
    });
  });

  describe('entries', () => {
    it('accepts a full v1 entry', () => {
      const entry = {
        context: { assetId: 'abc', nested: { list: [1, 'two', null, true] } },
        err: { message: 'boom', name: 'TypeError', stack: 'TypeError: boom\n    at f (a.js:1:1)' },
        level: 'error',
        msg: 'Failed to load assets',
        namespace: 'dashboard:map',
        time: 1759312800000,
      };

      expect(validEntries(batch([entry]))).toEqual({
        entries: [entry],
        rejected: [],
        valid: true,
      });
    });

    it('accepts every level by default', () => {
      const entries = DEFAULT_BATCH_LIMITS.levels.map((level) => ({ level }));

      expect(validEntries(batch(entries)).entries).toHaveLength(6);
    });

    it('rejects invalid entries individually, with their index', () => {
      const result = validEntries(
        batch([
          { level: 'info', msg: 'ok' },
          'not an object',
          { level: 'verbose' },
          { level: 'info', msg: 42 },
          { level: 'info', time: 'yesterday' },
          { level: 'info', namespace: 42 },
          { context: 'nope', level: 'info' },
          { context: [1, 2], level: 'info' },
          { err: 'boom', level: 'error' },
          { err: { message: 'no name' }, level: 'error' },
          { err: { message: 'm', name: 'E', stack: 42 }, level: 'error' },
          { level: 'warn', msg: 'ok too' },
        ]),
      );

      expect(result.entries).toEqual([
        { level: 'info', msg: 'ok' },
        { level: 'warn', msg: 'ok too' },
      ]);
      expect(result.rejected.map(({ index }) => index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(result.rejected.every(({ reason }) => typeof reason === 'string')).toBe(true);
    });

    it('restricts levels', () => {
      const result = validEntries(batch([{ level: 'debug' }, { level: 'error' }]));
      const restricted = validateBatch(batch([{ level: 'debug' }, { level: 'error' }]), {
        levels: ['warn', 'error', 'fatal'],
      });

      expect(result.entries).toHaveLength(2);
      expect(restricted).toMatchObject({ entries: [{ level: 'error' }], rejected: [{ index: 0 }] });
    });

    it('removes unknown entry keys', () => {
      const result = validEntries(
        batch([{ level: 'info', namespace: 'ok', nodeId: 'spoofed', paas_project: 'other' }]),
      );

      expect(result.entries).toEqual([{ level: 'info', namespace: 'ok' }]);
    });

    it('truncates long messages and stacks', () => {
      const result = validateBatch(
        batch([
          {
            err: { message: 'm'.repeat(100), name: 'Error', stack: 's'.repeat(100) },
            level: 'error',
            msg: 'x'.repeat(100),
          },
        ]),
        { maxMessageLength: 50, maxStackLength: 60 },
      );

      expect(result).toMatchObject({ rejected: [], valid: true });

      const [entry] = (result as { entries: BrowserLogEntry[] }).entries;

      expect(entry.msg).toHaveLength(50);
      expect(entry.msg).toMatch(/…\[truncated\]$/);
      expect(entry.err?.message).toHaveLength(50);
      expect(entry.err?.stack).toHaveLength(60);
    });

    it('normalizes namespaces instead of rejecting them', () => {
      const result = validEntries(
        batch([
          { level: 'info', namespace: 'MapView.vue' },
          { level: 'info', namespace: 'dashboard:Map View' },
          { level: 'info', namespace: 'x'.repeat(65) },
          { level: 'info', namespace: '' },
        ]),
      );

      expect(result.rejected).toEqual([]);
      expect(result.entries).toEqual([
        { level: 'info', namespace: 'MapView_vue' },
        { level: 'info', namespace: 'dashboard:Map_View' },
        { level: 'info', namespace: 'x'.repeat(64) },
        { level: 'info' },
      ]);
    });

    it('truncates contexts deeper than maxContextDepth instead of rejecting them', () => {
      const deep = { a: { b: { c: { d: 1 } } }, list: [[[[1]]]] };

      expect(
        validateBatch(batch([{ context: deep, level: 'info' }]), { maxContextDepth: 3 }),
      ).toMatchObject({
        entries: [{ context: { a: { b: { c: '[Truncated]' } }, list: [['[Truncated]']] } }],
        rejected: [],
      });
      expect(
        validateBatch(batch([{ context: deep, level: 'info' }]), { maxContextDepth: 5 }),
      ).toMatchObject({ entries: [{ context: deep }], rejected: [] });
    });

    it('truncates long error cause chains instead of rejecting the entry', () => {
      let err: Record<string, unknown> = { message: 'root', name: 'Error' };

      for (let i = 1; i <= 7; i++) {
        err = { cause: err, message: `level ${i}`, name: 'Error' };
      }

      const result = validEntries(batch([{ err, level: 'error' }]));
      const causes: unknown[] = [];

      for (let cause = result.entries[0].err?.cause; cause; cause = (cause as any).cause) {
        causes.push(typeof cause === 'string' ? cause : (cause as any).message);
      }

      expect(result.rejected).toEqual([]);
      expect(result.entries[0].err?.message).toBe('level 7');
      expect(causes).toEqual(['level 6', 'level 5', 'level 4', 'level 3', '[Truncated]']);
    });

    it('rejects non-JSON context values', () => {
      for (const value of [Number.NaN, Infinity, () => 1, new Date(), new Map(), Symbol('s')]) {
        const result = validEntries(batch([{ context: { value }, level: 'info' }]));

        expect(result.rejected).toHaveLength(1);
      }
    });

    it('accepts null-prototype objects', () => {
      const context = Object.assign(Object.create(null), { a: 1 });

      expect(validEntries(batch([{ context, level: 'info' }])).entries).toEqual([
        { context: { a: 1 }, level: 'info' },
      ]);
    });

    it('does not pollute prototypes', () => {
      const payload = JSON.parse(
        '{"version":1,"entries":[{"level":"info","context":{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"ok":1}}]}',
      );
      const result = validEntries(payload);

      expect(result.entries[0].context).toEqual({ ok: 1 });
      expect(Object.getPrototypeOf(result.entries[0].context)).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('returns copies, not references to the input', () => {
      const context = { a: { b: 1 } };
      const result = validEntries(batch([{ context, level: 'info' }]));

      (result.entries[0].context as typeof context).a.b = 2;

      expect(context.a.b).toBe(1);
    });
  });

  describe('optional batch fields', () => {
    it('keeps app name/version and the dropped counter', () => {
      const result = validEntries(
        batch([], { app: { extra: 'x', name: 'front', version: '1.2.3' }, dropped: 3 }),
      );

      expect(result).toMatchObject({ app: { name: 'front', version: '1.2.3' }, dropped: 3 });
      expect(result.app).not.toHaveProperty('extra');
    });

    it.each([0, -1, 1.5, '3', Number.MAX_VALUE])('ignores invalid dropped %s', (dropped) => {
      expect(validEntries(batch([], { dropped }))).not.toHaveProperty('dropped');
    });

    it('ignores invalid app values', () => {
      expect(validEntries(batch([], { app: 'front' }))).not.toHaveProperty('app');
      expect(validEntries(batch([], { app: { name: 42 } }))).not.toHaveProperty('app');
    });
  });
});

describe('sanitize', () => {
  it('redacts denylisted keys at any depth, whatever their case and separators', () => {
    const entry: BrowserLogEntry = {
      context: {
        Authorization: 'Basic abc',
        accessToken: 'abc',
        nested: [{ password: 'p', user: 'alice', 'x-api-key': 'k' }],
        refresh_token: { value: 'abc' },
        sessionId: 's',
        'set-cookie': 'a=b',
      },
      level: 'info',
    };

    expect(sanitize(entry).context).toEqual({
      Authorization: '[REDACTED]',
      accessToken: '[REDACTED]',
      nested: [{ password: '[REDACTED]', user: 'alice', 'x-api-key': '[REDACTED]' }],
      refresh_token: '[REDACTED]',
      sessionId: '[REDACTED]',
      'set-cookie': '[REDACTED]',
    });
  });

  it('supports an extra denylist and a custom replacement', () => {
    const entry: BrowserLogEntry = { context: { Email: 'a@b.c', name: 'x' }, level: 'info' };

    expect(sanitize(entry, { denylist: ['E-mail'], replacement: '***' }).context).toEqual({
      Email: '***',
      name: 'x',
    });
  });

  it('only redacts by key in context and error custom properties', () => {
    const entry: BrowserLogEntry = {
      context: { age: 42, name: 'Alice', nested: { lastName: 'Doe' } },
      err: {
        cause: { message: 'inner', name: 'Error', userName: 'bob' },
        errors: [{ ageGroup: 'adult', message: 'one', name: 'RangeError' }],
        fieldName: 'email',
        message: 'Wrong age for Alice',
        name: 'ValidationError',
        stack: 'ValidationError: Wrong age for Alice\n    at f (app.js:1:1)',
      },
      level: 'error',
      msg: 'name and age rejected',
      namespace: 'form:name',
      time: 1759312800000,
    };
    const result = sanitize(entry, { denylist: ['name', 'age', 'time', 'level'] });

    expect(result).toEqual({
      context: { age: '[REDACTED]', name: '[REDACTED]', nested: { lastName: '[REDACTED]' } },
      err: {
        cause: { message: 'inner', name: 'Error', userName: '[REDACTED]' },
        errors: [{ ageGroup: '[REDACTED]', message: 'one', name: 'RangeError' }],
        fieldName: '[REDACTED]',
        message: 'Wrong age for Alice',
        name: 'ValidationError',
        stack: 'ValidationError: Wrong age for Alice\n    at f (app.js:1:1)',
      },
      level: 'error',
      msg: 'name and age rejected',
      namespace: 'form:name',
      time: 1759312800000,
    });
  });

  it('redacts tokens in msg, context strings and errors', () => {
    const entry: BrowserLogEntry = {
      context: { url: `https://api.example.com/x?jwt=${JWT}&page=2` },
      err: {
        message: `Unauthorized: ${JWT}`,
        name: 'Error',
        stack: `Error\n    at f (https://app.example.com/a.js?access_token=secret123:1:1)`,
      },
      level: 'error',
      msg: `GET /api?token=abc123&page=2 with Bearer ${JWT}`,
    };
    const result = sanitize(entry);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(JWT);
    expect(serialized).not.toContain('abc123');
    expect(serialized).not.toContain('secret123');
    expect(result.msg).toBe('GET /api?token=[REDACTED]&page=2 with Bearer [REDACTED]');
    expect(result.context?.url).toBe('https://api.example.com/x?jwt=[REDACTED]&page=2');
  });

  it('does not mutate the entry', () => {
    const entry: BrowserLogEntry = { context: { password: 'p' }, level: 'info', msg: `x ${JWT}` };
    const copy = structuredClone(entry);

    sanitize(entry);

    expect(entry).toEqual(copy);
  });

  it('keeps harmless content untouched', () => {
    const entry: BrowserLogEntry = {
      context: { count: 3, flag: false, list: [1, null] },
      level: 'info',
      msg: 'Loaded 3 assets in 12ms',
      namespace: 'dashboard',
      time: 1,
    };

    expect(sanitize(entry)).toEqual(entry);
  });

  it('skips prototype-polluting keys', () => {
    const context = JSON.parse('{"__proto__":{"polluted":true},"ok":1}');
    const result = sanitize({ context, level: 'info' });

    expect(result.context).toEqual({ ok: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('redactString', () => {
  it.each([
    ['access_token=abc', 'access_token=[REDACTED]'],
    ['/cb#id_token=abc&state=1', '/cb#id_token=[REDACTED]&state=1'],
    ['?apiKey=abc', '?apiKey=[REDACTED]'],
    ['password=hunter2 next', 'password=[REDACTED] next'],
    ['authorization: Bearer abc.def', 'authorization: Bearer [REDACTED]'],
    ['no secret here', 'no secret here'],
  ])('%s', (input, expected) => {
    expect(redactString(input)).toBe(expected);
  });
});

describe('fingerprint', () => {
  const stack = (file: string, line = 10) =>
    `TypeError: Cannot read properties of undefined (reading 'id')\n    at loadAsset (${file}:${line}:5)\n    at main (https://app.example.com/main.js:1:1)`;

  it('is stable for the same error', () => {
    const entry: BrowserLogEntry = {
      err: { message: 'boom', name: 'TypeError', stack: stack('https://app/a.js') },
      level: 'error',
    };

    expect(fingerprint(entry)).toBe(fingerprint(structuredClone(entry)));
    expect(fingerprint(entry)).toMatch(/^[0-9a-f]{14}$/);
  });

  it('groups errors that only differ by variable parts', () => {
    const make = (message: string, file: string): BrowserLogEntry => ({
      err: { message, name: 'NotFoundError', stack: stack(file) },
      level: 'error',
      msg: 'ignored when there is an error',
    });

    expect(
      fingerprint(
        make('Asset 42 not found', 'https://app.example.com/assets/index-B3x_9aZq.js?v=1'),
      ),
    ).toBe(
      fingerprint(make('Asset 43 not found', 'https://app.example.com/assets/index-Ck2LmP0w.js')),
    );
  });

  it('distinguishes error names, messages and locations', () => {
    const base: BrowserLogEntry = {
      err: { message: 'boom', name: 'TypeError', stack: stack('https://app/a.js') },
      level: 'error',
    };
    const variants: BrowserLogEntry[] = [
      { ...base, err: { ...base.err!, name: 'RangeError' } },
      { ...base, err: { ...base.err!, message: 'other' } },
      { ...base, err: { ...base.err!, stack: stack('https://app/a.js', 11) } },
      { ...base, err: { ...base.err!, stack: stack('https://app/b.js') } },
    ];

    for (const variant of variants) {
      expect(fingerprint(variant)).not.toBe(fingerprint(base));
    }
  });

  it('fingerprints entries without error from level, namespace and message', () => {
    const a = fingerprint({ level: 'warn', msg: 'Retry 1 of 3', namespace: 'sync' });

    expect(fingerprint({ level: 'warn', msg: 'Retry 2 of 3', namespace: 'sync' })).toBe(a);
    expect(fingerprint({ level: 'error', msg: 'Retry 1 of 3', namespace: 'sync' })).not.toBe(a);
    expect(fingerprint({ level: 'warn', msg: 'Retry 1 of 3', namespace: 'map' })).not.toBe(a);
    expect(fingerprint({ level: 'info' })).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe('normalizeMessage', () => {
  it.each([
    ['User 42 not found', 'User <n> not found'],
    ['Asset 3fa85f64-5717-4562-b3fc-2c963f66afa6 missing', 'Asset <uuid> missing'],
    ['Document 5f2b1c9e8d7a6b5c4d3e2f1a missing', 'Document <hex> missing'],
    [
      `Cannot read properties of undefined (reading 'id')`,
      'Cannot read properties of undefined (reading <str>)',
    ],
    ['Failed to fetch https://api.example.com/v1/assets?id=3', 'Failed to fetch <url>'],
    ['  deadbeef is not a word  ', 'deadbeef is not a word'],
  ])('%s', (input, expected) => {
    expect(normalizeMessage(input)).toBe(expected);
  });
});

describe('topFrame', () => {
  it.each([
    [
      'V8',
      'Error: x\n    at loadAsset (https://app/assets/index-B3x_9aZq.js?v=2:10:5)',
      'loadAsset (https://app/assets/index.js:10:5)',
    ],
    [
      'SpiderMonkey/JSC',
      'loadAsset@https://app/assets/main.js#x:10:5\n@https://app/b.js:1:1',
      'loadAsset@https://app/assets/main.js:10:5',
    ],
    ['anonymous JSC frame', '@https://app/b.js:1:1', '@https://app/b.js:1:1'],
  ])('parses %s stacks', (_, stack, expected) => {
    expect(topFrame(stack)).toBe(expected);
  });

  it('returns an empty string without a frame', () => {
    expect(topFrame(undefined)).toBe('');
    expect(topFrame('Error: no frames')).toBe('');
  });
});
