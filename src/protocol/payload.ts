import { JSONObject } from '../types/JSONObject.js';

/**
 * Version of the browser logs wire format.
 */
export const PAYLOAD_VERSION = 1;

/**
 * Levels a browser entry can be logged with.
 */
export const BROWSER_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type BrowserLogLevel = (typeof BROWSER_LOG_LEVELS)[number];

/**
 * Format of an entry namespace.
 */
export const NAMESPACE_PATTERN = /^[a-zA-Z0-9:_-]{1,64}$/;

/**
 * Default maximum nesting depth of an entry "context" and "err". Objects nested
 * deeper are replaced: by "[Object]" or "[Array]" in the browser, by "[Truncated]"
 * by the backend.
 */
export const DEFAULT_MAX_DEPTH = 5;

/**
 * Makes a namespace match NAMESPACE_PATTERN: invalid characters are replaced
 * with "_" and it is truncated to 64 characters. Returns undefined when empty.
 */
export function normalizeNamespace(namespace: string): string | undefined {
  const normalized = namespace.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 64);

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * An error serialized by the browser logger.
 */
export type BrowserLogError = {
  [key: string]: unknown;
  cause?: unknown;
  message: string;
  name: string;
  stack?: string;
};

/**
 * A single log entry, as sent by the browser.
 */
export type BrowserLogEntry = {
  /**
   * Arbitrary data attached to the entry. Must be a plain JSON object.
   */
  context?: JSONObject;
  err?: BrowserLogError;
  level: BrowserLogLevel;
  msg?: string;
  /**
   * Appended to the server-side namespace (e.g. "dashboard:map").
   */
  namespace?: string;
  /**
   * Client epoch, in milliseconds. Informational only: stored as "clientTime".
   */
  time?: number;
};

/**
 * Optional, informational description of the frontend application.
 */
export type BrowserLogsApp = {
  name?: string;
  version?: string;
};

/**
 * A batch of browser log entries (payload v1).
 */
export type BrowserLogsPayload = {
  app?: BrowserLogsApp;
  /**
   * Number of entries dropped by the browser since the previous batch
   * (bounded buffer overflow).
   */
  dropped?: number;
  entries: BrowserLogEntry[];
  version: typeof PAYLOAD_VERSION;
};
