---
code: false
type: page
title: Browser logging
description: Log from a frontend application to its Kuzzle backend
order: 600
---

# Browser Logging

`kuzzle-logger/browser` is a logger for frontend applications, with the same API as the Node logger. It prints entries to the devtools console and sends them, in batches, to the application's Kuzzle backend. The backend then writes them with its own logger, so browser logs end up in the same place as backend logs (stdout, Loki, Elasticsearch...).

```
Browser                         Kuzzle backend                        Transports
KuzzleLogger ── batches ──▶ browser-logs:push ──▶ app.log.child('browser') ──▶ Loki, ...
```

The browser never holds credentials for the log storage, and it cannot set labels: the backend validates, sanitizes and enriches every entry. See [Ingesting browser logs in Kuzzle](/modules/logger/1/guides/browser-logs-ingestion) for the backend side.

::: info
The browser entry point is an ES module (`dist/esm`), meant to be used with a bundler such as Vite or webpack. It has no Node dependency.
:::

## Installation

```bash
npm install kuzzle-logger
```

## Creating the logger

```typescript
import { KuzzleLogger, createKuzzleSender } from 'kuzzle-logger/browser';
import { Kuzzle, WebSocket } from 'kuzzle-sdk';

const sdk = new Kuzzle(new WebSocket('api.example.com', { port: 443, ssl: true }));

await sdk.connect();

export const logger = new KuzzleLogger({
  console: import.meta.env.DEV ? true : 'warn',
  level: 'info',
  namespace: 'dashboard',
  sender: createKuzzleSender(sdk, {
    app: { name: 'dashboard', version: '1.2.0' },
  }),
});
```

| Option             | Default | Description                                                                                                                                                                 |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `level`            | `info`  | Minimum level of the logged entries: `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent`. It can be changed at runtime with `logger.level = 'debug'`.            |
| `console`          | `true`  | Prints entries to the devtools console: `true` for every logged entry, `false` for none, or a level (entries at or above it). Only entries at or above `level` are printed. |
| `namespace`        | –       | Base namespace of the entries.                                                                                                                                              |
| `getMergingObject` | –       | Called on each log: its result is merged into the entry `context` (e.g. the current route).                                                                                 |
| `sender`           | –       | Where entries are sent. Without a sender, the logger only prints to the console.                                                                                            |

## Logging

The API is the same as the [Node logger](/modules/logger/1/api/kuzzle-logger):

```typescript
logger.info('Dashboard loaded');
logger.debug({ assetId, duration }, 'Asset %s loaded', assetId);

try {
  await loadMap();
} catch (error) {
  logger.error(error, 'Failed to load the map');
  // or: logger.error({ err: error, mapId }, 'Failed to load the map');
}

const mapLogger = logger.child('map'); // namespace: "dashboard:map"
mapLogger.warn('No asset to display');
```

- Namespaces may only contain letters, digits, `:`, `_` and `-`, up to 64 characters in total (with the parent namespaces): the backend rejects the other entries. Keep them static, e.g. `map`, not `MapView.vue` or `map-${mapId}`.
- Unlike `console.log`, extra arguments are only used for `%s`/`%d`/`%o` placeholders in the message: `logger.info('Loaded', data)` drops `data`. Write `logger.info({ data }, 'Loaded')`.
- A child logger keeps the level it had when it was created: set `logger.level` before creating children.

Errors are serialized with their name, message, stack, cause and custom properties. Each entry is sent with this shape (payload v1):

```json
{
  "level": "error",
  "time": 1759312800000,
  "namespace": "dashboard:map",
  "msg": "Failed to load the map",
  "context": { "mapId": "site-42" },
  "err": {
    "name": "TypeError",
    "message": "x is undefined",
    "stack": "TypeError: x is undefined\n    at ..."
  }
}
```

Logging never throws, even when the sender fails.

## Senders

Senders buffer entries and send them in batches:

- when `maxBatchSize` entries are pending, or `flushInterval` after the first one;
- immediately for `error` and `fatal` entries;
- when the page is hidden or closed (`pagehide`, `visibilitychange`), with `fetch` `keepalive`.

Failed batches are retried with an exponential backoff. Rejected batches (4xx responses, except 408 and 429) are not retried. Senders never log, so a failing backend cannot cause a logging loop.

### Kuzzle SDK sender

`createKuzzleSender(sdk, options?)` sends batches with an existing SDK instance (`sdk.query`), so requests are authenticated as the logged-in user, over WebSocket or HTTP.

| Option         | Default        | Description                                                                                                                                                                                                                               |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controller`   | `browser-logs` | Controller the ingestion controller is registered under.                                                                                                                                                                                  |
| `action`       | `push`         | Action name.                                                                                                                                                                                                                              |
| `keepaliveUrl` | –              | HTTP route of the action, e.g. `https://api.example.com/_/browser-logs/_push`. When set, batches sent while the page is hidden use `fetch` with `keepalive` and the SDK token, since a WebSocket request may not survive the page unload. |

### HTTP sender

`createHttpSender(options?)` posts batches with `fetch`. Use it when the frontend has no SDK instance.

| Option    | Default                 | Description                                                                                                                                                                             |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`     | `/_/browser-logs/_push` | Endpoint receiving the batches (the Kuzzle HTTP route, on the same origin).                                                                                                             |
| `headers` | –                       | Extra headers, or a function returning them for each request (e.g. ``() => ({ Authorization: `Bearer ${getToken()}` })``). Without an `Authorization` header, the request is anonymous. |

### Batching options

Both senders accept these options:

| Option          | Default | Description                                                                                                                 |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app`           | –       | `{ name, version }` of the frontend, sent with each batch. Informational.                                                   |
| `flushInterval` | `5000`  | Delay before sending a batch that is not full, in milliseconds.                                                             |
| `maxBatchSize`  | `20`    | Maximum number of entries per batch. Keep it below the backend `limits.maxEntries` (100 by default).                        |
| `maxBufferSize` | `500`   | Maximum number of entries kept in memory. The oldest entries are dropped first, and the backend logs how many were dropped. |
| `maxRetries`    | `3`     | Retries of a failed batch before it is dropped.                                                                             |
| `retryDelay`    | `1000`  | First retry delay, in milliseconds. It doubles at each attempt, up to 60 seconds.                                           |

`await logger.flush()` sends the pending entries. `sender.close()` stops the timers and removes the page listeners, without sending the pending entries (call `flush()` first).

## Capturing uncaught errors

Errors should be logged where they are handled. Two opt-in helpers also capture the errors nobody handled.

### Global errors

`captureGlobalErrors(logger, options?)` logs `window` `error` events (uncaught exceptions) and `unhandledrejection` events (rejected promises nobody awaited) at the `error` level. It returns a function that removes the listeners.

```typescript
import { captureGlobalErrors } from 'kuzzle-logger/browser';

const stop = captureGlobalErrors(logger.child('global'));
```

- Each entry has an `event` context field (`error` or `unhandledrejection`), and the error `location` (`file`, `line`, `column`) for uncaught exceptions. A rejected value that is not an error is logged in the `reason` field.
- Identical errors received within `dedupeInterval` milliseconds (5000 by default) are logged once, so an error thrown in a loop or a timer does not flood the backend.
- The events are not cancelled: the browser still prints them to the console, and the logger does not print them a second time.
- Errors thrown by scripts from another origin only give `Script error.`, without a stack. Serve the scripts with CORS headers and the `crossorigin` attribute to get the details.

### Vue error handler

`createVueErrorHandler(logger)` returns a handler for `app.config.errorHandler` (Vue 3) or `Vue.config.errorHandler` (Vue 2). It logs the error with the component name (`component`) and the Vue `info` string (`render function`, `setup function`, `watcher callback`...). It does not depend on `vue`.

```typescript
import { createApp } from 'vue';
import { captureGlobalErrors, createVueErrorHandler } from 'kuzzle-logger/browser';

import App from './App.vue';
import { logger } from './logger';

const app = createApp(App);

app.config.errorHandler = createVueErrorHandler(logger.child('vue'));
captureGlobalErrors(logger.child('global'));

app.mount('#app');
```

Vue stops printing errors once an error handler is set: the handler prints them with `console.error`, as Vue does in production, whatever the logger `console` option.

## Privacy

Browser logs are sent to your backend and stored with your other logs. Do not log personal data or secrets. The backend redacts the values of sensitive keys (`password`, `token`, `authorization`...) and tokens found in strings, but it cannot detect everything.
