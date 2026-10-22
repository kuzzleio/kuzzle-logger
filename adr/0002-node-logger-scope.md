# ADR-0002: Scope and shape of the Node logger

- **Status:** Proposed — open for discussion, not validated
- **Date:** 2026-10-09
- **Related:** [ADR-0001](./0001-browser-logging.md)

> This ADR records an analysis and a set of options. No decision has been taken yet: it is meant to
> be discussed and revisited before any implementation work starts.

## Question

`kuzzle-logger` presents itself as the generic logger of Kuzzle core, Kuzzle applications, plugins
and other Node processes. Does the Node part bring value of its own, compared to using Pino directly?
And if we keep it, what would a drastically better version look like?

## Context

### What the Node part does today

The Node entry point (`src/KuzzleLogger.ts`, `src/Presets.ts`, `src/serializeError.ts`, about 450
lines) is a thin wrapper around Pino:

| Feature                                                  | Pino native equivalent                  | Own value                                                                          |
| -------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `getMergingObject()`, per-call context                   | `mixin` option (+ `mixinMergeStrategy`) | None, it is a re-implementation                                                    |
| `child(namespace)` with `a:b:c` namespaces               | `child({ namespace })` + a mixin        | Low                                                                                |
| Child level follows the parent until set on the child    | Not native                              | Real, but marginal                                                                 |
| `serializeError` (cause, `AggregateError`, own fields)   | `pino.stdSerializers.errWithCause`      | Low                                                                                |
| Presets `stdout`, `file`, `loki`, `kuzzle-elasticsearch` | None                                    | **Main value**: one declarative config shape (`server.appLogs`, env-provided JSON) |

Outside Kuzzle core, consumers mostly import the `KuzzleLogger` **type** to annotate `app.log`. Only
a few standalone Node services instantiate it directly.

The parts of the package that have no off-the-shelf equivalent are the ones added by ADR-0001: the
browser logger, the payload protocol, the batching senders and the ingestion controller
(validation, sanitization, fingerprint, server-side enrichment).

### Issues found in the library

1. **Caller fields are overwritten by the merging object.** `toLogObject()` builds
   `{ ...obj, ...this.getMergingObject() }`, so `log.info({ namespace: 'mine', requestId: 'X' })`
   is emitted with the merging object's `namespace` and `requestId`.
2. **`child()` always instantiates `KuzzleLogger`, never the subclass.** Subclasses lose their own
   methods on children. Kuzzle core casts the result (`lib/kuzzle/Logger.ts`, "this is fishy"), so
   calling a subclass-only method such as `silly()` on a child throws a `TypeError`. That breaks the
   "logging must never throw" rule.
3. **One Pino transport (worker thread) per instance.** Each `new KuzzleLogger()` calls
   `pino.transport()`. Kuzzle core works around it with a static shared Pino instance and the
   internal `skipPinoInstance` flag, which leaks into the public config type. Side effect: loggers
   built that way are sibling Pino children, so changing the level of one does not change the other.
4. **`stdout` defaults to `pino-pretty` when `NODE_ENV` is unset.** A production container without
   `NODE_ENV` gets pretty-printed output, and crashes at startup if the optional `pino-pretty` peer
   is not installed.
5. **The merging object is computed for disabled levels.** Every ignored `debug()` call still runs
   `getMergingObject()` (in Kuzzle core: an async store lookup) and copies the object.
6. **Platform-specific logic in a generic preset.** `kuzzle-elasticsearch` hard-codes
   `_kuzzle_info` and the `&platform.logs` index.

### Issues found in the Kuzzle core integration

7. **No `requestId` in application logs.** Kuzzle's `getMergingObject` only adds `requestId` when
   the namespace is exactly `kuzzle`. `app.log` (`kuzzle:app`) and its children never carry it,
   although they are the logs integrators read the most.
8. **Two parallel logging systems.** `server.appLogs` goes through `kuzzle-logger`, while access logs
   (`server.logs`) build their own Pino instance in a worker thread with their own translation of
   winston-style transports (console, file, elasticsearch, syslog), without the presets.
9. **Errors are logged as interpolated strings.** `unhandledRejection`, `uncaughtException` and
   several other call sites log `` `${err.message} ${err.stack}` `` instead of passing the error, so
   the error serializer is bypassed and the stack ends up in `msg`.
10. **Plugins have no structured logging through `context.log`.** It only accepts a string and
    prefixes it with `[pluginName]`, although the namespace already carries the plugin name. Objects
    are coerced to `[object Object]`. (`context.logger`, the underlying child, is structured.)
11. **Legacy `kuzzle-plugin-logger` config.** The mapping only returns a target for the `stdout`
    service. Other services yield `undefined` targets. Not reproduced, to be confirmed.

Issues 1 and 3 were reproduced with a throwaway test. The others come from reading the code.

## Options

### A. Status quo, fix the bugs

Fix issues 1, 2, 4 and 7 to 11 in place, keep the `KuzzleLogger` class and its API.

- Smallest change, no breaking change.
- Keeps a class that duplicates Pino features (mixin, child, serializers) and its maintenance cost.
- Does not solve the one-transport-per-instance design (issue 3) without a new API.

### B. Pino-native core with a shared root (2.0)

Reduce the Node core to a factory that returns a real `pino.Logger`:

- `createLogger(config)` builds **one** transport per process (root logger), and everything else is
  a Pino child. This removes the static shared instance and `skipPinoInstance` from Kuzzle core, and
  the level divergence between `kuzzle.log` and `app.log`.
- Per-call context through Pino's `mixin`, with caller fields taking precedence (fixes issue 1) and
  nothing computed for disabled levels (issue 5).
- A generic request context provided by the library, e.g. an `AsyncLocalStorage` with
  `withLogContext({ requestId }, fn)`. Kuzzle sets it in the funnel, and every logger (core, `app.log`,
  plugins, children) gets the `requestId` (fixes issue 7 at the root).
- Error serializer and presets kept as the library's own value.
- `KuzzleLogger` kept as a deprecated adapter over the Pino logger, so `app.log` and
  `context.logger` do not break. Kuzzle keeps `silly`, `verbose`, `getLevel` and `setLevel` in that
  adapter.

### C. Drop the Node part, publish presets only

Kuzzle core and services use Pino directly. The package only exports the presets (as a function that
returns a Pino transport config), the error serializer and the browser/protocol/ingestion parts.

- Least code to maintain.
- Every consumer re-implements context propagation and children conventions, so logs drift apart
  across services.
- Larger migration for Kuzzle core, applications and plugins.

## Directions to discuss (any option)

- **Safe defaults.** JSON on stdout by default. Pretty output only when explicitly requested (or
  `NODE_ENV=development`).
- **Generic presets.** Move `_kuzzle_info` and the default index out of `kuzzle-elasticsearch`, or
  make them plain parameters (`index`, `additionalBindings`).
- **Unify access logs and app logs.** Access logs become a dedicated logger (`kuzzle:accessLogs`)
  built from the same presets. The winston-style translation stays as a deprecated compatibility
  layer.
- **Structured logging everywhere in Kuzzle core.** `log.error(err, msg)` instead of interpolated
  strings. `context.log.*(obj, msg)` becomes an alias of `context.logger`, without the string prefix.
- **Package positioning.** Present the package around what is unique to it: the browser logger, the
  protocol and the ingestion controller, with the Node part as the Pino adapter. A common log schema
  (ECS-like field names for `namespace`, `requestId`, `nodeId`, `err`) shared with the Python
  implementation would give the package a cross-language purpose.

## Open questions

- Is option B worth a major version, or can its API (`createLogger`, `withLogContext`) be added in
  1.x next to the existing class, with the class deprecated later?
- Should the request context (`AsyncLocalStorage`) live in this package or stay in Kuzzle core, with
  the package only exposing a context hook?
- Which Kuzzle core version should switch first, and how do we handle applications and plugins that
  extend or type `KuzzleLogger` directly?
- Do we keep the winston-style access log configuration, and for how long?
- Which consumers outside Kuzzle core must be migrated, and who owns that work?

## Consequences

To be written once a decision is taken.
