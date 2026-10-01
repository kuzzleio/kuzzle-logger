import { BrowserLogEntry } from './payload.js';

/**
 * Returns a stable hash grouping occurrences of the same error (or message):
 * error name, normalized message and top stack frame.
 *
 * Variable parts of messages (numbers, UUIDs, hexadecimal ids, quoted values, URLs)
 * are replaced by placeholders, so "User 42 not found" and "User 43 not found" share a
 * fingerprint. Entries without an error are fingerprinted from their level, namespace
 * and normalized message.
 *
 * Pure JavaScript (no Node built-ins). The result is a field, never a transport label.
 */
export function fingerprint(entry: BrowserLogEntry): string {
  const parts = entry.err
    ? [entry.err.name, normalizeMessage(entry.err.message), topFrame(entry.err.stack)]
    : [entry.level, entry.namespace ?? '', normalizeMessage(entry.msg ?? '')];

  return hash(parts.join('\n'));
}

/**
 * Replaces the variable parts of a message by placeholders.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/(["'`])(?:(?!\1).){0,256}\1/g, '<str>')
    .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\d+(\.\d+)?/g, '<n>')
    .trim();
}

/**
 * Returns the first stack frame (V8, SpiderMonkey and JavaScriptCore formats), with
 * the query string, hash and build hash of the file name removed.
 */
export function topFrame(stack: string | undefined): string {
  if (!stack) {
    return '';
  }

  for (const rawLine of stack.split('\n')) {
    const line = rawLine.trim();
    let frame: string | null = null;

    if (line.startsWith('at ')) {
      frame = line.slice(3);
    } else if (/^[^\s@]*@\S+:\d+/.test(line)) {
      frame = line;
    }

    if (frame !== null) {
      return frame.replace(/[?#][^:)\s]*/g, '').replace(/[-.][A-Za-z0-9_]{8}(\.m?js)/g, '$1');
    }
  }

  return '';
}

/**
 * cyrb53: fast, non-cryptographic 53-bit hash, returned as a hexadecimal string.
 */
function hash(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
