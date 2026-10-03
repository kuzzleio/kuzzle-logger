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
 * - when "maxBatchSize" entries are pending, or "flushInterval" after the first one,
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

  const sendBatch = async (): Promise<'dropped' | 'retry' | 'sent'> => {
    const entries = buffer.slice(0, maxBatchSize);
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
      let count = Math.min(maxBatchSize, entries.length);
      let batch: Batch = {
        dropped: droppedCount,
        entries: entries.slice(0, count),
        handedOver: false,
      };
      let size = byteLength(JSON.stringify(toPayload(batch)));

      // Smaller batches until it fits in what is left of the budget
      while (size > budget && count > 1) {
        count = Math.ceil(count / 2);
        batch = { ...batch, entries: entries.slice(0, count) };
        size = byteLength(JSON.stringify(toPayload(batch)));
      }

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

      push([entry], false);

      if (retrying) {
        return;
      }

      // The running batch loop sends it. The timer covers an entry pushed after the
      // loop's last check.
      if (inflight) {
        schedule(flushInterval);
        return;
      }

      if (!failing && (IMMEDIATE_LEVELS.has(entry.level) || buffer.length >= maxBatchSize)) {
        void flush();
      } else {
        schedule(flushInterval);
      }
    },
  };
}

function byteLength(value: string): number {
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(value).length : value.length;
}
