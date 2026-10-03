# AGENTS.md

Guide for coding agents (and humans) working on this repository. User documentation is in `doc/1` and on [docs.kuzzle.io](https://docs.kuzzle.io/modules/logger/1/).

## What this package is

`kuzzle-logger` is the logger of Kuzzle core, Kuzzle applications and related services. Three entry points, three runtimes:

| Entry point             | Source                                | Runtime                     | Build                                  |
| ----------------------- | ------------------------------------- | --------------------------- | -------------------------------------- |
| `kuzzle-logger`         | `src/index.ts`, `src/KuzzleLogger.ts` | Node, CommonJS, Pino        | `tsconfig.build.json` → `dist/`        |
| `kuzzle-logger/browser` | `src/browser/`                        | Browser, ESM, no dependency | `tsconfig.browser.json` → `dist/esm/`  |
| `kuzzle-logger/kuzzle`  | `src/kuzzle/`                         | Node, CommonJS, in Kuzzle   | `tsconfig.build.json` → `dist/kuzzle/` |

`src/protocol/` is the wire format shared by the browser and the ingestion controller (payload v1, validation, sanitization, fingerprint). It is compiled into both builds.

Browser logging flow ([ADR-0001](adr/0001-browser-logging.md)): browser `KuzzleLogger` → batching sender (`createKuzzleSender` / `createHttpSender`) → `browser-logs:push` → `createBrowserLogsController` (validate, sanitize, enrich) → `app.log.child('browser')` → backend transports.

## Hard rules

- `src/browser/` imports only from `src/browser`, `src/protocol` and `src/types`, with `.js` extensions. No Node built-ins, no Pino. `test/packaging.test.ts` and the smoke test enforce it.
- `src/kuzzle/` must not import `kuzzle` at runtime (Kuzzle depends on this package). Kuzzle types and errors are injected (see the `badRequest` option).
- Keep `./dist` and `./dist/*` in the `exports` map of `package.json`: Kuzzle core imports `kuzzle-logger/dist`.
- Transports (`pino-loki`, `pino-elasticsearch`, `pino-pretty`, `pino-transport-ecs`) are optional peer dependencies. Never add them to `dependencies`.
- Changing the payload (`src/protocol/payload.ts`) is a protocol change: old browsers keep sending the previous version. Bump `PAYLOAD_VERSION` only with backend support for both versions.
- Logging must never throw, and senders must never log (it would loop).
- This repository is public: no internal URLs, credentials, customer names or infrastructure details in code, docs, issues or PRs.

## Commands

```bash
npm ci
npm test                       # lint + vitest
npx vitest run --dir test      # tests only (use --dir test if .claude/worktrees/ exists)
npm run test:types             # type-check both builds
npm run build && npm run test:smoke   # import, type-check and bundle the built package
```

Run `npm test` and `npm run test:types` before committing. Run the smoke test when touching `package.json` exports, tsconfigs, `scripts/` or imports between folders.

## Conventions

- Commits follow Conventional Commits (commitlint): `feat(browser): ...`, `fix(presets): ...`, `docs: ...`. The release version is computed from them by semantic-release.
- Branches: features and fixes target `1-dev` (released as `x.y.z-beta.N`), which is merged into `main` for stable releases.
- Tests live in `test/*.test.ts` (vitest, `happy-dom` for browser tests). Every behavior change comes with a test.
- Code style: Prettier and `eslint-plugin-kuzzle` (applied by the pre-commit hook).

## Documentation

When an option, a default or a behavior changes, update the matching page in the same PR:

| Change in                          | Page                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `src/KuzzleLogger.ts`, `src/types` | `doc/1/api/`, `doc/1/guides/getting-started`             |
| `src/Presets.ts`                   | `doc/1/guides/presets`, `doc/1/api/types/preset-options` |
| `src/browser/`                     | `doc/1/guides/browser-logging`                           |
| `src/kuzzle/`, `src/protocol/`     | `doc/1/guides/browser-logs-ingestion`                    |
| Setup steps, error messages        | `doc/1/guides/browser-logging-setup`, `README.md`        |

Doc rules (VuePress, built by [kuzzleio/documentation](https://github.com/kuzzleio/documentation)):

- One directory = one page = one `index.md`.
- Frontmatter allows only `code`, `type` (`root` / `branch` / `page`), `title`, `description`, `order`, `nosidebar`. Any other key breaks the build.
- Internal links are absolute and versioned: `/modules/logger/1/guides/presets`.
- Containers: `::: info`, `::: warning`, `::: success`.

## Where things are

- `adr/`: architecture decisions; `adr/0001-browser-logging-tracking.md` tracks the browser logging work.
- `scripts/write-esm-package.mjs`: writes `dist/esm/package.json` (`"type": "module"`).
- `test/smoke/run.mjs`: end-to-end check of the built package (Node CJS/ESM, TypeScript resolutions, Vite bundle).
- `changelogs/`: generated by the release, do not edit.
