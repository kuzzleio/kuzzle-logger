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

  const dedupeInterval = options.dedupeInterval ?? 5000;
  const lastSeen = new Map<string, number>();

  const isDuplicate = (key: string): boolean => {
    const now = Date.now();
    const previous = lastSeen.get(key);

    if (previous !== undefined && now - previous < dedupeInterval) {
      return true;
    }

    if (lastSeen.size >= MAX_DEDUPE_KEYS) {
      for (const [seenKey, time] of lastSeen) {
        if (now - time >= dedupeInterval) {
          lastSeen.delete(seenKey);
        }
      }
    }

    lastSeen.set(key, now);

    return false;
  };

  const onError = (event: Event) => {
    const { colno, error, filename, lineno, message } = event as ErrorEventLike;
    const location = filename ? { column: colno, file: filename, line: lineno } : undefined;
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

  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}

/**
 * Returns an error handler that logs Vue errors at the error level, with the
 * component name and the Vue `info` string (e.g. "setup function", "render function").
 *
 * Vue no longer prints errors when an error handler is set: this handler prints
 * them with `console.error`, like Vue does in production.
 *
 * It does not depend on `vue`.
 *
 * @example
 * app.config.errorHandler = createVueErrorHandler(logger.child('vue'));
 */
export function createVueErrorHandler(logger: KuzzleLogger): VueErrorHandler {
  return (err, instance, info) => {
    try {
      const context: JSONObject = { ...errorFields(err), info };
      const component = componentName(instance);

      if (component) {
        context.component = component;
      }

      const text = isErrorLike(err) ? err.message : describe(err);

      withoutConsoleMirroring(() => {
        logger.error(context, `Vue error in ${info}: ${text}`);
      });
    } catch {
      // Logging must never break the application
    }

    try {
      globalThis.console?.error?.(err);
    } catch {
      // Same as above
    }
  };
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
