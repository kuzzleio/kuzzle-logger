import { JSONObject } from '../types/JSONObject.js';
import { BrowserLogEntry, BrowserLogError } from './payload.js';

export type SanitizeOptions = {
  /**
   * Additional key fragments whose values are redacted (case-insensitive,
   * "-" and "_" are ignored). Added to DEFAULT_DENYLIST.
   */
  denylist?: string[];
  /**
   * Replacement for redacted values.
   * @default "[REDACTED]"
   */
  replacement?: string;
};

/**
 * Values of keys containing one of these fragments are redacted
 * (e.g. "password", "accessToken", "x-api-key", "Set-Cookie").
 */
export const DEFAULT_DENYLIST: readonly string[] = [
  'apikey',
  'authorization',
  'cookie',
  'credential',
  'jwt',
  'passwd',
  'password',
  'secret',
  'sessionid',
  'token',
];

const DEFAULT_REPLACEMENT = '[REDACTED]';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/g;

const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;

// "Authorization: Token abc", "authorization=abc"
const AUTHORIZATION_PATTERN =
  /\b(authorization\s*[:=]\s*)(?:(Basic|Bearer|Digest|Negotiate|Token)\s+)?[^\s"',;&#]+/gi;

// Any parameter name ending with a sensitive word: "client_secret=", "mytoken=", "x-api-key="
const QUERY_PARAMETER_PATTERN =
  /(^|[?&#;\s"'(,{])([\w-]*?(?:token|secret|passwd|password|api[-_]?key|jwt))=[^&#\s"']*/gi;

// "key": "value" or "key": 123, in JSON strings (e.g. a logged request body)
const JSON_PROPERTY_PATTERN = /"([^"\\]{1,64})"(\s*:\s*)("(?:[^"\\]|\\.)*"|[\w.+-]+)/g;

/**
 * Returns a sanitized copy of an entry:
 * - values of denylisted keys are redacted in "context" and in the custom properties
 *   of "err" (and of its "cause" and "errors"),
 * - tokens (JWTs, bearer tokens, "token=" query parameters) are redacted from every
 *   string, including "msg", error messages and stacks.
 *
 * "level", "namespace", "time" and error names are never redacted.
 *
 * The entry must have been validated first (see validateBatch).
 */
export function sanitize(entry: BrowserLogEntry, options: SanitizeOptions = {}): BrowserLogEntry {
  const denylist = [...DEFAULT_DENYLIST, ...(options.denylist ?? []).map(normalizeKey)];
  const replacement = options.replacement ?? DEFAULT_REPLACEMENT;
  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return redactString(value, replacement, denylist);
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    if (typeof value === 'object' && value !== null) {
      const copy: Record<string, unknown> = {};

      for (const [key, item] of Object.entries(value)) {
        if (UNSAFE_KEYS.has(key)) {
          continue;
        }

        copy[key] = isDenied(key, denylist) ? replacement : sanitizeValue(item);
      }

      return copy;
    }

    return value;
  };

  // name, message and stack are redacted as strings only, cause and errors as errors
  const sanitizeError = (value: unknown): unknown => {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      typeof (value as BrowserLogError).name !== 'string' ||
      typeof (value as BrowserLogError).message !== 'string'
    ) {
      return sanitizeValue(value);
    }

    const { cause, errors, message, name, stack, ...properties } = value as BrowserLogError;
    const copy = sanitizeValue(properties) as BrowserLogError;

    copy.message = redactString(message, replacement, denylist);
    copy.name = name;

    if (typeof stack === 'string') {
      copy.stack = redactString(stack, replacement, denylist);
    }

    if (cause !== undefined) {
      copy.cause = sanitizeError(cause);
    }

    if (Array.isArray(errors)) {
      copy.errors = errors.map(sanitizeError);
    }

    return copy;
  };

  const result: BrowserLogEntry = { ...entry };

  if (entry.msg !== undefined) {
    result.msg = redactString(entry.msg, replacement, denylist);
  }

  if (entry.context !== undefined) {
    result.context = sanitizeValue(entry.context) as JSONObject;
  }

  if (entry.err !== undefined) {
    result.err = sanitizeError(entry.err) as BrowserLogError;
  }

  return result;
}

/**
 * Redacts from a string: JWTs, authorization credentials, sensitive parameters
 * ("client_secret=", "x-api-key="...) and JSON properties whose key matches the
 * denylist (e.g. a logged request body).
 *
 * @param denylist Normalized key fragments (lowercase, without "-" and "_").
 */
export function redactString(
  value: string,
  replacement: string = DEFAULT_REPLACEMENT,
  denylist: readonly string[] = DEFAULT_DENYLIST,
): string {
  return value
    .replace(JWT_PATTERN, replacement)
    .replace(AUTHORIZATION_PATTERN, (_, prefix, scheme) =>
      scheme ? `${prefix}${scheme} ${replacement}` : `${prefix}${replacement}`,
    )
    .replace(BEARER_PATTERN, (_, scheme) => `${scheme} ${replacement}`)
    .replace(QUERY_PARAMETER_PATTERN, (_, prefix, key) => `${prefix}${key}=${replacement}`)
    .replace(JSON_PROPERTY_PATTERN, (match, key, separator) =>
      isDenied(key, denylist) ? `"${key}"${separator}"${replacement}"` : match,
    );
}

function isDenied(key: string, denylist: readonly string[]): boolean {
  const normalized = normalizeKey(key);

  return denylist.some((fragment) => normalized.includes(fragment));
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}
