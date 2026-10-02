# Kuzzle Logger

[![Node.js CI](https://github.com/kuzzleio/kuzzle-logger/actions/workflows/push-and-pr.workflow.yaml/badge.svg)](https://github.com/kuzzleio/kuzzle-logger/actions/workflows/push-and-pr.workflow.yaml)
[![npm version](https://badge.fury.io/js/kuzzle-logger.svg)](https://badge.fury.io/js/kuzzle-logger)
[![License](https://img.shields.io/github/license/kuzzleio/kuzzle-logger)](LICENSE)

A powerful and flexible logging package designed for Kuzzle backend, JS SDK, and related modules (like gateways). Built on top of [Pino](https://github.com/pinojs/pino), it provides a robust logging solution with multiple transport options and preset configurations.

## Features

- 🚀 High-performance logging with minimal overhead
- 📦 Multiple transport options (Console, Elasticsearch, Loki)
- 🎨 Customizable log formats and levels
- 🔧 Pre-configured presets for common use cases
- 🔄 TypeScript support
- 🎯 Zero configuration needed to get started

## Installation

```bash
npm install kuzzle-logger
```

## Quick Start

```javascript
const { KuzzleLogger } = require('kuzzle-logger');

const logger = new KuzzleLogger();

logger.info('Hello, Kuzzle Logger!');
logger.error({ err: new Error('Oops!') }, 'Something went wrong');
```

## Entry points

| Import | Runs in | Format |
|---|---|---|
| `kuzzle-logger` | Node | CommonJS |
| `kuzzle-logger/browser` | Browser | ESM |
| `kuzzle-logger/kuzzle` | Node (Kuzzle application) | CommonJS |

`kuzzle-logger/browser` and `kuzzle-logger/kuzzle` are the two halves of browser logging
([ADR-0001](adr/0001-browser-logging.md)): browser logs are sent to the application's
Kuzzle backend, which forwards them with its own logger and transports.

```javascript
// Kuzzle application
import { BadRequestError } from 'kuzzle';
import { createBrowserLogsController } from 'kuzzle-logger/kuzzle';

app.controller.register(
  'browser-logs',
  createBrowserLogsController(app.log, { badRequest: (message) => new BadRequestError(message) }),
);

// Frontend
import {
  KuzzleLogger,
  captureGlobalErrors,
  createKuzzleSender,
  createVueErrorHandler,
} from 'kuzzle-logger/browser';

const logger = new KuzzleLogger({ level: 'info', sender: createKuzzleSender(sdk) });

logger.error(new Error('Failed to load assets'));

// Opt-in: uncaught errors, unhandled rejections and Vue errors
captureGlobalErrors(logger.child('global'));
app.config.errorHandler = createVueErrorHandler(logger.child('vue'));
```

## Documentation

The documentation is published on [docs.kuzzle.io](https://docs.kuzzle.io/modules/logger/1/), from the [`doc/1`](doc/1) directory:

- [Getting started](doc/1/guides/getting-started/index.md)
- [Transport configuration](doc/1/guides/transport-configuration/index.md)
- [Presets](doc/1/guides/presets/index.md)
- [Child logger](doc/1/guides/child-logger/index.md)
- [Browser logging](doc/1/guides/browser-logging/index.md)
- [Ingesting browser logs in Kuzzle](doc/1/guides/browser-logs-ingestion/index.md)
- [Grafana dashboards](doc/1/guides/grafana-dashboards/index.md)
- [API reference](doc/1/api/kuzzle-logger/index.md)

## Contributing

We love contributions! If you'd like to contribute, please feel free to submit a PR.

## Support

If you have any questions or encounter issues, please:

- Check our [documentation](https://docs.kuzzle.io/modules/logger/1/)
- Open an [issue](https://github.com/kuzzleio/kuzzle-logger/issues)
- Contact us at support@kuzzle.io

## License

This project is released under the [Apache 2.0 License](LICENSE).
