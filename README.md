# Kuzzle Logger

[![Node.js CI](https://github.com/kuzzleio/kuzzle-logger/actions/workflows/push-and-pr.workflow.yaml/badge.svg)](https://github.com/kuzzleio/kuzzle-logger/actions/workflows/push-and-pr.workflow.yaml)
[![npm version](https://badge.fury.io/js/kuzzle-logger.svg)](https://badge.fury.io/js/kuzzle-logger)
[![License](https://img.shields.io/github/license/kuzzleio/kuzzle-logger)](LICENSE)

The logger of [Kuzzle](https://github.com/kuzzleio/kuzzle) and its applications, built on [Pino](https://github.com/pinojs/pino). It writes JSON logs to stdout, a file, Loki or Elasticsearch, and can collect the logs of a frontend through its Kuzzle backend.

📖 **Documentation: [docs.kuzzle.io/modules/logger/1](https://docs.kuzzle.io/modules/logger/1/)**

## Install

```bash
npm install kuzzle-logger
```

## Node

```javascript
const { KuzzleLogger } = require('kuzzle-logger');

const logger = new KuzzleLogger({
  serviceName: 'my-service',
  transport: { preset: 'loki', presetOptions: { host: 'http://localhost:3100' } },
});

logger.info('Service started');
logger.error({ err: new Error('Oops'), assetId: 'a-42' }, 'Something went wrong');
logger.child('mqtt').debug('Connected'); // namespace "mqtt"
```

In a Kuzzle application, use `app.log` instead: it is already a Kuzzle Logger, configured by the `server.appLogs` section of `.kuzzlerc` ([Getting started](https://docs.kuzzle.io/modules/logger/1/guides/getting-started/)).

## Browser logging

Frontend logs and uncaught errors are sent to the application's Kuzzle backend, which writes them with its own logger. The browser never holds log storage credentials.

**1. Backend:** register the ingestion controller, then grant `browser-logs:push` to the frontend users' roles.

```javascript
import { BadRequestError } from 'kuzzle';
import { createBrowserLogsController } from 'kuzzle-logger/kuzzle';

app.controller.register(
  'browser-logs',
  createBrowserLogsController(app.log, { badRequest: (message) => new BadRequestError(message) }),
);
```

**2. Frontend:** create the logger with the Kuzzle SDK instance, and capture uncaught errors.

```javascript
import {
  KuzzleLogger,
  captureGlobalErrors,
  createKuzzleSender,
  createVueErrorHandler,
} from 'kuzzle-logger/browser';

export const logger = new KuzzleLogger({ namespace: 'web', sender: createKuzzleSender(kuzzle) });

captureGlobalErrors(logger.child('global'));
app.config.errorHandler = createVueErrorHandler(logger.child('vue')); // Vue only

logger.error(new Error('Failed to load assets'));
```

Full walkthrough, with rights, CSP and troubleshooting: [Set up browser logging](https://docs.kuzzle.io/modules/logger/1/guides/browser-logging-setup/).

## Entry points

| Import                  | Runs in                   | Format   |
| ----------------------- | ------------------------- | -------- |
| `kuzzle-logger`         | Node                      | CommonJS |
| `kuzzle-logger/browser` | Browser (with a bundler)  | ESM      |
| `kuzzle-logger/kuzzle`  | Node (Kuzzle application) | CommonJS |

## Contributing

See [AGENTS.md](AGENTS.md) for the repository layout, commands and conventions. Design decisions are recorded in [`adr/`](adr). Documentation sources are in [`doc/1`](doc/1).

Questions and bugs: open an [issue](https://github.com/kuzzleio/kuzzle-logger/issues) or contact support@kuzzle.io.

## License

[Apache 2.0](LICENSE)
