// pino ships no typings for its browser build: the members used are typed below (PinoBrowserLogger).
import pino from 'pino/browser.js';

import { BROWSER_LOG_LEVELS, BrowserLogEntry, BrowserLogLevel } from '../protocol/payload.js';
import { isErrorLike, serializeError } from '../serializeError.js';
import { JSONObject } from '../types/JSONObject.js';

/**
 * Receives every entry logged at or above the logger level.
 * Batching senders (kuzzle, http) are built on this interface.
 */
export interface BrowserLogSender {
  /**
   * Sends (or buffers) all pending entries. Called by logger.flush().
   */
  flush?(): Promise<void>;
  /**
   * Called synchronously for each entry. It must not block: buffer and send later.
   */
  send(entry: BrowserLogEntry): void;
}

export type BrowserLoggerLevel = BrowserLogLevel | 'silent';

export type BrowserKuzzleLoggerConfig = {
  /**
   * Mirrors entries to the devtools console:
   * - true: every logged entry,
   * - false: none,
   * - a level: entries at or above this level.
   *
   * Only entries at or above the logger level are mirrored.
   * Typical setup with Vite: `console: import.meta.env.DEV ? true : 'warn'`.
   *
   * @default true
   */
  console?: boolean | BrowserLogLevel;
  /**
   * Called on each log: its result is merged into the entry "context".
   * A "namespace" key is used as the base namespace (like the Node logger).
   */
  getMergingObject?: () => JSONObject;
  /**
   * @default "info"
   */
  level?: BrowserLoggerLevel;
  /**
   * Base namespace of the entries (e.g. "dashboard"). Children append theirs: "dashboard:map".
   */
  namespace?: string;
  /**
   * Where entries are sent. Without a sender, the logger only mirrors to the console.
   */
  sender?: BrowserLogSender;
};

type PinoBrowserLogger = {
  [level: string]: any;
  child(bindings: object): PinoBrowserLogger;
  level: string;
};

type LogObject = {
  level: BrowserLogLevel;
  msg?: string;
  time: number;
  [ENTRY]: PendingEntry;
};

type PendingEntry = {
  context?: JSONObject;
  err?: unknown;
  namespace?: string;
};

type Output = {
  consoleThreshold: number;
  sender?: BrowserLogSender;
};

const ENTRY = Symbol('kuzzle-logger.entry');

// Set by withoutConsoleMirroring(): pino browser calls write() synchronously
let consoleMirroringSuppressed = false;

const LEVEL_VALUES: Record<BrowserLoggerLevel, number> = {
  debug: 20,
  error: 50,
  fatal: 60,
  info: 30,
  silent: Infinity,
  trace: 10,
  warn: 40,
};

const CONSOLE_METHODS: Record<BrowserLogLevel, 'debug' | 'error' | 'info' | 'warn'> = {
  debug: 'debug',
  error: 'error',
  fatal: 'error',
  info: 'info',
  trace: 'debug',
  warn: 'warn',
};

/**
 * Browser logger, with the same API as the Node KuzzleLogger.
 *
 * Entries are mirrored to the devtools console and handed to the sender, which
 * forwards them to the application backend. It never throws because of its output.
 */
export class KuzzleLogger {
  private _pino: PinoBrowserLogger;

  private output: Output;

  private getMergingObject: () => JSONObject = () => ({});

  get level(): BrowserLoggerLevel {
    return this._pino.level as BrowserLoggerLevel;
  }

  set level(level: BrowserLoggerLevel) {
    this._pino.level = level;
  }

  constructor(config: BrowserKuzzleLoggerConfig = {}) {
    const { getMergingObject, namespace } = config;
    const consoleOption = config.console ?? true;

    if (getMergingObject || namespace) {
      this.getMergingObject = () => {
        const mergingObject = callMergingObject(getMergingObject);

        return namespace && !mergingObject.namespace
          ? { ...mergingObject, namespace }
          : mergingObject;
      };
    }

    let consoleThreshold = consoleOption ? 0 : Infinity;

    if (typeof consoleOption === 'string') {
      consoleThreshold = LEVEL_VALUES[consoleOption];
    }

    this.output = { consoleThreshold, sender: config.sender };

    const output = this.output;
    const write = (logObject: LogObject) => emit(output, logObject);

    this._pino = pino({
      browser: {
        formatters: { level: (label: string) => ({ level: label }) },
        write: Object.fromEntries(BROWSER_LOG_LEVELS.map((level) => [level, write])),
      },
      level: config.level ?? 'info',
    });
  }

  trace<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  trace(obj: unknown, msg?: string, ...args: any[]): void;
  trace(msg: string, ...args: any[]): void;
  trace(objOrMsg: any, ...args: any[]): void {
    this.log('trace', objOrMsg, args);
  }

  debug<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  debug(obj: unknown, msg?: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  debug(objOrMsg: any, ...args: any[]): void {
    this.log('debug', objOrMsg, args);
  }

  info<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  info(obj: unknown, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  info(objOrMsg: any, ...args: any[]): void {
    this.log('info', objOrMsg, args);
  }

  warn<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  warn(obj: unknown, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  warn(objOrMsg: any, ...args: any[]): void {
    this.log('warn', objOrMsg, args);
  }

  error<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  error(obj: unknown, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  error(objOrMsg: any, ...args: any[]): void {
    this.log('error', objOrMsg, args);
  }

  fatal<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  fatal(obj: unknown, msg?: string, ...args: any[]): void;
  fatal(msg: string, ...args: any[]): void;
  fatal(objOrMsg: any, ...args: any[]): void {
    this.log('fatal', objOrMsg, args);
  }

  /**
   * Sends pending entries. Never rejects: sender failures are swallowed.
   */
  async flush(): Promise<void> {
    try {
      await this.output.sender?.flush?.();
    } catch {
      // Logging must never break the application
    }
  }

  /**
   * Creates a child logger whose namespace is "<parent namespace>:<namespace>".
   * The parent merging object is evaluated on each log, not at creation time.
   */
  child(namespace: string): KuzzleLogger {
    const childLogger = Object.create(KuzzleLogger.prototype) as KuzzleLogger;

    childLogger._pino = this._pino.child({});
    childLogger.output = this.output;
    childLogger.getMergingObject = () => {
      const parentMergingObject = this.getMergingObject();

      return {
        ...parentMergingObject,
        namespace: parentMergingObject?.namespace
          ? `${parentMergingObject.namespace}:${namespace}`
          : namespace,
      };
    };

    return childLogger;
  }

  private log(level: BrowserLogLevel, objOrMsg: any, args: any[]): void {
    try {
      if (typeof objOrMsg === 'object' && objOrMsg !== null) {
        const message = args.shift();

        if (isErrorLike(objOrMsg)) {
          this._pino[level](this.toLogObject({}, objOrMsg), message ?? objOrMsg.message, ...args);
          return;
        }

        this._pino[level](this.toLogObject(objOrMsg), message, ...args);
        return;
      }

      this._pino[level](this.toLogObject({}), objOrMsg, ...args);
    } catch {
      // Logging must never break the application
    }
  }

  private toLogObject(obj: JSONObject, err?: unknown): { [ENTRY]: PendingEntry } {
    const { namespace, ...context } = { ...obj, ...this.getMergingObject() };
    const entry: PendingEntry = {};

    // Same keys as the Node error serializers
    for (const key of ['err', 'error']) {
      if (err === undefined && isErrorLike(context[key])) {
        err = context[key];
        delete context[key];
      }
    }

    if (err !== undefined) {
      entry.err = err;
    }

    if (Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (typeof namespace === 'string' && namespace.length > 0) {
      entry.namespace = namespace;
    }

    return { [ENTRY]: entry };
  }
}

/**
 * Runs fn with console mirroring disabled for every logger. Used by the capture
 * helpers for errors that the browser, or the helper itself, already prints.
 * Not exported from the browser entry point.
 */
export function withoutConsoleMirroring(fn: () => void): void {
  consoleMirroringSuppressed = true;

  try {
    fn();
  } finally {
    consoleMirroringSuppressed = false;
  }
}

/**
 * Calls the user merging object: it runs on each log, possibly before the
 * application state it reads exists (e.g. before login). Errors and non-object
 * results are ignored, so the entry is still logged, without it.
 */
function callMergingObject(getMergingObject?: () => JSONObject): JSONObject {
  try {
    const mergingObject: unknown = getMergingObject?.();

    if (
      typeof mergingObject === 'object' &&
      mergingObject !== null &&
      !Array.isArray(mergingObject)
    ) {
      return mergingObject as JSONObject;
    }
  } catch {
    // Logging must never break the application
  }

  return {};
}

function emit(output: Output, logObject: LogObject): void {
  const { level, msg, time } = logObject;
  const pending = logObject[ENTRY] ?? {};

  if (!consoleMirroringSuppressed && LEVEL_VALUES[level] >= output.consoleThreshold) {
    mirrorToConsole(level, msg, pending);
  }

  if (!output.sender) {
    return;
  }

  try {
    const entry: BrowserLogEntry = { level, time };

    if (msg !== undefined) {
      entry.msg = String(msg);
    }

    if (pending.namespace) {
      entry.namespace = pending.namespace;
    }

    if (pending.context) {
      entry.context = toJSON(pending.context) as JSONObject;
    }

    if (pending.err !== undefined) {
      entry.err = toJSON(serializeError(pending.err)) as BrowserLogEntry['err'];
    }

    output.sender.send(entry);
  } catch {
    // Logging must never break the application
  }
}

function mirrorToConsole(level: BrowserLogLevel, msg: string | undefined, pending: PendingEntry) {
  const method = CONSOLE_METHODS[level];
  const args: unknown[] = [pending.namespace ? `[${pending.namespace}] ${msg ?? ''}` : (msg ?? '')];

  if (pending.context) {
    args.push(pending.context);
  }

  // The original error, so that devtools display a clickable stack
  if (pending.err !== undefined) {
    args.push(pending.err);
  }

  try {
    globalThis.console?.[method]?.(...args);
  } catch {
    // Logging must never break the application
  }
}

/**
 * Converts a value to plain JSON: errors are serialized, dates become ISO strings,
 * bigints become strings, circular references become "[Circular]", and functions,
 * symbols and undefined values are dropped.
 */
function toJSON(value: unknown): unknown {
  // Objects being serialized, from the root to the current one: "value" is what was
  // returned by the replacer (e.g. a serialized error), "original" what it replaced.
  const ancestors: { original: object; value: object }[] = [];

  /* eslint-disable no-invalid-this -- JSON.stringify binds "this" to the holder object */
  const json = JSON.stringify(value, function replacer(this: unknown, _key, item: unknown) {
    if (typeof item === 'bigint') {
      return item.toString();
    }

    if (typeof item !== 'object' || item === null) {
      return item;
    }

    // "this" is the object holding the current key: unwind the ancestors down to it
    while (ancestors.length > 0 && ancestors[ancestors.length - 1].value !== this) {
      ancestors.pop();
    }

    if (ancestors.some((ancestor) => ancestor.original === item || ancestor.value === item)) {
      return '[Circular]';
    }

    const result = isErrorLike(item) ? (serializeError(item) as object) : item;

    ancestors.push({ original: item, value: result });

    return result;
  });
  /* eslint-enable no-invalid-this */

  return json === undefined ? undefined : JSON.parse(json);
}
