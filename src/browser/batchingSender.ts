import {
  BrowserLogEntry,
  BrowserLogsApp,
  BrowserLogsPayload,
  PAYLOAD_VERSION,
} from '../protocol/payload.js';
import { BrowserLogSender } from './KuzzleLogger.js';

export type TransportOptions = {
  /**
   * True when the page is being hidden or unloaded: the request must survive it
   * (e.g. fetch with "keepalive").
   */
  keepalive: boolean;
};

/**
 * Sends one batch. It rejects on failure: wrap the error in a NonRetryableError
 * when retrying is pointless (e.g. 400, 403).
 */
export type BatchTransport = (
  payload: BrowserLogsPayload,
  options: TransportOptions,
) => Promise<void>;

export type BatchingOptions = {
  /**
   * Informational description of the application, sent with each batch.
   */
  app?: BrowserLogsApp;
  /**
   * Delay before sending a non-full batch, in milliseconds.
   * @default 5000
   */
  flushInterval?: number;
  /**
   * Maximum number of entries per batch.
   * @default 20
   */
  maxBatchSize?: number;
  /**
   * Maximum number of entries kept in memory. Oldest entries are dropped first, and
   * the number of dropped entries is sent with the next batch.
   * @default 500
   */
  maxBufferSize?: number;
  /**
   * Retries of a failed batch before it is dropped.
   * @default 3
   */
  maxRetries?: number;
  /**
   * First retry delay, in milliseconds. It doubles at each attempt (max 60 s).
   * @default 1000
   */
  retryDelay?: number;
};

export type BatchingSender = BrowserLogSender & {
  /**
   * Stops the timers and removes the page lifecycle listeners. Pending entries are
   * not sent: call flush() first.
   */
  close(): void;
  flush(): Promise<void>;
};

/**
 * A transport failure that must not be retried.
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

const IMMEDIATE_LEVELS = new Set(['error', 'fatal']);

const MAX_RETRY_DELAY = 60000;

/**
 * Creates a sender that buffers entries and sends them in batches (payload v1):
 * - when "maxBatchSize" entries are pending, or "flushInterval" after the first one,
 * - immediately on "error" and "fatal" entries,
 * - with "keepalive" when the page is hidden ("pagehide", "visibilitychange").
 *
 * Failed batches are retried with an exponential backoff. The sender never throws,
 * and never logs (no recursion through the logger it serves).
 */
export function createBatchingSender(
  transport: BatchTransport,
  options: BatchingOptions = {},
): BatchingSender {
  const maxBatchSize = Math.max(1, options.maxBatchSize ?? 20);
  const maxBufferSize = Math.max(maxBatchSize, options.maxBufferSize ?? 500);
  const flushInterval = options.flushInterval ?? 5000;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 1000;

  let buffer: BrowserLogEntry[] = [];
  let dropped = 0;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retrying = false;
  let inflight: Promise<void> | null = null;
  let closed = false;

  const push = (entries: BrowserLogEntry[], front: boolean) => {
    buffer = front ? [...entries, ...buffer] : [...buffer, ...entries];

    if (buffer.length > maxBufferSize) {
      dropped += buffer.length - maxBufferSize;
      buffer = buffer.slice(buffer.length - maxBufferSize);
    }
  };

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (delay: number) => {
    if (timer === null && !closed) {
      timer = setTimeout(() => {
        timer = null;
        retrying = false;
        void flush();
      }, delay);
    }
  };

  const sendBatch = async (keepalive: boolean): Promise<'dropped' | 'retry' | 'sent'> => {
    const entries = buffer.slice(0, maxBatchSize);
    buffer = buffer.slice(entries.length);

    const payload: BrowserLogsPayload = { entries, version: PAYLOAD_VERSION };
    const droppedBefore = dropped;

    if (options.app) {
      payload.app = options.app;
    }

    if (dropped > 0) {
      payload.dropped = dropped;
      dropped = 0;
    }

    try {
      await transport(payload, { keepalive });
      attempt = 0;

      return 'sent';
    } catch (error) {
      if (error instanceof NonRetryableError || attempt >= maxRetries) {
        attempt = 0;
        dropped += droppedBefore + entries.length;

        return 'dropped';
      }

      attempt++;
      dropped += droppedBefore;
      push(entries, true);

      return 'retry';
    }
  };

  const run = async (keepalive: boolean) => {
    while (buffer.length > 0 || dropped > 0) {
      const outcome = await sendBatch(keepalive);

      if (outcome === 'retry') {
        retrying = true;
        clearTimer();
        schedule(Math.min(retryDelay * 2 ** (attempt - 1), MAX_RETRY_DELAY));

        return;
      }

      // The transport keeps failing: the remaining entries wait for the next trigger
      if (outcome === 'dropped') {
        if (buffer.length > 0) {
          schedule(flushInterval);
        }

        return;
      }
    }
  };

  const flush = async (keepalive = false): Promise<void> => {
    if (!keepalive && retrying) {
      return;
    }

    clearTimer();

    while (inflight) {
      await inflight;
    }

    if (buffer.length === 0 && dropped === 0) {
      return;
    }

    inflight = run(keepalive)
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });

    await inflight;
  };

  const onHide = () => {
    retrying = false;
    void flush(true);
  };
  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      onHide();
    }
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', onHide);
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return {
    close: () => {
      closed = true;
      clearTimer();

      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('pagehide', onHide);
      }

      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    },
    flush: () => flush(false),
    send: (entry: BrowserLogEntry) => {
      if (closed) {
        return;
      }

      push([entry], false);

      if (retrying) {
        return;
      }

      if (IMMEDIATE_LEVELS.has(entry.level) || buffer.length >= maxBatchSize) {
        void flush();
      } else {
        schedule(flushInterval);
      }
    },
  };
}
