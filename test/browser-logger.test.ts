// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserLogSender, KuzzleLogger } from '../src/browser';
import { BrowserLogEntry } from '../src/protocol';

function memorySender(): BrowserLogSender & { entries: BrowserLogEntry[] } {
  const entries: BrowserLogEntry[] = [];

  return {
    entries,
    flush: vi.fn(async () => {}),
    send: (entry) => {
      entries.push(entry);
    },
  };
}

function setup(config: ConstructorParameters<typeof KuzzleLogger>[0] = {}) {
  const sender = memorySender();
  const logger = new KuzzleLogger({ console: false, sender, ...config });

  return { entries: sender.entries, logger, sender };
}

describe('browser KuzzleLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1759312800000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs in a DOM environment', () => {
    expect(typeof window).toBe('object');
  });

  describe('levels', () => {
    it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const)(
      'logs %s entries with the v1 entry format',
      (level) => {
        const { entries, logger } = setup({ level: 'trace' });

        logger[level]('hello');

        expect(entries).toEqual([{ level, msg: 'hello', time: 1759312800000 }]);
      },
    );

    it('defaults to info', () => {
      const { entries, logger } = setup();

      logger.debug('hidden');
      logger.info('shown');

      expect(logger.level).toBe('info');
      expect(entries.map((entry) => entry.msg)).toEqual(['shown']);
    });

    it('can change level at runtime, including silent', () => {
      const { entries, logger } = setup();

      logger.level = 'debug';
      logger.debug('shown');
      logger.level = 'silent';
      logger.fatal('hidden');

      expect(logger.level).toBe('silent');
      expect(entries.map((entry) => entry.msg)).toEqual(['shown']);
    });
  });

  describe('arguments', () => {
    it('formats the message with additional arguments', () => {
      const { entries, logger } = setup();

      logger.info('loaded %d assets in %s', 3, 'map');
      logger.info({ a: 1 }, 'user %s', 'alice');

      expect(entries.map((entry) => entry.msg)).toEqual(['loaded 3 assets in map', 'user alice']);
    });

    it('puts objects in "context"', () => {
      const { entries, logger } = setup();

      logger.info({ assetId: 'abc', nested: { list: [1, 2] } }, 'loaded');
      logger.info({ assetId: 'abc' });

      expect(entries).toEqual([
        {
          context: { assetId: 'abc', nested: { list: [1, 2] } },
          level: 'info',
          msg: 'loaded',
          time: 1759312800000,
        },
        { context: { assetId: 'abc' }, level: 'info', time: 1759312800000 },
      ]);
    });

    it('serializes an error passed first and uses its message', () => {
      const { entries, logger } = setup();
      const cause = new Error('root cause');
      const err = new TypeError('boom', { cause });

      logger.error(err);
      logger.error(err, 'custom message');

      expect(entries[0]).toEqual({
        err: {
          cause: { message: 'root cause', name: 'Error', stack: cause.stack },
          message: 'boom',
          name: 'TypeError',
          stack: err.stack,
        },
        level: 'error',
        msg: 'boom',
        time: 1759312800000,
      });
      expect(entries[1].msg).toBe('custom message');
      expect(entries[1].err?.message).toBe('boom');
    });

    it('moves errors from the "err" and "error" keys out of the context', () => {
      const { entries, logger } = setup();

      logger.error({ assetId: 'abc', err: new RangeError('a') }, 'failed');
      logger.error({ error: new RangeError('b') }, 'failed');

      expect(entries[0]).toMatchObject({
        context: { assetId: 'abc' },
        err: { message: 'a', name: 'RangeError' },
      });
      expect(entries[1]).toMatchObject({ err: { message: 'b', name: 'RangeError' } });
      expect(entries[1]).not.toHaveProperty('context');
    });

    it('converts the context to plain JSON', () => {
      const { entries, logger } = setup();
      const circular: Record<string, unknown> = { name: 'loop' };
      circular.self = circular;
      const shared = { x: 1 };

      logger.info(
        {
          big: 10n,
          circular,
          date: new Date('2026-10-01T00:00:00.000Z'),
          fn: () => 1,
          inner: new Error('inner'),
          shared: [shared, shared],
          undef: undefined,
        },
        'json',
      );

      expect(entries[0].context).toEqual({
        big: '10',
        circular: { name: 'loop', self: '[Circular]' },
        date: '2026-10-01T00:00:00.000Z',
        inner: expect.objectContaining({ message: 'inner', name: 'Error' }),
        shared: [{ x: 1 }, { x: 1 }],
      });
    });

    it('handles null and non-string first arguments', () => {
      const { entries, logger } = setup();

      logger.info(null as never);
      logger.info(42 as never);

      expect(entries).toHaveLength(2);
    });
  });

  describe('namespaces and merging object', () => {
    it('uses the configured namespace', () => {
      const { entries, logger } = setup({ namespace: 'dashboard' });

      logger.info('hello');

      expect(entries[0].namespace).toBe('dashboard');
    });

    it('joins child namespaces with ":"', () => {
      const { entries, logger } = setup({ namespace: 'dashboard' });

      logger.child('map').child('layer').info('a');
      setup().logger.child('orphan');
      logger.child('map').info('b');

      expect(entries.map((entry) => entry.namespace)).toEqual([
        'dashboard:map:layer',
        'dashboard:map',
      ]);
    });

    it('names children without a parent namespace', () => {
      const { entries, logger } = setup();

      logger.child('map').info('a');

      expect(entries[0].namespace).toBe('map');
    });

    it('evaluates the merging object on each log, including in children', () => {
      let route = '/home';
      const { entries, logger } = setup({ getMergingObject: () => ({ route }) });
      const child = logger.child('router');

      child.info('first');
      route = '/map';
      child.info('second');

      expect(entries.map((entry) => entry.context)).toEqual([
        { route: '/home' },
        { route: '/map' },
      ]);
    });

    it('lets the merging object override the logged object', () => {
      const { entries, logger } = setup({ getMergingObject: () => ({ route: '/home' }) });

      logger.info({ id: 1, route: 'spoofed' }, 'x');

      expect(entries[0].context).toEqual({ id: 1, route: '/home' });
    });

    it('lets children have their own level', () => {
      const { entries, logger } = setup();
      const child = logger.child('verbose');

      child.level = 'debug';
      child.debug('child');
      logger.debug('parent');

      expect(entries.map((entry) => entry.msg)).toEqual(['child']);
    });
  });

  describe('console mirroring', () => {
    function spyConsole() {
      return {
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      };
    }

    it('mirrors to the matching console method by default', () => {
      const spies = spyConsole();
      const logger = new KuzzleLogger({ level: 'trace', namespace: 'app' });
      const err = new Error('boom');

      logger.trace('t');
      logger.debug('d');
      logger.info({ id: 1 }, 'i');
      logger.warn('w');
      logger.error(err);
      logger.fatal('f');

      expect(spies.debug.mock.calls).toEqual([['[app] t'], ['[app] d']]);
      expect(spies.info.mock.calls).toEqual([['[app] i', { id: 1 }]]);
      expect(spies.warn.mock.calls).toEqual([['[app] w']]);
      expect(spies.error.mock.calls).toEqual([['[app] boom', err], ['[app] f']]);
    });

    it('can be disabled', () => {
      const spies = spyConsole();

      new KuzzleLogger({ console: false }).error('hidden');

      expect(spies.error).not.toHaveBeenCalled();
    });

    it('can be restricted to a minimum level, without affecting the sender', () => {
      const spies = spyConsole();
      const { entries, logger } = setup({ console: 'warn' });

      logger.info('info');
      logger.warn('warn');

      expect(spies.info).not.toHaveBeenCalled();
      expect(spies.warn).toHaveBeenCalledWith('warn');
      expect(entries).toHaveLength(2);
    });

    it('never throws when the console does', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {
        throw new Error('console broken');
      });
      const { entries, logger } = setup({ console: true });

      expect(() => logger.info('hello')).not.toThrow();
      expect(entries).toHaveLength(1);
    });
  });

  describe('sender', () => {
    it('works without a sender', () => {
      const logger = new KuzzleLogger({ console: false });

      expect(() => logger.error('nowhere')).not.toThrow();
    });

    it('never throws when the sender does', async () => {
      const logger = new KuzzleLogger({
        console: false,
        sender: {
          flush: async () => {
            throw new Error('network down');
          },
          send: () => {
            throw new Error('buffer full');
          },
        },
      });

      expect(() => logger.error('boom')).not.toThrow();
      await expect(logger.flush()).resolves.toBeUndefined();
    });

    it('flushes the shared sender from children', async () => {
      const { logger, sender } = setup();

      await logger.child('a').flush();

      expect(sender.flush).toHaveBeenCalledTimes(1);
    });

    it('flushes without a sender, or a sender without flush', async () => {
      await expect(new KuzzleLogger({ console: false }).flush()).resolves.toBeUndefined();
      await expect(
        new KuzzleLogger({ console: false, sender: { send: () => {} } }).flush(),
      ).resolves.toBeUndefined();
    });
  });
});
