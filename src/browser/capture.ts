import { isErrorLike } from '../serializeError.js';
import { JSONObject } from '../types/JSONObject.js';
import { KuzzleLogger, withoutConsoleMirroring } from './KuzzleLogger.js';

export type CaptureGlobalErrorsOptions = {
  /**
   * Identical errors (same kind, name, message and location) received within this
   * delay of the previous one are dropped, so that an error thrown in a loop or a
   * timer is logged once per interval instead of flooding the backend.
   *
   * @default 5000
   */
  dedupeInterval?: number;
  /**
   * Object the listeners are added to.
   *
   * @default window
   */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
};

export type VueErrorHandlerOptions = {
  /**
   * Identical errors (same name, message, info and component) received within this
   * delay of the previous one are not logged again, so that an error thrown on each
   * render is logged once per interval. They are still printed and passed to
   * "previous". 0 disables the deduplication.
   *
   * @default 5000
   */
  dedupeInterval?: number;
  /**
   * Handler called after logging, with the same arguments, e.g. the error handler
   * set before (`app.config.errorHandler`) or the one of an error tracking tool.
   */
  previous?: VueErrorHandler;
};

/**
 * Error handler for Vue 3 (`app.config.errorHandler`) and Vue 2 (`Vue.config.errorHandler`).
 */
export type VueErrorHandler = (err: unknown, instance: unknown, info: string) => void;

type ErrorEventLike = {
  colno?: number;
  error?: unknown;
  filename?: string;
  lineno?: number;
  message?: string;
};

type RejectionEventLike = {
  reason?: unknown;
};

// Above this many distinct errors, expired deduplication keys are pruned
const MAX_DEDUPE_KEYS = 100;

// Readable "info" strings of the codes given by Vue >= 3.4 production builds
// ("https://vuejs.org/error-reference/#runtime-N"), from Vue's ErrorTypeStrings
const VUE_ERROR_REFERENCE = 'https://vuejs.org/error-reference/#runtime-';
const VUE_ERROR_TYPES = new Map<string, string>([
  ['0', 'setup function'],
  ['1', 'render function'],
  ['2', 'watcher getter'],
  ['3', 'watcher callback'],
  ['4', 'watcher cleanup function'],
  ['5', 'native event handler'],
  ['6', 'component event handler'],
  ['7', 'vnode hook'],
  ['8', 'directive hook'],
  ['9', 'transition hook'],
  ['10', 'app errorHandler'],
  ['11', 'app warnHandler'],
  ['12', 'ref function'],
  ['13', 'async component loader'],
  ['14', 'scheduler flush'],
  ['15', 'component update'],
  ['16', 'app unmount cleanup function'],
  ['a', 'activated hook'],
  ['bc', 'beforeCreate hook'],
  ['bm', 'beforeMount hook'],
  ['bu', 'beforeUpdate hook'],
  ['bum', 'beforeUnmount hook'],
  ['c', 'created hook'],
  ['da', 'deactivated hook'],
  ['ec', 'errorCaptured hook'],
  ['m', 'mounted hook'],
  ['rtc', 'renderTracked hook'],
  ['rtg', 'renderTriggered hook'],
  ['sp', 'serverPrefetch hook'],
  ['u', 'updated hook'],
  ['um', 'unmounted hook'],
]);

type EventTargetLike = NonNullable<CaptureGlobalErrorsOptions['target']>;

// Active captures: one per target, so that calling captureGlobalErrors twice (HMR,
// platform and application code) does not log every error twice
const captures = new WeakMap<EventTargetLike, () => void>();

/**
 * Returns a function telling whether a key was already seen within the interval.
 */
function deduplicator(interval: number): (key: string) => boolean {
  const lastSeen = new Map<string, number>();

  return (key) => {
    if (interval <= 0) {
      return false;
    }

    const now = Date.now();
    const previous = lastSeen.get(key);

    if (previous !== undefined && now - previous < interval) {
      return true;
    }

    if (lastSeen.size >= MAX_DEDUPE_KEYS) {
      for (const [seenKey, time] of lastSeen) {
        if (now - time >= interval) {
          lastSeen.delete(seenKey);
        }
      }
    }

    lastSeen.set(key, now);

    return false;
  };
}

/**
 * Logs uncaught errors and unhandled promise rejections (`window` `error` and
 * `unhandledrejection` events) at the error level. Opt-in: errors should be pushed
 * explicitly where they are handled.
 *
 * The events are not cancelled, so the browser still prints them to the console,
 * and the logger does not print them a second time.
 *
 * Returns a function that removes the listeners.
 *
 * Errors are captured once per target: while a capture is active, later calls add
 * no listener and return the same function (the first logger keeps logging).
 *
 * @example
 * const stop = captureGlobalErrors(logger.child('global'));
 */
export function captureGlobalErrors(
  logger: KuzzleLogger,
  options: CaptureGlobalErrorsOptions = {},
): () => void {
  const target = options.target ?? (typeof window === 'undefined' ? undefined : window);

  if (!target || typeof target.addEventListener !== 'function') {
    return () => {};
  }

  const existing = captures.get(target);

  if (existing) {
    return existing;
  }

  const isDuplicate = deduplicator(options.dedupeInterval ?? 5000);

  const onError = (event: Event) => {
    const { colno, error, filename, lineno, message } = event as ErrorEventLike;
    // Safari gives "undefined" for code evaluated in the devtools console
    const location =
      filename && filename !== 'undefined'
        ? { column: colno, file: filename, line: lineno }
        : undefined;
    const text = isErrorLike(error) ? error.message : (message ?? String(error));
    const key = [
      'error',
      isErrorLike(error) ? error.name : '',
      text,
      location ? `${filename}:${lineno}:${colno}` : '',
    ].join('\n');

    if (isDuplicate(key)) {
      return;
    }

    // Cross-origin scripts only give "Script error." and no error object
    const fields = error === undefined || error === null ? {} : errorFields(error);

    withoutConsoleMirroring(() => {
      logger.error(
        { ...fields, event: 'error', ...(location && { location }) },
        `Uncaught error: ${text}`,
      );
    });
  };

  const onRejection = (event: Event) => {
    const { reason } = event as RejectionEventLike;
    const text = isErrorLike(reason) ? reason.message : describe(reason);
    const key = ['unhandledrejection', isErrorLike(reason) ? reason.name : '', text].join('\n');

    if (isDuplicate(key)) {
      return;
    }

    withoutConsoleMirroring(() => {
      logger.error(
        { ...errorFields(reason), event: 'unhandledrejection' },
        `Unhandled rejection: ${text}`,
      );
    });
  };

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);

  const stop = () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);

    if (captures.get(target) === stop) {
      captures.delete(target);
    }
  };

  captures.set(target, stop);

  return stop;
}

/**
 * Returns an error handler that logs Vue errors at the error level, with the
 * component name and the Vue `info` string (e.g. "setup function", "render function").
 * The codes given by Vue >= 3.4 production builds are mapped to these strings.
 *
 * Vue no longer prints errors when an error handler is set: this handler prints
 * them with `console.error`, like Vue does in production.
 *
 * It does not depend on `vue`.
 *
 * @example
 * app.config.errorHandler = createVueErrorHandler(logger.child('vue'), {
 *   previous: app.config.errorHandler,
 * });
 */
export function createVueErrorHandler(
  logger: KuzzleLogger,
  options: VueErrorHandlerOptions = {},
): VueErrorHandler {
  const isDuplicate = deduplicator(options.dedupeInterval ?? 5000);

  return (err, instance, info) => {
    try {
      const readableInfo = vueInfo(info);
      const component = componentName(instance);
      const text = isErrorLike(err) ? err.message : describe(err);
      const key = [isErrorLike(err) ? err.name : '', text, readableInfo, component ?? ''].join(
        '\n',
      );

      if (!isDuplicate(key)) {
        const context: JSONObject = { ...errorFields(err), info: readableInfo };

        if (component) {
          context.component = component;
        }

        withoutConsoleMirroring(() => {
          logger.error(context, `Vue error in ${readableInfo}: ${text}`);
        });
      }
    } catch {
      // Logging must never break the application
    }

    try {
      globalThis.console?.error?.(err);
    } catch {
      // Same as above
    }

    try {
      options.previous?.(err, instance, info);
    } catch {
      // Same as above
    }
  };
}

function vueInfo(info: unknown): string {
  if (typeof info !== 'string') {
    return String(info);
  }

  if (info.startsWith(VUE_ERROR_REFERENCE)) {
    const code = info.slice(VUE_ERROR_REFERENCE.length);

    return VUE_ERROR_TYPES.get(code) ?? info;
  }

  return info;
}

function errorFields(value: unknown): JSONObject {
  return isErrorLike(value) ? { err: value } : { reason: value };
}

function describe(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Name of a Vue 3 (options, `<script setup>`) or Vue 2 component instance.
 */
function componentName(instance: unknown): string | undefined {
  if (typeof instance !== 'object' || instance === null) {
    return undefined;
  }

  const options = (instance as { $options?: Record<string, unknown> }).$options;
  const name = options?.name ?? options?.__name ?? options?._componentTag;

  return typeof name === 'string' && name.length > 0 ? name : undefined;
}
