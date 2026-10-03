import { fingerprint } from '../protocol/fingerprint';
import { BROWSER_LOG_LEVELS, BrowserLogEntry, BrowserLogLevel } from '../protocol/payload';
import { SanitizeOptions, sanitize } from '../protocol/sanitize';
import { BatchLimits, RejectedEntry, validateBatch } from '../protocol/validateBatch';
import { JSONObject } from '../types/JSONObject';

/**
 * Logger the browser logs are forwarded to. Structurally typed:
 * a KuzzleLogger, or Kuzzle's "app.log", fits.
 */
export type BrowserLogsTargetLogger = {
  [level in BrowserLogLevel]: (obj: object, msg?: string) => void;
} & {
  child(namespace: string): BrowserLogsTargetLogger;
};

/**
 * The subset of a KuzzleRequest used by the controller (no runtime import of "kuzzle").
 */
export type BrowserLogsRequest = {
  context?: {
    connection?: {
      misc?: {
        headers?: JSONObject;
      };
    };
  };
  getKuid(): string | null;
  input: {
    body: unknown;
  };
};

export type BrowserLogsControllerOptions = {
  /**
   * Name of the action.
   * @default "push"
   */
  action?: string;
  /**
   * Client namespaces that can get their own child logger: a list, or a predicate.
   * Namespaces are checked after normalization (e.g. "MapView.vue" becomes
   * "MapView_vue"). Entries with other namespaces are logged under the base namespace,
   * with their namespace in the "clientNamespace" field. "maxNamespaces" still applies.
   *
   * Without it, the "maxNamespaces" slots are first come, first served: an anonymous
   * client can claim them all with junk namespaces.
   * @default every namespace
   */
  allowedNamespaces?: readonly string[] | ((namespace: string) => boolean);
  /**
   * Builds the error thrown for an invalid batch. Kuzzle only answers with the error
   * status when it is a KuzzleError, so pass `(message) => new BadRequestError(message)`
   * (from "kuzzle") to answer with a 400 instead of a 500.
   */
  badRequest?: (message: string) => Error;
  /**
   * HTTP route of the action. Kuzzle prefixes relative paths with "/_/".
   * `null` disables the HTTP route.
   * @default "browser-logs/_push" (i.e. POST /_/browser-logs/_push)
   */
  httpPath?: string | null;
  /**
   * Batch limits, see validateBatch.
   */
  limits?: BatchLimits;
  /**
   * Maximum number of distinct client namespaces appended to the server-side
   * namespace. Since the namespace can be a transport label (e.g. Loki), this bounds
   * the cardinality a client can create: entries with other namespaces are logged
   * under the base namespace, with their namespace in the "clientNamespace" field.
   * @default 50
   */
  maxNamespaces?: number;
  /**
   * Namespace of the child logger the entries are forwarded to.
   * @default "browser"
   */
  namespace?: string;
  /**
   * Sanitization options, see sanitize.
   */
  sanitize?: SanitizeOptions;
};

export type BrowserLogsPushResult = {
  accepted: number;
  rejected: RejectedEntry[];
};

/**
 * Structural equivalent of Kuzzle's ControllerDefinition.
 */
export type BrowserLogsControllerDefinition = {
  actions: {
    [action: string]: {
      handler: (request: BrowserLogsRequest) => Promise<BrowserLogsPushResult>;
      http?: { path: string; verb: 'post' }[];
    };
  };
};

const MAX_HEADER_LENGTH = 512;

/**
 * Creates a Kuzzle controller ingesting browser logs (payload v1) and forwarding them
 * through a child of the given logger, i.e. with its transports and labels.
 *
 * Every entry is validated, sanitized and enriched server-side: "source", "userId",
 * "userAgent", "origin", "clientTime" and "fingerprint". The client never sets labels.
 *
 * Rights: grant the action to the roles allowed to send browser logs, e.g.
 * `{ controllers: { 'browser-logs': { actions: { push: true } } } }`. Add it to the
 * "anonymous" role to accept logs from users who are not logged in, and rely on the
 * profiles rate limits to protect the backend.
 *
 * @example
 * import { BadRequestError } from 'kuzzle';
 * import { createBrowserLogsController } from 'kuzzle-logger/kuzzle';
 *
 * app.controller.register(
 *   'browser-logs',
 *   createBrowserLogsController(app.log, {
 *     badRequest: (message) => new BadRequestError(message),
 *   }),
 * );
 */
export function createBrowserLogsController(
  logger: BrowserLogsTargetLogger,
  options: BrowserLogsControllerOptions = {},
): BrowserLogsControllerDefinition {
  const baseLogger = logger.child(options.namespace ?? 'browser');
  const children = new Map<string, BrowserLogsTargetLogger>();
  const maxNamespaces = options.maxNamespaces ?? 50;
  const badRequest = options.badRequest ?? defaultBadRequest;
  const httpPath = options.httpPath === undefined ? 'browser-logs/_push' : options.httpPath;
  const isAllowed = allowedNamespacesPredicate(options.allowedNamespaces);
  const warnAccepted = (options.limits?.levels ?? BROWSER_LOG_LEVELS).includes('warn');

  const loggerFor = (namespace: string | undefined): BrowserLogsTargetLogger | null => {
    if (namespace === undefined) {
      return baseLogger;
    }

    let child = children.get(namespace);

    if (!child && children.size < maxNamespaces && isAllowed(namespace)) {
      child = baseLogger.child(namespace);
      children.set(namespace, child);
    }

    return child ?? null;
  };

  const handler = async (request: BrowserLogsRequest): Promise<BrowserLogsPushResult> => {
    const result = validateBatch(request.input.body, options.limits);

    if (result.valid === false) {
      throw badRequest(`Invalid browser logs batch: ${result.error}`);
    }

    const headers = request.context?.connection?.misc?.headers ?? {};
    const enrichment: JSONObject = { source: 'browser', userId: request.getKuid() };
    const userAgent = header(headers, 'user-agent');
    const origin = header(headers, 'origin');

    if (userAgent) {
      enrichment.userAgent = userAgent;
    }

    if (origin) {
      enrichment.origin = origin;
    }

    if (result.app) {
      enrichment.app = result.app;
    }

    const forward = (entry: BrowserLogEntry): void => {
      const target = loggerFor(entry.namespace);
      const log: JSONObject = { ...enrichment, fingerprint: fingerprint(entry) };

      if (entry.time !== undefined) {
        log.clientTime = entry.time;
      }

      if (entry.context) {
        log.context = entry.context;
      }

      if (entry.err) {
        log.err = entry.err;
      }

      if (target === null) {
        log.clientNamespace = entry.namespace;
      }

      (target ?? baseLogger)[entry.level](log, entry.msg ?? entry.err?.message);
    };

    const rejected = [...result.rejected];
    let accepted = 0;

    for (const [position, entry] of result.entries.entries()) {
      try {
        forward(sanitize(entry, options.sanitize));
        accepted++;
      } catch {
        rejected.push({
          index: originalIndex(position, result.rejected),
          reason: 'forwarding failed',
        });
      }
    }

    // The client counts entries dropped from its full buffer and in failed batches
    if (result.dropped && warnAccepted) {
      baseLogger.warn(
        { ...enrichment, dropped: result.dropped },
        `Browser lost ${result.dropped} log entries (buffer full or failed sends)`,
      );
    }

    rejected.sort((a, b) => a.index - b.index);

    return { accepted, rejected };
  };

  return {
    actions: {
      [options.action ?? 'push']: {
        handler,
        ...(httpPath === null ? {} : { http: [{ path: httpPath, verb: 'post' as const }] }),
      },
    },
  };
}

function allowedNamespacesPredicate(
  allowed: BrowserLogsControllerOptions['allowedNamespaces'],
): (namespace: string) => boolean {
  if (allowed === undefined) {
    return () => true;
  }

  if (typeof allowed === 'function') {
    return (namespace) => {
      try {
        return allowed(namespace) === true;
      } catch {
        return false;
      }
    };
  }

  const set = new Set(allowed);

  return (namespace) => set.has(namespace);
}

function defaultBadRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

function header(headers: JSONObject, name: string): string | undefined {
  const value = headers[name];

  return typeof value === 'string' ? value.slice(0, MAX_HEADER_LENGTH) : undefined;
}

/**
 * Index, in the payload, of the n-th valid entry.
 */
function originalIndex(position: number, rejected: RejectedEntry[]): number {
  let index = position;

  for (const { index: rejectedIndex } of [...rejected].sort((a, b) => a.index - b.index)) {
    if (rejectedIndex <= index) {
      index++;
    }
  }

  return index;
}
