import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { KuzzleLogger } from '../src/KuzzleLogger';
import { errorSerializers, serializeError } from '../src/serializeError';
import { createMemoryLogger } from './helpers';

class KuzzleLikeError extends Error {
  id: string;
  code: number;
  status: number;

  constructor(message: string) {
    super(message);
    this.name = 'KuzzleLikeError';
    this.id = 'api.assert.missing_argument';
    this.code = 0x02040001;
    this.status = 400;
  }
}

describe('Error logging', () => {
  const mergingObject = () => ({ namespace: 'kuzzle', nodeId: 'node-1', requestId: 'req-1' });

  it('logger.error(err) serializes the error and uses its message', () => {
    const { logger, lines } = createMemoryLogger({ getMergingObject: mergingObject });
    const err = new TypeError('boom');

    logger.error(err);

    expect(lines[0]).toMatchObject({
      err: { message: 'boom', name: 'TypeError', stack: err.stack },
      level: 50,
      msg: 'boom',
      namespace: 'kuzzle',
      nodeId: 'node-1',
      requestId: 'req-1',
    });
  });

  it('logger.error(err, msg) keeps the given message', () => {
    const { logger, lines } = createMemoryLogger({ getMergingObject: mergingObject });

    logger.error(new Error('boom'), 'Failed to %s', 'load');

    expect(lines[0]).toMatchObject({
      err: { message: 'boom', name: 'Error' },
      msg: 'Failed to load',
      requestId: 'req-1',
    });
    expect(lines[0].err.stack).toContain('boom');
  });

  it.each(['err', 'error'])('logger.error({ %s }, msg) serializes the nested error', (key) => {
    const { logger, lines } = createMemoryLogger({ getMergingObject: mergingObject });

    logger.error({ assetId: 'abc', [key]: new RangeError('boom') }, 'Failed');

    expect(lines[0]).toMatchObject({
      assetId: 'abc',
      [key]: { message: 'boom', name: 'RangeError' },
      msg: 'Failed',
      nodeId: 'node-1',
    });
    expect(lines[0][key].stack).toContain('boom');
  });

  it('applies the namespace of a child logger', () => {
    const { logger, lines } = createMemoryLogger({ getMergingObject: mergingObject });

    logger.child('app').error(new Error('boom'));

    expect(lines[0]).toMatchObject({
      err: { message: 'boom' },
      msg: 'boom',
      namespace: 'kuzzle:app',
      nodeId: 'node-1',
    });
  });

  it('keeps custom error properties', () => {
    const { logger, lines } = createMemoryLogger();

    logger.error(new KuzzleLikeError('missing argument'));

    expect(lines[0].err).toMatchObject({
      code: 0x02040001,
      id: 'api.assert.missing_argument',
      message: 'missing argument',
      name: 'KuzzleLikeError',
      status: 400,
    });
  });

  it('serializes the cause chain', () => {
    const { logger, lines } = createMemoryLogger();
    const root = new Error('root');

    logger.warn(new Error('outer', { cause: new Error('inner', { cause: root }) }));

    expect(lines[0].err).toMatchObject({
      cause: { cause: { message: 'root', name: 'Error' }, message: 'inner', name: 'Error' },
      message: 'outer',
    });
    expect(lines[0].err.cause.cause.stack).toBe(root.stack);
  });

  it('works with every level', () => {
    const { logger, lines } = createMemoryLogger({ level: 'trace' });
    const methods = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

    for (const method of methods) {
      logger[method](new Error(method));
    }

    expect(lines.map((l) => [l.msg, l.err.message])).toEqual(methods.map((m) => [m, m]));
  });

  it('applies the merging object to plain objects with a "message" property', () => {
    const { logger, lines } = createMemoryLogger({ getMergingObject: mergingObject });

    logger.info({ message: 'not an error' }, 'hello');

    expect(lines[0]).toMatchObject({ message: 'not an error', msg: 'hello', nodeId: 'node-1' });
    expect(lines[0]).not.toHaveProperty('err');
  });

  it('configures the error serializers on the pino instance', async () => {
    const logger = new KuzzleLogger({
      transport: { options: { destination: '/dev/null' }, target: 'pino/file' },
    });

    expect((logger.pino as any)[pino.symbols.serializersSym]).toMatchObject(errorSerializers);
    expect((logger.child('a').pino as any)[pino.symbols.serializersSym]).toMatchObject(
      errorSerializers,
    );

    await logger.flush();
  });
});

describe('serializeError', () => {
  it('returns non-error values unchanged', () => {
    const obj = { foo: 'bar' };

    expect(serializeError(obj)).toBe(obj);
    expect(serializeError('boom')).toBe('boom');
    expect(serializeError(undefined)).toBeUndefined();
    expect(serializeError(null)).toBeNull();
  });

  it('keeps a non-error cause as is', () => {
    expect(serializeError(new Error('boom', { cause: { code: 42 } }))).toMatchObject({
      cause: { code: 42 },
    });
  });

  it('serializes aggregated errors', () => {
    const serialized = serializeError(
      new AggregateError([new Error('a'), new TypeError('b')], 'many'),
    ) as any;

    expect(serialized).toMatchObject({
      errors: [
        { message: 'a', name: 'Error' },
        { message: 'b', name: 'TypeError' },
      ],
      message: 'many',
      name: 'AggregateError',
    });
  });

  it('serializes error-like objects from another realm', () => {
    const errorLike = { message: 'boom', name: 'DOMException', stack: 'DOMException: boom' };

    expect(serializeError(errorLike)).toEqual(errorLike);
  });

  it('handles circular references', () => {
    const err: any = new Error('boom');
    err.self = err;
    err.cause = err;

    const serialized = serializeError(err) as any;

    expect(serialized.self).toBe('[Circular]');
    expect(serialized.cause).toBe('[Circular]');
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it('is idempotent', () => {
    const once = serializeError(new KuzzleLikeError('boom'));

    expect(serializeError(once)).toEqual(once);
  });
});
