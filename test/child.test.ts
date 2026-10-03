import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';

import { createMemoryLogger } from './helpers';

describe('KuzzleLogger.child()', () => {
  it('resolves the parent merging object on each log call', () => {
    let requestId = 'req-1';
    const { logger, lines } = createMemoryLogger({
      getMergingObject: () => ({ namespace: 'kuzzle', requestId }),
    });
    const child = logger.child('api');

    child.info('first');
    requestId = 'req-2';
    child.info('second');

    expect(lines[0]).toMatchObject({ namespace: 'kuzzle:api', requestId: 'req-1' });
    expect(lines[1]).toMatchObject({ namespace: 'kuzzle:api', requestId: 'req-2' });
  });

  it('sees the AsyncLocalStorage context of a child created at boot', async () => {
    const storage = new AsyncLocalStorage<{ requestId: string }>();
    const { logger, lines } = createMemoryLogger({
      getMergingObject: () => ({ requestId: storage.getStore()?.requestId }),
    });
    const bootChild = logger.child('core').child('storage');

    await Promise.all(
      ['req-1', 'req-2'].map((requestId) =>
        storage.run({ requestId }, async () => {
          await new Promise((resolve) => setImmediate(resolve));
          bootChild.info({ foo: 'bar' }, requestId);
        }),
      ),
    );
    bootChild.info('outside');

    expect(lines.map((l) => [l.msg, l.requestId, l.namespace])).toEqual([
      ['req-1', 'req-1', 'core:storage'],
      ['req-2', 'req-2', 'core:storage'],
      ['outside', undefined, 'core:storage'],
    ]);
  });

  it('keeps the a:b:c namespace format for nested children', () => {
    const { logger, lines } = createMemoryLogger({
      getMergingObject: () => ({ namespace: 'a' }),
    });

    logger.child('b').child('c').info('hello');
    logger.child('b').info('hello');

    expect(lines[0].namespace).toBe('a:b:c');
    expect(lines[1].namespace).toBe('a:b');
  });

  it('follows a namespace change in the parent merging object', () => {
    let namespace = '';
    const { logger, lines } = createMemoryLogger({ getMergingObject: () => ({ namespace }) });
    const child = logger.child('b').child('c');

    child.info('without parent namespace');
    namespace = 'a';
    child.info('with parent namespace');

    expect(lines[0].namespace).toBe('b:c');
    expect(lines[1].namespace).toBe('a:b:c');
  });

  it('does not call the parent merging object at creation time', () => {
    let calls = 0;
    const { logger } = createMemoryLogger({
      getMergingObject: () => {
        calls++;
        return {};
      },
    });

    logger.child('a').child('b');

    expect(calls).toBe(0);
  });

  it('follows the parent level until its own level is set', () => {
    const { logger, lines } = createMemoryLogger({ level: 'info' });
    const child = logger.child('api');
    const grandChild = child.child('auth');

    logger.level = 'debug';
    child.debug('child debug');
    grandChild.debug('grandchild debug');

    logger.level = 'error';
    child.info('child info, hidden');
    grandChild.warn('grandchild warn, hidden');
    expect(child.level).toBe('error');

    child.level = 'trace';
    logger.level = 'fatal';
    child.trace('child trace');
    grandChild.trace('grandchild trace, follows the child');
    logger.error('parent error, hidden');

    expect(lines.map((line) => line.msg)).toEqual([
      'child debug',
      'grandchild debug',
      'child trace',
      'grandchild trace, follows the child',
    ]);
    expect(child.pino.level).toBe('trace');
  });
});
