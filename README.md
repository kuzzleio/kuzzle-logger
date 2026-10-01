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
logger.error('Something went wrong', { error: new Error('Oops!') });
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
import { KuzzleLogger, createKuzzleSender } from 'kuzzle-logger/browser';

const logger = new KuzzleLogger({ level: 'info', sender: createKuzzleSender(sdk) });

logger.error(new Error('Failed to load assets'));
```

## Documentation

For detailed information about using Kuzzle Logger, please refer to our documentation:

- [API Reference](docs/api-reference.md)
- [Transport Configuration](docs/transport-configuration.md)
- [Logging Presets](docs/presets.md)

## Contributing

We love contributions! If you'd like to contribute, please feel free to submit a PR.

## Support

If you have any questions or encounter issues, please:

- Check our [documentation](doc/README.md)
- Open an [issue](https://github.com/kuzzleio/kuzzle-logger/issues)
- Contact us at support@kuzzle.io

## License

This project is released under the [Apache 2.0 License](LICENSE).
