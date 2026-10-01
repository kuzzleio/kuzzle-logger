import { BrowserLogsPayload } from '../protocol/payload.js';
import {
  BatchingOptions,
  BatchingSender,
  NonRetryableError,
  TransportOptions,
  createBatchingSender,
} from './batchingSender.js';

export type HttpSenderOptions = BatchingOptions & {
  /**
   * Extra request headers (e.g. "Authorization"), or a function returning them for
   * each request.
   */
  headers?: Record<string, string> | (() => Record<string, string>);
  /**
   * Endpoint receiving the batches.
   * @default "/_/browser-logs/_push" (the Kuzzle HTTP route, on the same origin)
   */
  url?: string;
};

/**
 * Structural subset of a Kuzzle SDK instance (no dependency on "kuzzle-sdk").
 */
export type KuzzleSdkLike = {
  /**
   * Authentication token, sent with keepalive requests (see "keepaliveUrl").
   */
  jwt?: string | null;
  query(request: {
    action: string;
    body: BrowserLogsPayload;
    controller: string;
  }): Promise<unknown>;
};

export type KuzzleSenderOptions = BatchingOptions & {
  /**
   * @default "push"
   */
  action?: string;
  /**
   * @default "browser-logs"
   */
  controller?: string;
  /**
   * HTTP route of the action (e.g. "https://api.example.com/_/browser-logs/_push").
   * When set, batches sent while the page is hidden use fetch with "keepalive" and
   * the SDK token, since an SDK request may not survive the page unload.
   */
  keepaliveUrl?: string;
};

/**
 * Batching sender posting payloads with fetch.
 * 4xx responses (except 408 and 429) are not retried.
 */
export function createHttpSender(options: HttpSenderOptions = {}): BatchingSender {
  const url = options.url ?? '/_/browser-logs/_push';

  return createBatchingSender(
    (payload, transportOptions) =>
      post(url, payload, transportOptions, resolveHeaders(options.headers)),
    options,
  );
}

/**
 * Batching sender using an existing Kuzzle SDK instance ("sdk.query"), which sends
 * the SDK authentication token.
 */
export function createKuzzleSender(
  sdk: KuzzleSdkLike,
  options: KuzzleSenderOptions = {},
): BatchingSender {
  const controller = options.controller ?? 'browser-logs';
  const action = options.action ?? 'push';

  return createBatchingSender(async (payload, transportOptions) => {
    if (transportOptions.keepalive && options.keepaliveUrl) {
      const headers: Record<string, string> = sdk.jwt ? { Authorization: `Bearer ${sdk.jwt}` } : {};

      return post(options.keepaliveUrl, payload, transportOptions, headers);
    }

    try {
      await sdk.query({ action, body: payload, controller });
    } catch (error) {
      const status = (error as { status?: unknown })?.status;

      if (typeof status === 'number' && !isRetryableStatus(status)) {
        throw new NonRetryableError(`browser logs rejected (${status})`);
      }

      throw error;
    }
  }, options);
}

async function post(
  url: string,
  payload: BrowserLogsPayload,
  { keepalive }: TransportOptions,
  headers: Record<string, string>,
): Promise<void> {
  const response = await fetch(url, {
    body: JSON.stringify(payload),
    headers: { ...headers, 'Content-Type': 'application/json' },
    keepalive,
    method: 'POST',
  });

  if (!response.ok) {
    const message = `browser logs rejected (${response.status})`;

    throw isRetryableStatus(response.status) ? new Error(message) : new NonRetryableError(message);
  }
}

function resolveHeaders(headers: HttpSenderOptions['headers']): Record<string, string> {
  try {
    return (typeof headers === 'function' ? headers() : headers) ?? {};
  } catch {
    return {};
  }
}

function isRetryableStatus(status: number): boolean {
  return status < 400 || status >= 500 || status === 408 || status === 429;
}
