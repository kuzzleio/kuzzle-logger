import { describe, expect, it } from 'vitest';

import { createMemoryLogger } from './helpers';

const LEVELS = [
  ['trace', 10],
  ['debug', 20],
  ['info', 30],
  ['warn', 40],
  ['error', 50],
  ['fatal', 60],
] as const;

describe('KuzzleLogger', () => {
  describe.each(LEVELS)('%s()', (method, levelValue) => {
    it('logs a message', () => {
      const { logger, lines } = createMemoryLogger({ level: 'trace' });

      logger[method]('hello');

      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ level: levelValue, msg: 'hello' });
    });

    it('logs an object with a message', () => {
      const { logger, lines } = createMemoryLogger({ level: 'trace' });

      logger[method]({ foo: 'bar' }, 'hello');

      expect(lines[0]).toMatchObject({ foo: 'bar', level: levelValue, msg: 'hello' });
    });

    it('logs an object without a message', () => {
      const { logger, lines } = createMemoryLogger({ level: 'trace' });

      logger[method]({ foo: 'bar' });

      expect(lines[0]).toMatchObject({ foo: 'bar', level: levelValue });
      expect(lines[0]).not.toHaveProperty('msg');
    });

    it('applies the merging object', () => {
      const { logger, lines } = createMemoryLogger({
        getMergingObject: () => ({ nodeId: 'node-1' }),
        level: 'trace',
      });

      logger[method]('hello');
      logger[method]({ foo: 'bar' }, 'hello');

      expect(lines[0]).toMatchObject({ msg: 'hello', nodeId: 'node-1' });
      expect(lines[1]).toMatchObject({ foo: 'bar', msg: 'hello', nodeId: 'node-1' });
    });
  });

  // trace() is excluded until #23 is fixed: it does not spread its args.
  describe.each(LEVELS.filter(([method]) => method !== 'trace'))('%s() interpolation', (method) => {
    it('interpolates additional arguments in the message', () => {
      const { logger, lines } = createMemoryLogger({ level: 'trace' });

      logger[method]('hello %s, you are %d', 'world', 42);
      logger[method]({ foo: 'bar' }, 'hello %s', 'world');

      expect(lines[0].msg).toBe('hello world, you are 42');
      expect(lines[1]).toMatchObject({ foo: 'bar', msg: 'hello world' });
    });
  });

  it('evaluates the merging object on each log call', () => {
    let requestId = 'req-1';
    const { logger, lines } = createMemoryLogger({
      getMergingObject: () => ({ requestId }),
    });

    logger.info('first');
    requestId = 'req-2';
    logger.info('second');

    expect(lines[0].requestId).toBe('req-1');
    expect(lines[1].requestId).toBe('req-2');
  });

  describe('level', () => {
    it('defaults to info', () => {
      const { logger, lines } = createMemoryLogger();

      logger.debug('hidden');
      logger.info('visible');

      expect(logger.level).toBe('info');
      expect(lines.map((l) => l.msg)).toEqual(['visible']);
    });

    it('can be changed at runtime', () => {
      const { logger, lines } = createMemoryLogger();

      logger.level = 'warn';
      logger.info('hidden');
      logger.warn('visible');

      expect(logger.level).toBe('warn');
      expect(logger.pino.level).toBe('warn');
      expect(lines.map((l) => l.msg)).toEqual(['visible']);
    });

    it('silences every level with "silent"', () => {
      const { logger, lines } = createMemoryLogger({ level: 'silent' });

      logger.fatal('hidden');

      expect(lines).toHaveLength(0);
    });
  });

  describe('child()', () => {
    it('sets the namespace', () => {
      const { logger, lines } = createMemoryLogger();

      logger.child('api').info('hello');

      expect(lines[0]).toMatchObject({ msg: 'hello', namespace: 'api' });
    });

    it('nests namespaces with ":"', () => {
      const { logger, lines } = createMemoryLogger();

      logger.child('a').child('b').child('c').info('hello');

      expect(lines[0].namespace).toBe('a:b:c');
    });

    it('prefixes the namespace of the parent merging object', () => {
      const { logger, lines } = createMemoryLogger({
        getMergingObject: () => ({ namespace: 'kuzzle', nodeId: 'node-1' }),
      });

      logger.child('app').info('hello');

      expect(lines[0]).toMatchObject({ namespace: 'kuzzle:app', nodeId: 'node-1' });
    });

    it('writes to the parent destination and follows its level at creation', () => {
      const { logger, lines } = createMemoryLogger({ level: 'warn' });
      const child = logger.child('api');

      child.info('hidden');
      child.warn('visible');

      expect(child.level).toBe('warn');
      expect(lines.map((l) => l.msg)).toEqual(['visible']);
    });

    it('does not change the parent namespace', () => {
      const { logger, lines } = createMemoryLogger();

      logger.child('api');
      logger.info('hello');

      expect(lines[0]).not.toHaveProperty('namespace');
    });
  });

  describe('flush()', () => {
    it('resolves when the destination has no flush method', async () => {
      const { logger } = createMemoryLogger();

      await expect(logger.flush()).resolves.toBeUndefined();
    });

    it('resolves once the destination is flushed', async () => {
      let flushed = false;
      const { logger } = createMemoryLogger(
        {},
        {
          flush: (cb) => {
            flushed = true;
            cb();
          },
          write: () => {},
        },
      );

      await logger.flush();

      expect(flushed).toBe(true);
    });

    it('rejects when the destination fails to flush', async () => {
      const { logger } = createMemoryLogger(
        {},
        {
          flush: (cb) => cb(new Error('flush failed')),
          write: () => {},
        },
      );

      await expect(logger.flush()).rejects.toThrow('flush failed');
    });
  });
});
