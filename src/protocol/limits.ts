// Internal: shared by validateBatch and the browser senders, not exported by the protocol entry.

/**
 * Default maximum length of "msg" and "err.message".
 */
export const DEFAULT_MAX_MESSAGE_LENGTH = 2048;

/**
 * Default maximum length of "err.stack".
 */
export const DEFAULT_MAX_STACK_LENGTH = 8192;

const TRUNCATED_SUFFIX = '…[truncated]';

/**
 * Truncates a string to maxLength characters, suffix included.
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, Math.max(0, maxLength - TRUNCATED_SUFFIX.length)) + TRUNCATED_SUFFIX;
}
