# ADR-0001: Browser logging through the Kuzzle backend

- **Status:** Accepted
- **Date:** 2026-10-01
- **Tracking:** [0001-browser-logging-tracking.md](./0001-browser-logging-tracking.md)

## Context

`kuzzle-logger` is the logging package used by the Kuzzle backend (`server.appLogs`), by Kuzzle
applications (`app.log`) and by plugins (`context.logger`). It wraps Pino and provides transport
presets (`stdout`, `kuzzle-elasticsearch`, `loki`, `file`), hierarchical child loggers
(`namespace`) and a per-log merging object (`nodeId`, `requestId`, ...).

Applications deployed on our PaaS already push their **backend** logs directly to Loki with the
`loki` preset. Each stream is labelled with the project, environment, application and component, and
`propsToLabels: ["nodeId", "namespace"]`. Grafana dashboards are provisioned per environment and
filter on these labels (`namespace` is exposed as a `scope` variable).

Client **frontends** (Vue 3 + Vite, served as static files by nginx) have no logging or error
reporting at all: no `app.config.errorHandler`, no `window.onerror`, no `unhandledrejection`
listener, and no third-party tool such as Sentry. Front-end errors are therefore invisible unless a
user reports them.

We want frontend developers to have a **drop-in replacement for `console.log` / `console.debug`**
whose output, and especially errors, lands in the **same Loki datasource and dashboards** as the
backend of the same application. The solution must also stay generic, like the Node side of this
package, and be usable outside our PaaS.

### Constraints

1. **No credentials in the browser.** Anything shipped to a browser is public. A Loki (or
   Elasticsearch) push token must never be part of a frontend bundle.
2. **Labels must not be trusted from the client.** The project, environment and application must be
   set server-side. Otherwise any visitor could write into another tenant's streams.
3. **Low label cardinality.** User ids, URLs, messages or fingerprints must never become Loki labels.
4. **No new infrastructure for v1.** Frontends are plain nginx containers with build-time config only.
5. **No runtime dependency cycle.** `kuzzle` depends on `kuzzle-logger`, so `kuzzle-logger` cannot
   import `kuzzle` at runtime.

### Current issues that affect this work

These are existing defects of the Node logger. They would be inherited by browser logs, so they are
prerequisites:

- Logging an `Error` instance spreads it (`{...err}`). `message` and `stack` are non-enumerable, so
  they are lost. Error-like objects also skip `getMergingObject()`, so they lose `namespace`,
  `nodeId` and `requestId`.
- `child()` evaluates the parent's merging object **once**, at creation time. Child loggers created
  at boot never carry per-request context such as `requestId`.
- `trace(msg, ...args)` passes `args` as an array instead of spreading it.
- `pino-loki` is not declared as an (optional) peer dependency. The published typings import
  `JSONObject` from `kuzzle-sdk`, which is only a dev dependency. Presets read `presetOptions.*`
  without guarding against a missing `presetOptions`, and the `loki` preset always sets
  `service_name`, even when `serviceName` is `undefined`.
- There is no automated test suite.

## Options considered

### A. Browser pushes directly to Loki

Use the `loki` HTTP API from the browser.

- ➖ Requires a push credential in the bundle (violates constraint 1).
- ➖ Labels are client-controlled (violates constraint 2).
- ➖ Requires CORS on the Loki endpoint.
- ➕ No backend involvement.

**Rejected.** This is acceptable only behind a dedicated, authenticated collector, which is out of
scope for v1.

### B. Dedicated collector (e.g. Grafana Faro + Alloy `faro.receiver`)

- ➕ Feature-rich: web vitals, sessions, source maps.
- ➖ New public infrastructure per cluster, plus CORS and rate limiting to operate.
- ➖ Tenant mapping relies on an app name sent by the client (constraint 2).
- ➖ It is a different SDK, so the API differs from `kuzzle-logger`.

**Deferred.** We can reconsider it for a v2 focused on real user monitoring.

### C. Browser sends logs to the application's own Kuzzle backend, which forwards them with its existing logger (chosen)

- ➕ No credentials in the browser. The backend already holds its transport configuration.
- ➕ Labels are set server-side, by whatever already configures the backend logger (the PaaS or the
  user's own `server.appLogs`).
- ➕ Browser logs appear in the existing dashboards with no change: they go through a child logger,
  so `namespace` (`scope` in Grafana) identifies them.
- ➕ The backend knows the authenticated user (`kuid`) and already enforces rate limits (profile
  `rateLimit`).
- ➕ It is generic. Outside the PaaS, browser logs follow whatever transport the backend uses
  (stdout, ES, file, Loki).
- ➖ It adds load on the backend. This is mitigated by batching, payload limits and rate limits.
- ➖ Logs emitted while the backend is unreachable are delayed (bounded buffer) or lost.

## Decision

We go with **option C**. Both sides live **in this package**, so that the same team owns the
client, the wire format and the ingestion:

| Entry point | Runs in | Content |
|---|---|---|
| `kuzzle-logger` | Node | Existing logger (unchanged API, prerequisites fixed) |
| `kuzzle-logger/browser` | Browser | `KuzzleLogger` with the same API, built on `pino/browser`, with batching senders |
| `kuzzle-logger/kuzzle` | Node (Kuzzle) | `createBrowserLogsController()`, which returns a plain Kuzzle controller definition |

### Why the ingestion action lives in this module

- The wire format (payload schema, limits) is defined once and versioned with both ends.
- `createBrowserLogsController()` returns a **plain object** (`{ actions: { push: { handler, http } } }`),
  typed structurally. It needs no runtime import of `kuzzle` (constraint 5) and works with any
  Kuzzle version that supports `app.controller.register()`.
- The validation and sanitization core is framework-agnostic. It can later be reused by another
  server, such as a gateway or an Express app.
- The consumer decides **whether and where** to register it, and which profiles may call it.
  Platform packages can enable it for all projects in one place. Kuzzle core could later
  auto-register it behind a configuration flag.

### v1 scope ("basic, then iterate")

**Browser (`kuzzle-logger/browser`)**

- Same API as the Node logger: `trace|debug|info|warn|error|fatal(objOrMsg, msg?, ...args)`,
  `child(namespace)`, `level`, `getMergingObject`, `flush()`.
- `console` mirroring, so developers keep seeing logs in devtools. It is configurable per level.
- Errors are serialized properly (`name`, `message`, `stack`, `cause`).
- Batched sending, configurable by size and interval, with an immediate flush on `error`/`fatal`.
- A bounded in-memory buffer, and a flush on `pagehide`/`visibilitychange` (`fetch` with
  `keepalive`).
- Senders:
  - `kuzzle`: uses an existing Kuzzle SDK instance (`sdk.query`). It is structurally typed, with no
    hard dependency.
  - `http`: a generic `fetch` POST to a URL. It targets the Kuzzle HTTP route by default, and can
    also target any compatible endpoint.
- Opt-in helpers. Developers push errors explicitly first; automatic capture is a convenience:
  - `captureGlobalErrors(logger)`: `window` `error` and `unhandledrejection` events.
  - `createVueErrorHandler(logger)`: a function to assign to `app.config.errorHandler`. No `vue`
    dependency.

**Ingestion (`kuzzle-logger/kuzzle`)**

- Controller `browser-logs`, action `push`. HTTP route `POST /_/browser-logs/_push`. Both names are
  configurable.
- Validation: maximum entries per batch, maximum serialized size, maximum message length, allowed
  levels, and only plain JSON objects as context.
- Sanitization: a denylist of keys (e.g. `password`, `token`, `authorization`), and redaction of
  tokens or JWTs in URLs and query strings.
- Enrichment, done server-side and never trusted from the client: `source: "browser"`, `userId`
  (`request.getKuid()`), `userAgent`, `origin`, `clientTime`. Timestamps are the server's, so Loki
  never rejects out-of-order entries.
- `fingerprint`: a hash of the error name, the message and the top stack frame. It is a **field,
  not a label**. It enables Sentry-like grouping with LogQL (`| json | count by (fingerprint)`).
- Forwarding: through a child of the given logger (default namespace `browser`, e.g.
  `kuzzle:app:browser`). This reuses its transports and labels.

**Payload (v1)**

```jsonc
{
  "version": 1,
  "app": { "name": "my-frontend", "version": "1.2.3" }, // optional, informational only
  "entries": [
    {
      "level": "error",                // trace|debug|info|warn|error|fatal
      "time": 1759312800000,           // client epoch ms -> stored as clientTime
      "msg": "Failed to load assets",
      "namespace": "dashboard:map",    // appended to the server-side namespace
      "context": { "assetId": "abc" }, // plain JSON object, size-limited
      "err": { "name": "TypeError", "message": "...", "stack": "..." }
    }
  ]
}
```

### Out of scope for v1

Source map resolution, breadcrumbs, session replay, web vitals or performance data, sampling,
issue grouping UI, a direct Loki sender, and an offline persistent buffer (`localStorage`). These
can be added later without breaking the v1 payload (`version` field).

## Consequences

- The package gains two subpath exports and a browser-compatible ESM build (see tracking file).
  The Node entry point stays CommonJS and keeps its API.
- Applications must **register the controller** and **grant the action** to the profiles that need
  it. To report errors before login, the `anonymous` role must allow `browser-logs:push`. This is
  an explicit, documented choice per platform, protected by the profile `rateLimit` and payload
  limits.
- Browser logs share the backend's streams. Dashboards distinguish them by `namespace` (and the
  `source` field). Teams that want a dedicated label can add `source` to `propsToLabels`. It has
  low cardinality.
- Platform integrations (Kuzzle core shims, platform backend and frontend packages, PaaS dashboards)
  are tracked in their own repositories and referenced from the tracking file.
