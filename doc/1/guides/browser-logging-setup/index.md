---
code: false
type: page
title: Set up browser logging
description: Step-by-step setup of browser logging in a Kuzzle application with a Vue frontend
order: 500
---

# Set Up Browser Logging

This guide walks through a typical setup: a Kuzzle application (the backend) and a Vue frontend that talks to it with the Kuzzle SDK. At the end, frontend logs and uncaught errors are written by the backend, next to its own logs (stdout, Loki...).

```
Frontend (kuzzle-logger/browser) ── browser-logs:push ──▶ Backend (kuzzle-logger/kuzzle) ──▶ app.log transports
```

You need `kuzzle-logger` 1.5.0 or later, installed in both the backend and the frontend.

## 1. Register the controller in the backend

```bash
npm install kuzzle-logger
```

```typescript
// app.ts
import { Backend, BadRequestError } from 'kuzzle';
import { createBrowserLogsController } from 'kuzzle-logger/kuzzle';

const app = new Backend('my-app');

app.controller.register(
  'browser-logs',
  createBrowserLogsController(app.log, {
    // Without it, an invalid batch gets a 500 instead of a 400, and the browser retries it
    badRequest: (message) => new BadRequestError(message),
  }),
);
```

This adds the `browser-logs:push` action and its `POST /_/browser-logs/_push` HTTP route. The defaults are fine for most applications: see [Ingesting browser logs in Kuzzle](/modules/logger/1/guides/browser-logs-ingestion) for the limits, sanitization and options.

## 2. Grant the action

Add the action to the roles of the users who run the frontend:

```json
{
  "controllers": {
    "browser-logs": {
      "actions": {
        "push": true
      }
    }
  }
}
```

To also receive the errors raised before login (a login page that fails to load, an expired session), add it to the `anonymous` role and set a `rateLimit` on the `anonymous` profile. Read [Anonymous users](/modules/logger/1/guides/browser-logs-ingestion#anonymous-users) first.

## 3. Create the frontend logger

```bash
npm install kuzzle-logger
```

Create the logger once, in its own module, next to the SDK instance:

```javascript
// src/plugins/logger.js
import {
  KuzzleLogger,
  captureGlobalErrors,
  createKuzzleSender,
  createVueErrorHandler,
} from 'kuzzle-logger/browser';

import { name, version } from '../../package.json';
import { kuzzle } from './kuzzle'; // your Kuzzle SDK instance

export const logger = new KuzzleLogger({
  // Everything in the devtools console in development, warnings and errors in production
  console: import.meta.env.DEV ? true : 'warn',
  level: 'info',
  namespace: 'web',
  sender: createKuzzleSender(kuzzle, {
    app: { name, version },
    // HTTP route of the action: batches sent while the page closes use fetch + keepalive
    keepaliveUrl: 'https://api.example.com/_/browser-logs/_push',
  }),
});

export function captureErrors(app) {
  captureGlobalErrors(logger.child('global'));
  app.config.errorHandler = createVueErrorHandler(logger.child('vue'));
}
```

- `createKuzzleSender` uses the SDK: requests are authenticated as the logged-in user, and anonymous before login.
- `keepaliveUrl` is optional but recommended: without it, the entries logged just before the page closes may be lost.
- Without a Kuzzle SDK in the frontend, use `createHttpSender` instead (see [HTTP sender](/modules/logger/1/guides/browser-logging#http-sender)).

## 4. Capture uncaught errors

Call `captureErrors` before the other plugins are registered, so that their errors are captured too:

```javascript
// src/main.js
import { createApp } from 'vue';

import App from './App.vue';
import { captureErrors } from './plugins/logger';

const app = createApp(App);

captureErrors(app);

// app.use(router), app.use(pinia)...
app.mount('#app');
```

Then log where errors are handled, as you would with `console`:

```javascript
import { logger } from '@/plugins/logger';

const mapLogger = logger.child('map'); // namespace "web:map"

try {
  await loadMap(mapId);
} catch (error) {
  mapLogger.error({ err: error, mapId }, 'Failed to load the map');
}
```

Do not log personal data or secrets: see [Privacy](/modules/logger/1/guides/browser-logging#privacy).

## 5. Allow the requests

If the frontend is served with a Content Security Policy, its `connect-src` directive must include the backend origin, for both the WebSocket (`wss://api.example.com`) and the `keepaliveUrl` (`https://api.example.com`).

When the frontend and the backend have different origins, the `keepaliveUrl` request is a cross-origin request. Kuzzle accepts any origin by default: if you restricted `http.accessControlAllowOrigin`, it must include the frontend origin.

## 6. Check that it works

Send a test batch with [Kourou](https://github.com/kuzzleio/kourou), with the credentials of a user allowed to call the action:

```bash
kourou browser-logs:push --body '{
  "version": 1,
  "entries": [{ "level": "error", "msg": "Browser logging test", "namespace": "test" }]
}'
```

The response is `{ "accepted": 1, "rejected": [] }`, and the backend logs the entry under the `browser:test` namespace, with `source: "browser"`.

Then open the frontend, run `logger.error('Hello from the browser')` from your code, and find it with the backend logs. With Loki:

```
{service_name="my-app"} | json | source="browser"
```

See [Grafana dashboards](/modules/logger/1/guides/grafana-dashboards#browser-logs-in-loki) for more queries and a ready-made dashboard.

## Troubleshooting

| Symptom                                                         | Cause                                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `403` on `browser-logs:push`                                    | The user's roles do not grant the action, or the user is anonymous and the `anonymous` role does not grant it.                                                              |
| `500` on an invalid batch, and the browser keeps retrying it    | The `badRequest` option is missing in `createBrowserLogsController`.                                                                                                        |
| Entries in the devtools console, but nothing in the backend     | No `sender`, a `level` above the logged entries, or blocked requests (CSP `connect-src`, network tab).                                                                      |
| Entries in the backend stdout, but not in Loki or Elasticsearch | The backend logger transport: check `server.appLogs` in the Kuzzle configuration (see [Getting started](/modules/logger/1/guides/getting-started#in-a-kuzzle-application)). |
| Uncaught errors logged as `Script error.`, without a stack      | The script comes from another origin: serve it with CORS headers and the `crossorigin` attribute.                                                                           |
| Entries logged just before a navigation are lost                | Set `keepaliveUrl` on the Kuzzle sender.                                                                                                                                    |
| Entries logged under `browser`, with a `clientNamespace` field  | More than `maxNamespaces` (50) distinct namespaces: keep namespaces static (no IDs in them).                                                                                |
