---
code: false
type: page
title: Ingesting browser logs in Kuzzle
description: Receive browser logs in a Kuzzle application and forward them to its logger
order: 700
---

# Ingesting Browser Logs in Kuzzle

`kuzzle-logger/kuzzle` provides `createBrowserLogsController`, a Kuzzle controller that receives the batches sent by the [browser logger](/modules/logger/1/guides/browser-logging). It validates, sanitizes and enriches each entry, then writes it with a child of the application logger: browser logs use the backend transports and labels (stdout, Loki, Elasticsearch...), with no extra configuration.

## Registering the controller

```typescript
import { Backend, BadRequestError } from 'kuzzle';
import { createBrowserLogsController } from 'kuzzle-logger/kuzzle';

const app = new Backend('my-app');

app.controller.register(
  'browser-logs',
  createBrowserLogsController(app.log, {
    badRequest: (message) => new BadRequestError(message),
  }),
);
```

This registers the `browser-logs:push` action, with the `POST /_/browser-logs/_push` HTTP route. The default controller and route names match the defaults of the browser senders.

::: warning
Pass the `badRequest` option. Kuzzle only answers with the status of the error when the error is a `KuzzleError`: without `badRequest`, an invalid batch gets a `500` instead of a `400`, and the browser retries it.
:::

| Option          | Default                           | Description                                                                                          |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `badRequest`    | –                                 | Builds the error thrown for an invalid batch: `(message) => new BadRequestError(message)`.           |
| `namespace`     | `browser`                         | Namespace of the child logger the entries are written with.                                          |
| `maxNamespaces` | `50`                              | Maximum number of distinct client namespaces (see [Namespaces](#namespaces)).                        |
| `limits`        | see [Limits](#limits)             | Batch limits.                                                                                        |
| `sanitize`      | see [Sanitization](#sanitization) | Sanitization options.                                                                                |
| `action`        | `push`                            | Action name.                                                                                         |
| `httpPath`      | `browser-logs/_push`              | HTTP route of the action. Kuzzle prefixes relative paths with `/_/`. `null` disables the HTTP route. |

The action returns the number of accepted entries and the rejected ones, with their position in the batch:

```json
{
  "accepted": 19,
  "rejected": [{ "index": 4, "reason": "\"context\" must be a plain JSON object" }]
}
```

An invalid batch (wrong version, too many entries, payload too large...) is rejected as a whole. An invalid entry only rejects that entry. Some values are normalized instead of being rejected: long strings are truncated, objects deeper than `maxContextDepth` are replaced with `"[Truncated]"`, and invalid namespace characters are replaced with `_` (namespaces are truncated to 64 characters).

## Rights

Grant the action to the roles allowed to send browser logs:

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

### Anonymous users

Browser logs are most useful before login too: a login page that fails to load is exactly what you want to know about. To accept them, add the action to the `anonymous` role.

This means anyone who can reach the backend can write logs. Before you do it:

- set a `rateLimit` on the profiles holding this role, and in particular on the `anonymous` profile;
- keep the [limits](#limits) tight;
- remember that anonymous entries are unauthenticated input: `userId` is `-1`, and `context`, `msg` and `namespace` can contain anything.

If your application has no public page, grant the action to authenticated profiles only.

## What is logged

Each entry is written at its own level, with its message (or the error message), and these fields:

| Field                 | Set by  | Description                                                                  |
| --------------------- | ------- | ---------------------------------------------------------------------------- |
| `source`              | server  | Always `browser`.                                                            |
| `userId`              | server  | `kuid` of the user who sent the batch.                                       |
| `userAgent`, `origin` | server  | Request headers, when available (truncated to 512 characters).               |
| `app`                 | browser | `{ name, version }` of the frontend, when the sender sets it. Informational. |
| `fingerprint`         | server  | Hash grouping identical errors (see below).                                  |
| `clientTime`          | browser | Browser clock, in milliseconds. The log time is the server time.             |
| `context`             | browser | Context of the entry.                                                        |
| `err`                 | browser | Serialized error: `name`, `message`, `stack`, `cause` and custom properties. |
| `clientNamespace`     | browser | Namespace of the entry, when the namespace limit is reached.                 |

```json
{
  "level": "error",
  "namespace": "browser:dashboard:map",
  "msg": "Failed to load the map",
  "source": "browser",
  "userId": "kuid-42",
  "userAgent": "Mozilla/5.0 ...",
  "origin": "https://dashboard.example.com",
  "app": { "name": "dashboard", "version": "1.2.0" },
  "fingerprint": "0a3f9c2e81b4d7",
  "clientTime": 1759312800000,
  "context": { "mapId": "site-42" },
  "err": {
    "name": "TypeError",
    "message": "x is undefined",
    "stack": "TypeError: x is undefined\n    at ..."
  }
}
```

The browser cannot set any other field: everything it sends is nested under `context` and `err`, so it cannot override `source`, `userId` or transport labels.

### Fingerprint

The fingerprint groups occurrences of the same problem:

- for an error: its name, its normalized message and the top stack frame (without query string, hash or build hash in the file name);
- otherwise: the level, the namespace and the normalized message.

Messages are normalized by replacing numbers, UUIDs, hexadecimal IDs, quoted strings and URLs with placeholders, so `Asset 42 not found` and `Asset 43 not found` share a fingerprint.

### Namespaces

The browser namespace is appended to the controller one: `dashboard:map` is logged under `browser:dashboard:map`, after the namespace of the logger given to the controller. With the Kuzzle `app.log`, it is `kuzzle:app:browser:dashboard:map`.

Since the namespace can be a transport label (for example with the Loki preset and `propsToLabels: ['namespace']`), a client could otherwise create any number of label values. The controller accepts at most `maxNamespaces` distinct namespaces per process. Entries with other namespaces are logged under `browser`, with their namespace in `clientNamespace`.

## Limits

| Limit              | Default | Behavior                                                                                        |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| `maxEntries`       | `100`   | Maximum entries per batch. Larger batches are rejected.                                         |
| `maxPayloadSize`   | `65536` | Maximum JSON size of a batch, in characters. Larger batches are rejected.                       |
| `maxContextDepth`  | `5`     | Maximum nesting depth of `context` and `err`. Deeper objects are replaced with `"[Truncated]"`. |
| `maxMessageLength` | `2048`  | `msg` and `err.message` are truncated beyond it.                                                |
| `maxStackLength`   | `8192`  | `err.stack` is truncated beyond it.                                                             |
| `levels`           | all     | Levels accepted from the browser. Entries with other levels are rejected.                       |

For example, to only accept warnings and errors from the browser:

```typescript
createBrowserLogsController(app.log, {
  badRequest: (message) => new BadRequestError(message),
  limits: { levels: ['warn', 'error', 'fatal'], maxEntries: 50 },
});
```

When the browser buffer overflows, the next batch says how many entries were dropped, and the controller logs a warning with a `dropped` field.

## Sanitization

Before it is logged, every entry is sanitized:

- values of keys containing `apikey`, `authorization`, `cookie`, `credential`, `jwt`, `passwd`, `password`, `secret`, `sessionid` or `token` are replaced with `[REDACTED]`, in `context` and in the custom properties of `err` and its causes (case-insensitive, `-` and `_` ignored: `accessToken`, `x-api-key` and `Set-Cookie` match). `level`, `namespace`, `time` and error names and messages are never redacted by key, so a `denylist` entry such as `name` or `age` only applies to `context` and error properties;
- JWTs, `Authorization` credentials (`Bearer`, `Basic`, `Token`...), parameters whose name ends with `token`, `secret`, `password`, `passwd`, `apikey` or `jwt` (`access_token=`, `client_secret=`, `x-api-key=`...) and JSON properties whose key matches the denylist (`"password":"..."` in a logged request body) are redacted from every string, including `msg` and stacks.

```typescript
createBrowserLogsController(app.log, {
  badRequest: (message) => new BadRequestError(message),
  sanitize: { denylist: ['email', 'phone'], replacement: '***' },
});
```

`denylist` is added to the default list. Sanitization is a safety net: frontends should not log personal data or secrets in the first place.

## Without the controller

`validateBatch`, `sanitize` and `fingerprint` are exported by `kuzzle-logger/kuzzle` to build a custom ingestion endpoint with the same wire format.
