/**
 * Browser entry point: "kuzzle-logger/browser".
 *
 * ESM only. It must not import Node built-ins, pino transports, or any module
 * outside src/browser, src/protocol and src/types.
 */
export { BROWSER_LOG_LEVELS, PAYLOAD_VERSION } from '../protocol/payload.js';
export type {
  BrowserLogEntry,
  BrowserLogError,
  BrowserLogLevel,
  BrowserLogsApp,
  BrowserLogsPayload,
} from '../protocol/payload.js';
