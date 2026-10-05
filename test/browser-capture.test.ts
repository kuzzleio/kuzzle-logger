// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureGlobalErrors, createVueErrorHandler, KuzzleLogger } from '../src/browser';
import { BrowserLogEntry } from '../src/protocol';

function setup(config: ConstructorParameters<typeof KuzzleLogger>[0] = {}) {
  const entries: BrowserLogEntry[] = [];
  const logger = new KuzzleLogger({
    console: true,
    namespace: 'app',
    sender: { send: (entry) => entries.push(entry) },
    ...config,
  });

  return { entries, logger };
}

function errorEvent(error: unknown, init: Partial<ErrorEventInit> = {}): Event {
  return Object.assign(new Event('error', { cancelable: true }), {
    colno: 7,
    error,
    filename: 'https://app.example.com/assets/index.js',
    lineno: 42,
    message: error instanceof Error ? error.message : 'Script error.',
    ...init,
  });
}

function rejectionEvent(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason });
}

describe('captureGlobalErrors', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let stop: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers({ now: 1759312800000 });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('logs uncaught errors with their location', () => {
    const { entries, logger } = setup();
    const error = new TypeError('x is undefined');

    stop = captureGlobalErrors(logger);
    window.dispatchEvent(errorEvent(error));

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      context: {
        event: 'error',
        location: { column: 7, file: 'https://app.example.com/assets/index.js', line: 42 },
      },
      err: { message: 'x is undefined', name: 'TypeError' },
      level: 'error',
      msg: 'Uncaught error: x is undefined',
      namespace: 'app',
    });
    expect(entries[0].err?.stack).toContain('x is undefined');
  });

  it('logs cross-origin errors without an error object', () => {
    const { entries, logger } = setup();

    stop = captureGlobalErrors(logger);
    window.dispatchEvent(errorEvent(null, { filename: '' }));

    expect(entries).toEqual([
      {
        context: { event: 'error' },
        level: 'error',
        msg: 'Uncaught error: Script error.',
        namespace: 'app',
        time: 1759312800000,
      },
    ]);
  });

  it('ignores the "undefined" file name given by Safari for console code', () => {
    const { entries, logger } = setup();

    stop = captureGlobalErrors(logger);
    window.dispatchEvent(errorEvent(new Error('from console'), { filename: 'undefined' }));

    expect(entries[0].context).toEqual({ event: 'error' });
  });

  it('logs unhandled rejections, with errors or other reasons', () => {
    const { entries, logger } = setup();

    stop = captureGlobalErrors(logger);
    window.dispatchEvent(rejectionEvent(new Error('request failed')));
    window.dispatchEvent(rejectionEvent('timeout'));
    window.dispatchEvent(rejectionEvent({ code: 42 }));
    window.dispatchEvent(rejectionEvent(undefined));

    expect(entries.map(({ context, err, msg }) => ({ context, err: err?.message, msg }))).toEqual([
      {
        context: { event: 'unhandledrejection' },
        err: 'request failed',
        msg: 'Unhandled rejection: request failed',
      },
      {
        context: { event: 'unhandledrejection', reason: 'timeout' },
        err: undefined,
        msg: 'Unhandled rejection: timeout',
      },
      {
        context: { event: 'unhandledrejection', reason: { code: 42 } },
        err: undefined,
        msg: 'Unhandled rejection: {"code":42}',
      },
      {
        context: { event: 'unhandledrejection' },
        err: undefined,
        msg: 'Unhandled rejection: undefined',
      },
    ]);
  });

  it('does not cancel the events, nor print them a second time', () => {
    const { logger } = setup();
    const error = errorEvent(new Error('boom'));
    const rejection = rejectionEvent('nope');
    const preventDefault = vi.spyOn(Event.prototype, 'preventDefault');

    stop = captureGlobalErrors(logger);
    window.dispatchEvent(error);
    window.dispatchEvent(rejection);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(error.defaultPrevented).toBe(false);
    expect(rejection.defaultPrevented).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();

    // Explicit logs are still mirrored
    logger.error('explicit');
    expect(consoleError).toHaveBeenCalledWith('[app] explicit');
  });

  it('deduplicates bursts of identical errors', () => {
    const { entries, logger } = setup();

    stop = captureGlobalErrors(logger, { dedupeInterval: 1000 });

    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(errorEvent(new Error('loop')));
      window.dispatchEvent(rejectionEvent('loop'));
    }

    window.dispatchEvent(errorEvent(new Error('other')));
    window.dispatchEvent(errorEvent(new Error('loop'), { lineno: 43 }));

    expect(entries.map((entry) => entry.msg)).toEqual([
      'Uncaught error: loop',
      'Unhandled rejection: loop',
      'Uncaught error: other',
      'Uncaught error: loop',
    ]);

    vi.advanceTimersByTime(1000);
    window.dispatchEvent(errorEvent(new Error('loop')));

    expect(entries).toHaveLength(5);
  });

  it('defaults to a 5 second deduplication interval', () => {
    const { entries, logger } = setup();

    stop = captureGlobalErrors(logger);
    window.dispatchEvent(rejectionEvent('again'));
    vi.advanceTimersByTime(4999);
    window.dispatchEvent(rejectionEvent('again'));
    vi.advanceTimersByTime(1);
    window.dispatchEvent(rejectionEvent('again'));

    expect(entries).toHaveLength(2);
  });

  it('keeps deduplicating after many distinct errors', () => {
    const { entries, logger } = setup();

    stop = captureGlobalErrors(logger, { dedupeInterval: 1000 });

    for (let i = 0; i < 150; i++) {
      window.dispatchEvent(rejectionEvent(`error ${i}`));
    }

    window.dispatchEvent(rejectionEvent('error 149'));
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(rejectionEvent('error 0'));

    expect(entries).toHaveLength(151);
  });

  it('returns a function that removes the listeners', () => {
    const { entries, logger } = setup();

    captureGlobalErrors(logger)();
    window.dispatchEvent(errorEvent(new Error('boom')));
    window.dispatchEvent(rejectionEvent('nope'));

    expect(entries).toEqual([]);
  });

  it('accepts a custom target', () => {
    const { entries, logger } = setup();
    const target = new EventTarget();

    stop = captureGlobalErrors(logger, { target });
    window.dispatchEvent(rejectionEvent('window'));
    target.dispatchEvent(rejectionEvent('target'));

    expect(entries.map((entry) => entry.msg)).toEqual(['Unhandled rejection: target']);
  });

  it('works with child loggers and respects the logger level', () => {
    const { entries, logger } = setup();

    const child = logger.child('global');

    stop = captureGlobalErrors(child);
    window.dispatchEvent(rejectionEvent('child'));
    child.level = 'fatal';
    window.dispatchEvent(rejectionEvent('hidden'));

    expect(entries.map((entry) => [entry.namespace, entry.msg])).toEqual([
      ['app:global', 'Unhandled rejection: child'],
    ]);
  });

  it('captures once per target, keeping the first logger', () => {
    const { entries, logger } = setup();
    const other = setup();

    stop = captureGlobalErrors(logger.child('first'));
    const again = captureGlobalErrors(other.logger.child('second'));

    expect(again).toBe(stop);

    window.dispatchEvent(rejectionEvent('once'));

    expect(entries.map((entry) => entry.namespace)).toEqual(['app:first']);
    expect(other.entries).toEqual([]);
  });

  it('can capture again after stopping, and per target', () => {
    const { entries, logger } = setup();
    const target = new EventTarget();

    captureGlobalErrors(logger.child('old'))();
    stop = captureGlobalErrors(logger.child('new'));
    const stopTarget = captureGlobalErrors(logger.child('target'), { target });

    window.dispatchEvent(rejectionEvent('window'));
    target.dispatchEvent(rejectionEvent('target'));
    stopTarget();
    stopTarget();
    target.dispatchEvent(rejectionEvent('stopped'));

    expect(entries.map((entry) => entry.namespace)).toEqual(['app:new', 'app:target']);
  });

  it('does nothing without a target', () => {
    const { logger } = setup();

    expect(captureGlobalErrors(logger, { target: {} as EventTarget })).toBeTypeOf('function');
  });
});

describe('createVueErrorHandler', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ now: 1759312800000 });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('logs the error with the component name and the Vue info', () => {
    const { entries, logger } = setup();
    const handler = createVueErrorHandler(logger.child('vue'));
    const error = new Error('render failed');

    handler(error, { $options: { name: 'DeviceMap' } }, 'render function');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      context: { component: 'DeviceMap', info: 'render function' },
      err: { message: 'render failed', name: 'Error' },
      level: 'error',
      msg: 'Vue error in render function: render failed',
      namespace: 'app:vue',
    });
  });

  it.each([
    ['<script setup> components', { $options: { __name: 'AssetList' } }, 'AssetList'],
    ['Vue 2 components', { $options: { _componentTag: 'asset-list' } }, 'asset-list'],
    ['anonymous components', { $options: {} }, undefined],
    ['a null instance', null, undefined],
  ])('handles %s', (_, instance, component) => {
    const { entries, logger } = setup();

    createVueErrorHandler(logger)(new Error('boom'), instance, 'setup function');

    expect(entries[0].context?.component).toBe(component);
  });

  it('logs thrown values that are not errors', () => {
    const { entries, logger } = setup();

    createVueErrorHandler(logger)('bad value', null, 'watcher callback');

    expect(entries[0]).toMatchObject({
      context: { info: 'watcher callback', reason: 'bad value' },
      msg: 'Vue error in watcher callback: bad value',
    });
    expect(entries[0].err).toBeUndefined();
  });

  it('prints the error to the console once, whatever the console option', () => {
    for (const console of [true, false, 'fatal'] as const) {
      consoleError.mockClear();
      const { logger } = setup({ console });
      const error = new Error('boom');

      createVueErrorHandler(logger)(error, null, 'render function');

      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(error);
    }
  });

  it('prints the error even when the logger is silent', () => {
    const { entries, logger } = setup({ level: 'silent' });
    const error = new Error('boom');

    createVueErrorHandler(logger)(error, null, 'render function');

    expect(entries).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it.each([
    ['https://vuejs.org/error-reference/#runtime-1', 'render function'],
    ['https://vuejs.org/error-reference/#runtime-3', 'watcher callback'],
    ['https://vuejs.org/error-reference/#runtime-16', 'app unmount cleanup function'],
    ['https://vuejs.org/error-reference/#runtime-bc', 'beforeCreate hook'],
    ['https://vuejs.org/error-reference/#runtime-u', 'updated hook'],
    [
      'https://vuejs.org/error-reference/#runtime-99',
      'https://vuejs.org/error-reference/#runtime-99',
    ],
    ['v-on handler', 'v-on handler'],
  ])('maps the production info %s', (info, expected) => {
    const { entries, logger } = setup();

    createVueErrorHandler(logger)(new Error('boom'), null, info);

    expect(entries[0]).toMatchObject({
      context: { info: expected },
      msg: `Vue error in ${expected}: boom`,
    });
  });

  it('calls the previous handler after logging, every time', () => {
    const { entries, logger } = setup();
    const calls: string[] = [];
    const previous = vi.fn((err: unknown, instance: unknown, info: string) => {
      calls.push(`previous:${entries.length}:${info}`);
    });
    const handler = createVueErrorHandler(logger, { previous });
    const error = new Error('boom');
    const instance = { $options: { name: 'Map' } };

    handler(error, instance, 'render function');
    handler(error, instance, 'render function');

    expect(previous).toHaveBeenCalledWith(error, instance, 'render function');
    expect(calls).toEqual(['previous:1:render function', 'previous:1:render function']);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it('never throws when the previous handler does', () => {
    const { entries, logger } = setup();
    const handler = createVueErrorHandler(logger, {
      previous: () => {
        throw new Error('previous failure');
      },
    });

    expect(() => handler(new Error('boom'), null, 'render function')).not.toThrow();
    expect(entries).toHaveLength(1);
  });

  it('deduplicates identical errors within dedupeInterval (5 s by default)', () => {
    const { entries, logger } = setup();
    const handler = createVueErrorHandler(logger);
    const map = { $options: { name: 'Map' } };

    handler(new Error('render failed'), map, 'render function');
    handler(new Error('render failed'), map, 'render function');
    handler(new Error('render failed'), { $options: { name: 'List' } }, 'render function');
    handler(new Error('render failed'), map, 'setup function');
    handler(new TypeError('render failed'), map, 'render function');
    handler(new Error('other'), map, 'render function');
    vi.advanceTimersByTime(4999);
    handler(new Error('render failed'), map, 'render function');
    vi.advanceTimersByTime(1);
    handler(new Error('render failed'), map, 'render function');

    expect(entries).toHaveLength(6);
    expect(consoleError).toHaveBeenCalledTimes(8);
  });

  it('accepts a custom dedupeInterval, 0 disabling deduplication', () => {
    const { entries, logger } = setup();
    const handler = createVueErrorHandler(logger, { dedupeInterval: 0 });

    handler(new Error('boom'), null, 'render function');
    handler(new Error('boom'), null, 'render function');

    expect(entries).toHaveLength(2);
  });

  it('never throws', () => {
    const logger = new KuzzleLogger({
      console: false,
      getMergingObject: () => {
        throw new Error('merging object failure');
      },
    });

    consoleError.mockImplementation(() => {
      throw new Error('console failure');
    });

    expect(() => createVueErrorHandler(logger)(new Error('boom'), null, 'render')).not.toThrow();
  });
});
