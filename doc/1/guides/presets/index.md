---
code: false
type: page
title: Presets
description: Write logs to stdout, a file, Loki or Elasticsearch with the built-in presets
order: 200
---

# Presets

A preset is a ready-made destination: you name it in `transport` and give its options, Kuzzle Logger configures the underlying Pino transport.

```typescript
const logger = new KuzzleLogger({
  serviceName: 'my-service',
  transport: {
    preset: 'loki',
    level: 'info',
    presetOptions: { host: 'http://localhost:3100' },
  },
});
```

| Preset                 | Writes to                   | Requires                                   |
| ---------------------- | --------------------------- | ------------------------------------------ |
| `stdout` (default)     | Standard output             | `pino-pretty` in development               |
| `file`                 | A file or a file descriptor | –                                          |
| `loki`                 | Grafana Loki                | `pino-loki`                                |
| `kuzzle-elasticsearch` | Elasticsearch, in ECS       | `pino-elasticsearch`, `pino-transport-ecs` |

The transport packages are optional peer dependencies: install the ones your presets use. Every preset accepts a `level` (`info` by default). `loki`, `file` and `kuzzle-elasticsearch` throw an explicit error when their required option is missing.

To write to several destinations, or to use a Pino transport that has no preset, see [Transport configuration](/modules/logger/1/guides/transport-configuration). The option types are in [Preset options](/modules/logger/1/api/types/preset-options).

## stdout

```typescript
transport: {
  preset: 'stdout';
}
```

- When `NODE_ENV` is `development` or not set, entries are pretty-printed with `pino-pretty`, which must be installed (`npm install pino-pretty`).
- Otherwise, entries are written as JSON lines.

This is the preset used when `transport` is not set.

## file

```typescript
transport: {
  preset: 'file',
  presetOptions: { destination: '/var/log/my-app.log' },
}
```

| Option        | Default | Description                                                           |
| ------------- | ------- | --------------------------------------------------------------------- |
| `destination` | –       | Required. File path, or file descriptor (`1` = stdout, `2` = stderr). |
| `mkdir`       | `true`  | Creates the directory if needed.                                      |
| `append`      | `true`  | Appends to the file instead of overwriting it.                        |

Entries are written as JSON lines.

## loki

```typescript
transport: {
  preset: 'loki',
  presetOptions: {
    host: 'http://localhost:3100',
    labels: { environment: 'production' },
    propsToLabels: ['namespace'],
  },
}
```

| Option          | Default                         | Description                                                                                                       |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `host`          | –                               | Required. Loki URL.                                                                                               |
| `labels`        | –                               | Labels added to every stream. `service_name` is set from `serviceName`, unless `labels.service_name` is provided. |
| `propsToLabels` | –                               | Entry fields used as labels, e.g. `['namespace']`. Only use fields with few distinct values.                      |
| `headers`       | –                               | HTTP headers of the requests, e.g. `{ Authorization: 'Bearer ...' }`.                                             |
| `batching`      | `true`                          | Sends entries in batches.                                                                                         |
| `interval`      | `1`                             | Batching interval, in seconds.                                                                                    |
| `levelMap`      | Pino levels, `warn` → `warning` | Mapping of Pino numeric levels to Loki level names.                                                               |

See [Grafana dashboards](/modules/logger/1/guides/grafana-dashboards) for queries and a ready-made dashboard.

## kuzzle-elasticsearch

```typescript
transport: {
  preset: 'kuzzle-elasticsearch',
  presetOptions: { node: 'http://localhost:9200' },
}
```

| Option          | Default          | Description                                                              |
| --------------- | ---------------- | ------------------------------------------------------------------------ |
| `node`          | –                | Required. Elasticsearch URL.                                             |
| `index`         | `&platform.logs` | Index the entries are written to.                                        |
| `esVersion`     | `8`              | Elasticsearch major version.                                             |
| `addKuzzleInfo` | `true`           | Adds `_kuzzle_info` to each entry, like the documents written by Kuzzle. |

Entries are formatted with the Elastic Common Schema (ECS).
