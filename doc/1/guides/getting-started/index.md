---
code: false
type: page
order: 100
title: Getting started
description: Install Kuzzle Logger and pick the guide matching your use case
---

# Getting Started

Kuzzle Logger is the logger of Kuzzle and of its applications. It is built on [Pino](https://github.com/pinojs/pino): entries are JSON lines, written to one or more destinations (stdout, a file, Loki, Elasticsearch) configured with [presets](/modules/logger/1/guides/presets).

## Which guide do I need?

| You want to...                                                 | Read                                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Send the logs of a Kuzzle application to Loki or Elasticsearch | [In a Kuzzle application](#in-a-kuzzle-application), then [Presets](/modules/logger/1/guides/presets) |
| Log from a Node service that is not a Kuzzle application       | [In a Node service](#in-a-node-service)                                                               |
| Get the logs and errors of a frontend next to the backend logs | [Set up browser logging](/modules/logger/1/guides/browser-logging-setup)                              |
| Query the logs in Grafana                                      | [Grafana dashboards](/modules/logger/1/guides/grafana-dashboards)                                     |

## In a Kuzzle application

Kuzzle already uses Kuzzle Logger: `app.log` is a Kuzzle Logger. Its destinations are set by the `server.appLogs` section of the Kuzzle configuration (`.kuzzlerc`), which takes the same options as the [KuzzleLogger constructor](/modules/logger/1/api/types/kuzzle-logger-config).

For example, to write to stdout and to Loki:

```json
{
  "server": {
    "appLogs": {
      "level": "info",
      "serviceName": "my-app",
      "transport": {
        "targets": [
          { "preset": "stdout" },
          {
            "preset": "loki",
            "presetOptions": { "host": "http://loki:3100" }
          }
        ]
      }
    }
  }
}
```

The same can be set with environment variables, e.g. `kuzzle_server__appLogs__serviceName=my-app`.

Then log with `app.log`:

```typescript
app.log.info('Application started');
app.log.error({ err: error, assetId }, 'Failed to update the asset');

const mqttLogger = app.log.child('mqtt'); // namespace "kuzzle:app:mqtt"
```

## In a Node service

```bash
npm install kuzzle-logger
```

```typescript
import { KuzzleLogger } from 'kuzzle-logger';

const logger = new KuzzleLogger({
  serviceName: 'my-service',
  transport: { preset: 'stdout' },
});

logger.info('Hello, world!');
logger.debug({ userId: '123', action: 'login' }, 'User login attempt');
logger.error(new Error('Something went wrong'), 'Error occurred');
```

Without `transport`, entries are written to stdout. The `stdout` preset pretty-prints them when `NODE_ENV` is `development` or not set: install `pino-pretty` for that, or set `NODE_ENV=production` to get JSON lines.

## Entry points

| Import                  | Runs in         | Use it for                                                                                                                          |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `kuzzle-logger`         | Node (CommonJS) | Backend services, gateways, the Kuzzle core                                                                                         |
| `kuzzle-logger/browser` | Browser (ESM)   | Frontend applications: see [Browser logging](/modules/logger/1/guides/browser-logging)                                              |
| `kuzzle-logger/kuzzle`  | Node (CommonJS) | Kuzzle applications receiving browser logs: see [Ingesting browser logs in Kuzzle](/modules/logger/1/guides/browser-logs-ingestion) |
