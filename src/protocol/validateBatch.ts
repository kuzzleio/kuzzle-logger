import { JSONObject } from '../types/JSONObject.js';
import {
  BROWSER_LOG_LEVELS,
  BrowserLogEntry,
  BrowserLogError,
  BrowserLogLevel,
  BrowserLogsApp,
  PAYLOAD_VERSION,
} from './payload.js';

export type BatchLimits = {
  /**
   * Levels accepted from the browser.
   * @default all levels
   */
  levels?: readonly BrowserLogLevel[];
  /**
   * Maximum nesting depth of an entry "context" object.
   * @default 5
   */
  maxContextDepth?: number;
  /**
   * Maximum number of entries in a batch.
   * @default 100
   */
  maxEntries?: number;
  /**
   * Maximum length of "msg" and "err.message". Longer values are truncated.
   * @default 2048
   */
  maxMessageLength?: number;
  /**
   * Maximum serialized (JSON) size of the whole payload, in characters.
   * @default 65536
   */
  maxPayloadSize?: number;
  /**
   * Maximum length of "err.stack". Longer stacks are truncated.
   * @default 8192
   */
  maxStackLength?: number;
};

export const DEFAULT_BATCH_LIMITS: Required<BatchLimits> = {
  levels: BROWSER_LOG_LEVELS,
  maxContextDepth: 5,
  maxEntries: 100,
  maxMessageLength: 2048,
  maxPayloadSize: 65536,
  maxStackLength: 8192,
};

export type RejectedEntry = {
  index: number;
  reason: string;
};

export type BatchValidationResult =
  | {
      error: string;
      valid: false;
    }
  | {
      app?: BrowserLogsApp;
      dropped?: number;
      /**
       * Valid entries, normalized: unknown keys removed, long strings truncated.
       */
      entries: BrowserLogEntry[];
      rejected: RejectedEntry[];
      valid: true;
    };

const NAMESPACE_PATTERN = /^[a-zA-Z0-9:_-]{1,64}$/;

const TRUNCATED_SUFFIX = '…[truncated]';

/**
 * Keys that must never be copied, to prevent prototype pollution.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class EntryError extends Error {}

/**
 * Validates a browser logs batch (payload v1).
 *
 * A malformed batch (wrong version, too many entries, too large) is rejected as a whole.
 * Otherwise, invalid entries are reported in "rejected" and valid ones are returned normalized.
 *
 * This function never throws.
 */
export function validateBatch(payload: unknown, limits: BatchLimits = {}): BatchValidationResult {
  const options = { ...DEFAULT_BATCH_LIMITS, ...limits };

  if (!isPlainObject(payload)) {
    return { error: 'payload must be an object', valid: false };
  }

  if (payload.version !== PAYLOAD_VERSION) {
    return { error: `unsupported payload version (expected ${PAYLOAD_VERSION})`, valid: false };
  }

  if (!Array.isArray(payload.entries)) {
    return { error: '"entries" must be an array', valid: false };
  }

  if (payload.entries.length > options.maxEntries) {
    return { error: `too many entries (max ${options.maxEntries})`, valid: false };
  }

  const size = serializedSize(payload);

  if (size === null) {
    return { error: 'payload is not serializable', valid: false };
  }

  if (size > options.maxPayloadSize) {
    return { error: `payload too large (max ${options.maxPayloadSize})`, valid: false };
  }

  const entries: BrowserLogEntry[] = [];
  const rejected: RejectedEntry[] = [];

  for (const [index, entry] of (payload.entries as unknown[]).entries()) {
    try {
      entries.push(validateEntry(entry, options));
    } catch (error) {
      if (!(error instanceof EntryError)) {
        throw error;
      }

      rejected.push({ index, reason: error.message });
    }
  }

  const result: BatchValidationResult = { entries, rejected, valid: true };

  const app = validateApp(payload.app, options);
  if (app) {
    result.app = app;
  }

  if (Number.isSafeInteger(payload.dropped) && payload.dropped > 0) {
    result.dropped = payload.dropped;
  }

  return result;
}

function validateEntry(entry: unknown, options: Required<BatchLimits>): BrowserLogEntry {
  if (!isPlainObject(entry)) {
    throw new EntryError('entry must be an object');
  }

  if (!options.levels.includes(entry.level)) {
    throw new EntryError(`level must be one of: ${options.levels.join(', ')}`);
  }

  const result: BrowserLogEntry = { level: entry.level };

  if (entry.msg !== undefined) {
    if (typeof entry.msg !== 'string') {
      throw new EntryError('"msg" must be a string');
    }

    result.msg = truncate(entry.msg, options.maxMessageLength);
  }

  if (entry.time !== undefined) {
    if (typeof entry.time !== 'number' || !Number.isFinite(entry.time)) {
      throw new EntryError('"time" must be a finite number');
    }

    result.time = entry.time;
  }

  if (entry.namespace !== undefined) {
    if (typeof entry.namespace !== 'string' || !NAMESPACE_PATTERN.test(entry.namespace)) {
      throw new EntryError(`"namespace" must match ${NAMESPACE_PATTERN}`);
    }

    result.namespace = entry.namespace;
  }

  if (entry.context !== undefined) {
    if (!isPlainObject(entry.context)) {
      throw new EntryError('"context" must be a plain JSON object');
    }

    result.context = copyJSON(entry.context, options.maxContextDepth, '"context"') as JSONObject;
  }

  if (entry.err !== undefined) {
    result.err = validateError(entry.err, options);
  }

  return result;
}

function validateError(err: unknown, options: Required<BatchLimits>): BrowserLogError {
  if (!isPlainObject(err) || typeof err.name !== 'string' || typeof err.message !== 'string') {
    throw new EntryError('"err" must be an object with string "name" and "message"');
  }

  const copy = copyJSON(err, options.maxContextDepth, '"err"') as BrowserLogError;

  copy.message = truncate(copy.message, options.maxMessageLength);

  if (copy.stack !== undefined) {
    if (typeof copy.stack !== 'string') {
      throw new EntryError('"err.stack" must be a string');
    }

    copy.stack = truncate(copy.stack, options.maxStackLength);
  }

  return copy;
}

function validateApp(app: unknown, options: Required<BatchLimits>): BrowserLogsApp | undefined {
  if (!isPlainObject(app)) {
    return undefined;
  }

  const result: BrowserLogsApp = {};

  for (const key of ['name', 'version'] as const) {
    if (typeof app[key] === 'string') {
      result[key] = truncate(app[key], Math.min(128, options.maxMessageLength));
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Deep copies a JSON value, rejecting non-JSON values and objects deeper than maxDepth.
 */
function copyJSON(value: unknown, maxDepth: number, path: string, depth = 0): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new EntryError(`${path} contains a non-finite number`);
    }

    return value;
  }

  if (typeof value !== 'object') {
    throw new EntryError(`${path} contains a non-JSON value`);
  }

  if (depth >= maxDepth) {
    throw new EntryError(`${path} is too deep (max depth ${maxDepth})`);
  }

  if (Array.isArray(value)) {
    return value.map((item) => copyJSON(item, maxDepth, path, depth + 1));
  }

  if (!isPlainObject(value)) {
    throw new EntryError(`${path} contains a non-plain object`);
  }

  const copy: JSONObject = {};

  for (const key of Object.keys(value)) {
    if (!UNSAFE_KEYS.has(key)) {
      copy[key] = copyJSON(value[key], maxDepth, path, depth + 1);
    }
  }

  return copy;
}

function isPlainObject(value: unknown): value is JSONObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
}

function serializedSize(value: unknown): number | null {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, Math.max(0, maxLength - TRUNCATED_SUFFIX.length)) + TRUNCATED_SUFFIX;
}
