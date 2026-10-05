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
| 3. Browser | [#17](https://github.com/kuzzleio/kuzzle-logger/issues/17) | Opt-in global capture and Vue error handler | #15 | ✅ Done ([PR #39](https://github.com/kuzzleio/kuzzle-logger/pull/39)) |
| 4. Ingestion | [#18](https://github.com/kuzzleio/kuzzle-logger/issues/18) | v1 payload schema, validation, sanitization, fingerprint | – | ✅ Done ([PR #34](https://github.com/kuzzleio/kuzzle-logger/pull/34)) |
| 4. Ingestion | [#19](https://github.com/kuzzleio/kuzzle-logger/issues/19) | `createBrowserLogsController` | #18, #21, #22 | ✅ Done ([PR #36](https://github.com/kuzzleio/kuzzle-logger/pull/36)) |
| 5. Docs | [#20](https://github.com/kuzzleio/kuzzle-logger/issues/20) | Guides and Grafana queries | #16, #19 | ✅ Done |
| 6. Hardening | [#47](https://github.com/kuzzleio/kuzzle-logger/issues/47) | Browser logging throws when `getMergingObject` throws | – | ✅ Done ([PR #60](https://github.com/kuzzleio/kuzzle-logger/pull/60)) |
| 6. Hardening | [#48](https://github.com/kuzzleio/kuzzle-logger/issues/48) | Re-entrant flush when the transport logs synchronously | – | ✅ Done ([PR #61](https://github.com/kuzzleio/kuzzle-logger/pull/61)) |
| 6. Hardening | [#49](https://github.com/kuzzleio/kuzzle-logger/issues/49) | Entries lost on `pagehide` while a request is in flight | – | ✅ Done ([PR #63](https://github.com/kuzzleio/kuzzle-logger/pull/63)) |
| 6. Hardening | [#50](https://github.com/kuzzleio/kuzzle-logger/issues/50) | Limit batch size in bytes | – | ✅ Done ([PR #64](https://github.com/kuzzleio/kuzzle-logger/pull/64)) |
| 6. Hardening | [#51](https://github.com/kuzzleio/kuzzle-logger/issues/51) | Browser entries silently rejected by the backend (namespace, depth) | – | ✅ Done ([PR #62](https://github.com/kuzzleio/kuzzle-logger/pull/62)) |
| 6. Hardening | [#52](https://github.com/kuzzleio/kuzzle-logger/issues/52) | Custom sanitize denylist redacts protocol fields | – | ✅ Done ([PR #65](https://github.com/kuzzleio/kuzzle-logger/pull/65)) |
| 6. Hardening | [#53](https://github.com/kuzzleio/kuzzle-logger/issues/53) | Sensitive query parameters not redacted | – | ✅ Done ([PR #66](https://github.com/kuzzleio/kuzzle-logger/pull/66)) |
| 6. Hardening | [#54](https://github.com/kuzzleio/kuzzle-logger/issues/54) | Fingerprints change across deploys | – | ✅ Done ([PR #67](https://github.com/kuzzleio/kuzzle-logger/pull/67)) |
| 6. Hardening | [#55](https://github.com/kuzzleio/kuzzle-logger/issues/55) | Child loggers keep the level they had when created | – | ✅ Done ([PR #68](https://github.com/kuzzleio/kuzzle-logger/pull/68)) |
| 6. Hardening | [#56](https://github.com/kuzzleio/kuzzle-logger/issues/56) | Extensionless deep imports no longer resolve since 1.5.0 | – | ✅ Done ([PR #69](https://github.com/kuzzleio/kuzzle-logger/pull/69)) |
| 6. Hardening | [#57](https://github.com/kuzzleio/kuzzle-logger/issues/57) | Ingestion hardening for anonymous users | – | ✅ Done ([PR #72](https://github.com/kuzzleio/kuzzle-logger/pull/72)) |
| 6. Hardening | [#58](https://github.com/kuzzleio/kuzzle-logger/issues/58) | Flush, capture and Vue handler improvements | – | ✅ Done ([PR #73](https://github.com/kuzzleio/kuzzle-logger/pull/73)) |
| 6. Hardening | [#59](https://github.com/kuzzleio/kuzzle-logger/issues/59) | CI release workflow follow-ups | – | ✅ Done ([PR #71](https://github.com/kuzzleio/kuzzle-logger/pull/71)) |

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
| 2026-10-03 | Phase 6 opened after a review of 1.5.0: bugs and hardening found in edge cases (#47 to #59). |
