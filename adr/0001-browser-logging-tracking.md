# ADR-0001 tracking: Browser logging v1

- **ADR:** [0001-browser-logging.md](./0001-browser-logging.md)
- **Epic:** [#13](https://github.com/kuzzleio/kuzzle-logger/issues/13)
- **Milestone:** [Browser logging v1](https://github.com/kuzzleio/kuzzle-logger/milestone/1)
- **Labels:** `browser-logging` plus one `area: *` label (`core`, `build`, `browser`, `ingestion`). Tasks that must land first also get `prerequisite`.

GitHub is the source of truth for status. This file gives the map, the order and the cross-repository
items that cannot be tracked here. Update it when a phase completes or the scope changes.

## Phases and tasks (this repository)

| Phase | Issue | Task | Blocked by | Status |
|---|---|---|---|---|
| 1. Prerequisites | [#21](https://github.com/kuzzleio/kuzzle-logger/issues/21) | Error instances lose message, stack and merging context | – | ✅ Done ([PR #28](https://github.com/kuzzleio/kuzzle-logger/pull/28)) |
| 1. Prerequisites | [#22](https://github.com/kuzzleio/kuzzle-logger/issues/22) | `child()` freezes the parent merging object | – | ✅ Done ([PR #29](https://github.com/kuzzleio/kuzzle-logger/pull/29)) |
| 1. Prerequisites | [#23](https://github.com/kuzzleio/kuzzle-logger/issues/23) | `trace(msg, ...args)` passes args as an array | – | ✅ Done ([PR #30](https://github.com/kuzzleio/kuzzle-logger/pull/30)) |
| 1. Prerequisites | [#24](https://github.com/kuzzleio/kuzzle-logger/issues/24) | Peer deps, public typings, preset options robustness | – | ✅ Done ([PR #31](https://github.com/kuzzleio/kuzzle-logger/pull/31)) |
| 1. Prerequisites | [#25](https://github.com/kuzzleio/kuzzle-logger/issues/25) | Functional test baseline | – | ✅ Done ([PR #27](https://github.com/kuzzleio/kuzzle-logger/pull/27)) |
| 2. Build | [#14](https://github.com/kuzzleio/kuzzle-logger/issues/14) | `browser` / `kuzzle` subpath exports, ESM browser build | #25 | ✅ Done ([PR #35](https://github.com/kuzzleio/kuzzle-logger/pull/35)) |
| 3. Browser | [#15](https://github.com/kuzzleio/kuzzle-logger/issues/15) | Browser `KuzzleLogger`, API parity, console mirroring | #14, #21 | ✅ Done ([PR #37](https://github.com/kuzzleio/kuzzle-logger/pull/37)) |
| 3. Browser | [#16](https://github.com/kuzzleio/kuzzle-logger/issues/16) | Batching transport, `kuzzle` and `http` senders | #15, #18 | ✅ Done ([PR #38](https://github.com/kuzzleio/kuzzle-logger/pull/38)) |
| 3. Browser | [#17](https://github.com/kuzzleio/kuzzle-logger/issues/17) | Opt-in global capture and Vue error handler | #15 | 🟦 In progress |
| 4. Ingestion | [#18](https://github.com/kuzzleio/kuzzle-logger/issues/18) | v1 payload schema, validation, sanitization, fingerprint | – | ✅ Done ([PR #34](https://github.com/kuzzleio/kuzzle-logger/pull/34)) |
| 4. Ingestion | [#19](https://github.com/kuzzleio/kuzzle-logger/issues/19) | `createBrowserLogsController` | #18, #21, #22 | ✅ Done ([PR #36](https://github.com/kuzzleio/kuzzle-logger/pull/36)) |
| 5. Docs | [#20](https://github.com/kuzzleio/kuzzle-logger/issues/20) | Guides and Grafana queries | #16, #19 | ⬜ Todo |

Status legend: ⬜ Todo · 🟦 In progress · ✅ Done · ⏸️ Blocked

Phases 1 and 4 (#18) can run in parallel. The critical path is #25 → #14 → #15 → #16 → #20.

## Cross-repository items

These items are opened and tracked in their own repositories. Add the issue link here once it exists.

| Repository | Item | Needed for | Link |
|---|---|---|---|
| kuzzle | Bump `kuzzle-logger` once phase 1 is released | Error logs and `requestId` in Kuzzle | – |
| kuzzle | Deprecated `kuzzle-plugin-logger` config path crashes for non-stdout services; the deprecation message names `server.logs` instead of `server.appLogs` | Robustness | – |
| kuzzle | `verbose` maps to `trace` in the plugin context but to `debug` in `Logger`; `child()` returns a plain `KuzzleLogger` cast as `Logger` | Consistency | – |
| kuzzle | Logger transports and level are fixed by the first `Logger` created, so `app.config.set('server.appLogs…')` after `new Backend()` is ignored | Doc accuracy | – |
| kuzzle | Fill the "Configure Logger" doc page; the `app.log.level('trace')` example is wrong (`level` is a property) | Docs | – |
| kuzzle (optional, v2) | Auto-register the browser logs controller behind a config flag | Zero-config adoption | – |
| iot-platform-backend | Register `createBrowserLogsController(app.log)` and grant `browser-logs:push` (decide whether the `anonymous` role is included) | Hypervision projects | – |
| iot-platform-frontend | Instantiate the browser logger in `initVue()`, wire the Vue error handler, and expose the logger to applications | Hypervision projects | – |
| paas-console | Add a "Browser logs / errors" panel to the generated logs dashboard (filter on `namespace`, group by `fingerprint`) | Visibility | – |
| paas-console | Logging credentials hardening | Security | Tracked internally |

## Decisions log

| Date | Decision |
|---|---|
| 2026-10-01 | ADR-0001 accepted: browser logs go through the application's Kuzzle backend. The browser logger and the ingestion controller both live in this package. v1 stays basic: a console replacement and explicit error pushing, with opt-in automatic capture. |
