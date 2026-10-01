import { BrowserLogEntry } from './payload.js';

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

const QUERY_PARAMETER_PATTERN =
  /([?&#;]|\b)((?:access|id|refresh|auth)?_?token|api_?key|jwt|password|secret)=[^&#\s"']*/gi;

/**
 * Returns a sanitized copy of an entry: values of denylisted keys are redacted in
 * "context" and "err", and tokens (JWTs, bearer tokens, "token=" query parameters)
 * are redacted from every string, including "msg" and stacks.
 *
 * The entry must have been validated first (see validateBatch).
 */
export function sanitize(entry: BrowserLogEntry, options: SanitizeOptions = {}): BrowserLogEntry {
  const denylist = [...DEFAULT_DENYLIST, ...(options.denylist ?? []).map(normalizeKey)];
  const replacement = options.replacement ?? DEFAULT_REPLACEMENT;
  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return redactString(value, replacement);
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

        const normalized = normalizeKey(key);

        copy[key] = denylist.some((fragment) => normalized.includes(fragment))
          ? replacement
          : sanitizeValue(item);
      }

      return copy;
    }

    return value;
  };

  return sanitizeValue(entry) as BrowserLogEntry;
}

/**
 * Redacts JWTs, bearer/basic credentials and sensitive query parameters from a string.
 */
export function redactString(value: string, replacement: string = DEFAULT_REPLACEMENT): string {
  return value
    .replace(JWT_PATTERN, replacement)
    .replace(BEARER_PATTERN, (_, scheme) => `${scheme} ${replacement}`)
    .replace(QUERY_PARAMETER_PATTERN, (match, prefix, key) => `${prefix}${key}=${replacement}`);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}
