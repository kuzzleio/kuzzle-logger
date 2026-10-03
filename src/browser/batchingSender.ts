import {
  BrowserLogEntry,
  BrowserLogsApp,
  BrowserLogsPayload,
  PAYLOAD_VERSION,
} from '../protocol/payload.js';
import {
  DEFAULT_MAX_MESSAGE_LENGTH,
  DEFAULT_MAX_STACK_LENGTH,
  truncate,
} from '../protocol/limits.js';
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
   * Maximum size of a batch, in bytes (JSON, UTF-8). Keep it below the backend
   * "maxPayloadSize" limit. A larger single entry is reduced to its level, time,
   * namespace, message and error (truncated), with "context: { truncated: true }",
   * and dropped if it still does not fit.
   * @default 60000
   */
  maxBatchBytes?: number;
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
 * Browsers cap the total body size of in-flight keepalive requests at 64 KiB.
 */
const KEEPALIVE_BUDGET = 60000;

type Batch = {
  dropped: number;
  entries: BrowserLogEntry[];
  /**
   * Set when the page is hidden: a keepalive request resent the batch, so a failure
   * of this request must not requeue it.
   */
  handedOver: boolean;
};

/**
 * Creates a sender that buffers entries and sends them in batches (payload v1):
 * - when a batch is full ("maxBatchSize", "maxBatchBytes"), or "flushInterval" after
 *   the first entry,
 * - immediately on "error" and "fatal" entries,
 * - with "keepalive" when the page is hidden ("pagehide", "visibilitychange"): all
 *   pending batches at once, including the one in flight (possible duplicates).
 *
 * Failed batches are retried with an exponential backoff. The sender never throws,
 * and never logs (no recursion through the logger it serves).
 */
export function createBatchingSender(
  transport: BatchTransport,
  options: BatchingOptions = {},
): BatchingSender {
  const maxBatchSize = Math.max(1, options.maxBatchSize ?? 20);
  const maxBatchBytes = options.maxBatchBytes ?? 60000;
  const maxBufferSize = Math.max(maxBatchSize, options.maxBufferSize ?? 500);
  const flushInterval = options.flushInterval ?? 5000;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 1000;

  let buffer: BrowserLogEntry[] = [];
  let dropped = 0;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retrying = false;
  // True after a dropped batch, until a batch is sent: immediate flushes are throttled
  // to flushInterval, so that an application logging each failed request at "error"
  // level does not start a request loop.
  let failing = false;
  let inflight: Promise<void> | null = null;
  let inflightBatch: Batch | null = null;
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

  const toPayload = ({ dropped: droppedCount, entries }: Batch): BrowserLogsPayload => {
    const payload: BrowserLogsPayload = { entries, version: PAYLOAD_VERSION };

    if (options.app) {
      payload.app = options.app;
    }

    if (droppedCount > 0) {
      payload.dropped = droppedCount;
    }

    return payload;
  };

  // Largest envelope (app, dropped) of a payload: what is left is for the entries
  const maxEntryBytes =
    maxBatchBytes -
    byteLength(JSON.stringify(toPayload({ dropped: 1e15, entries: [], handedOver: false })));

  /**
   * Number of entries, from the start of "entries", fitting in a batch of maxBytes.
   * At least one: entries larger than a batch are reduced by send().
   */
  const batchLength = (entries: BrowserLogEntry[], maxBytes: number): number => {
    let size = 0;
    let count = 0;

    while (count < Math.min(maxBatchSize, entries.length)) {
      // +1 for the comma between entries
      size += entrySize(entries[count]) + 1;

      if (size > maxBytes && count > 0) {
        break;
      }

      count++;
    }

    return count;
  };

  const sendBatch = async (): Promise<'dropped' | 'retry' | 'sent'> => {
    const entries = buffer.slice(0, batchLength(buffer, maxEntryBytes));
    const droppedBefore = dropped;
    const batch: Batch = { dropped, entries, handedOver: false };

    buffer = buffer.slice(entries.length);
    dropped = 0;
    inflightBatch = batch;

    try {
      await transport(toPayload(batch), { keepalive: false });
      attempt = 0;
      failing = false;

      return 'sent';
    } catch (error) {
      if (batch.handedOver) {
        return 'sent';
      }

      if (error instanceof NonRetryableError || attempt >= maxRetries) {
        attempt = 0;
        failing = true;
        dropped += droppedBefore + entries.length;

        return 'dropped';
      }

      attempt++;
      dropped += droppedBefore;
      push(entries, true);

      return 'retry';
    } finally {
      inflightBatch = null;
    }
  };

  const run = async () => {
    while (buffer.length > 0 || dropped > 0) {
      const outcome = await sendBatch();

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

  const flush = async (): Promise<void> => {
    if (retrying) {
      return;
    }

    clearTimer();

    while (inflight) {
      await inflight;
    }

    if (buffer.length === 0 && dropped === 0) {
      return;
    }

    // Set before run() reaches the transport: a transport that logs synchronously
    // must not start a second run (re-entrant flush)
    let done = () => {};
    const current = new Promise<void>((resolve) => {
      done = resolve;
    });

    inflight = current;
    void run()
      .catch(() => {})
      .finally(() => {
        inflight = null;
        done();
      });

    await current;
  };

  const sendKeepalive = (batch: Batch) => {
    // The page may still be alive (visibilitychange): failed entries are sent later
    const onFailure = (error: unknown) => {
      if (error instanceof NonRetryableError) {
        dropped += batch.dropped + batch.entries.length;
      } else {
        dropped += batch.dropped;
        push(batch.entries, true);
      }

      schedule(flushInterval);
    };

    try {
      transport(toPayload(batch), { keepalive: true }).catch(onFailure);
    } catch (error) {
      onFailure(error);
    }
  };

  /**
   * Sends every pending entry synchronously, without waiting for the request in
   * flight: once the page is unloaded, it never completes. The batch in flight is
   * resent, so it can be received twice.
   */
  const onHide = () => {
    clearTimer();
    retrying = false;
    attempt = 0;

    let entries = buffer;
    let droppedCount = dropped;

    if (inflightBatch && !inflightBatch.handedOver) {
      inflightBatch.handedOver = true;
      entries = [...inflightBatch.entries, ...entries];
      droppedCount += inflightBatch.dropped;
    }

    buffer = [];
    dropped = 0;

    let budget = KEEPALIVE_BUDGET;

    while (entries.length > 0 || droppedCount > 0) {
      const count = batchLength(entries, Math.min(maxEntryBytes, budget));
      const batch: Batch = {
        dropped: droppedCount,
        entries: entries.slice(0, count),
        handedOver: false,
      };
      const size = byteLength(JSON.stringify(toPayload(batch)));

      if (size > budget) {
        break;
      }

      budget -= size;
      entries = entries.slice(count);
      droppedCount = 0;
      sendKeepalive(batch);
    }

    // Over the keepalive budget: sent by the next flush, if the page is still alive
    if (entries.length > 0 || droppedCount > 0) {
      dropped += droppedCount;
      push(entries, true);
      schedule(flushInterval);
    }
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
    flush,
    send: (entry: BrowserLogEntry) => {
      if (closed) {
        return;
      }

      let fitting = entry;

      if (entrySize(entry) > maxEntryBytes) {
        fitting = reduce(entry);

        if (entrySize(fitting) > maxEntryBytes) {
          dropped++;
          return;
        }
      }

      push([fitting], false);

      if (retrying) {
        return;
      }

      // The running batch loop sends it. The timer covers an entry pushed after the
      // loop's last check.
      if (inflight) {
        schedule(flushInterval);
        return;
      }

      const full =
        buffer.length >= maxBatchSize || batchLength(buffer, maxEntryBytes) < buffer.length;

      if (!failing && (IMMEDIATE_LEVELS.has(entry.level) || full)) {
        void flush();
      } else {
        schedule(flushInterval);
      }
    },
  };
}

const entrySizes = new WeakMap<BrowserLogEntry, number>();

/**
 * Size of an entry in a payload, in bytes. Cached: entries are immutable once sent.
 */
function entrySize(entry: BrowserLogEntry): number {
  let size = entrySizes.get(entry);

  if (size === undefined) {
    size = byteLength(JSON.stringify(entry));
    entrySizes.set(entry, size);
  }

  return size;
}

/**
 * Reduces an entry too large for a batch to its level, time, namespace, message and
 * error (truncated to the backend limits).
 */
function reduce(entry: BrowserLogEntry): BrowserLogEntry {
  const reduced: BrowserLogEntry = { context: { truncated: true }, level: entry.level };

  if (entry.time !== undefined) {
    reduced.time = entry.time;
  }

  if (entry.namespace !== undefined) {
    reduced.namespace = entry.namespace;
  }

  if (entry.msg !== undefined) {
    reduced.msg = truncate(entry.msg, DEFAULT_MAX_MESSAGE_LENGTH);
  }

  if (entry.err) {
    reduced.err = {
      message: truncate(String(entry.err.message), DEFAULT_MAX_MESSAGE_LENGTH),
      name: String(entry.err.name),
    };

    if (typeof entry.err.stack === 'string') {
      reduced.err.stack = truncate(entry.err.stack, DEFAULT_MAX_STACK_LENGTH);
    }
  }

  return reduced;
}

function byteLength(value: string): number {
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(value).length : value.length;
}
