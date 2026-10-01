import { describe, expect, it } from 'vitest';

import { createMemoryLogger } from './helpers';

const METHODS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

describe.each(METHODS)('KuzzleLogger.%s() arguments', (method) => {
  it('spreads additional arguments after a message', () => {
    const { logger, lines } = createMemoryLogger({ level: 'trace' });

    logger[method]('hello %s, you are %d', 'world', 42);

    expect(lines[0].msg).toBe('hello world, you are 42');
  });

  it('spreads additional arguments after an object and a message', () => {
    const { logger, lines } = createMemoryLogger({ level: 'trace' });

    logger[method]({ foo: 'bar' }, 'hello %s and %o', 'world', { a: 1 });

    expect(lines[0]).toMatchObject({ foo: 'bar', msg: 'hello world and {"a":1}' });
  });

  it('does not append anything when there are no additional arguments', () => {
    const { logger, lines } = createMemoryLogger({ level: 'trace' });

    logger[method]('hello %s');

    expect(lines[0].msg).toBe('hello %s');
  });

  it('applies the merging object with additional arguments', () => {
    const { logger, lines } = createMemoryLogger({
      getMergingObject: () => ({ requestId: 'req-1' }),
      level: 'trace',
    });

    logger[method]('hello %s', 'world');

    expect(lines[0]).toMatchObject({ msg: 'hello world', requestId: 'req-1' });
  });
});

describe('KuzzleLogger level methods', () => {
  it('produce the same output for every level', () => {
    const { logger, lines } = createMemoryLogger({
      getMergingObject: () => ({ nodeId: 'node-1' }),
      level: 'trace',
    });

    for (const method of METHODS) {
      logger[method]({ foo: 'bar' }, '%s:%d', method, 1);
    }

    for (const line of lines) {
      expect(line).toEqual({
        foo: 'bar',
        hostname: expect.any(String),
        level: expect.any(Number),
        msg: expect.any(String),
        nodeId: 'node-1',
        pid: process.pid,
        time: expect.any(Number),
      });
    }
    expect(lines.map((l) => [l.level, l.msg])).toEqual(
      METHODS.map((m, i) => [(i + 1) * 10, `${m}:1`]),
    );
  });
});
