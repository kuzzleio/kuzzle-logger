---
code: true
type: page
title: KuzzleLoggerConfig interface
description: Kuzzle Logger API - KuzzleLoggerConfig interface
order: 100
---

# KuzzleLoggerConfig

Options of the [KuzzleLogger](/modules/logger/1/api/kuzzle-logger) constructor. In a Kuzzle application, they are set in the `server.appLogs` section of the Kuzzle configuration.

```typescript
import { KuzzleLoggerConfig } from 'kuzzle-logger';

interface KuzzleLoggerConfig {
  level?: string;
  serviceName?: string;
  transport?: TransportConfig;
  getMergingObject?: () => JSONObject;
}
```

| Property           | Default  | Description                                                                                                                       |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `level`            | `info`   | Minimum level of the logged entries: `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent` (nothing is logged).          |
| `serviceName`      | –        | Name of the service. Used by the `loki` preset (`service_name` label) and the `kuzzle-elasticsearch` preset (ECS `service.name`). |
| `transport`        | `stdout` | Where entries are written. See [TransportConfig](/modules/logger/1/api/types/transport-config).                                   |
| `getMergingObject` | –        | Called on each log: the fields it returns are added to the entry, and to the entries of the child loggers.                        |

`getMergingObject` adds context known at log time, e.g. the ID of the current request:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

const logger = new KuzzleLogger({
  getMergingObject: () => requestContext.getStore() ?? {},
});
```

Its fields take precedence over the fields of the logged object.

::: info
The type also has a `skipPinoInstance` property, used internally to create child loggers. Do not set it.
:::
