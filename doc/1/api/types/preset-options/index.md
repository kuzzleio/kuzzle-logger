---
code: false
type: page
title: Preset options
description: Kuzzle Logger API - Preset options
order: 300
---

# Preset Options

Configuration types for the built-in transport presets.

## Base Type

```typescript
interface BasePresetOptions {
  preset: string;
  level?: string;
}
```

All preset options extend this base type with their specific configurations.

## Available Presets

### StdoutPresetOptions

```typescript
interface StdoutPresetOptions extends BasePresetOptions {
  preset: 'stdout';
}
```

The default preset that outputs logs to the standard output.

#### Behavior

- In development environment (`NODE_ENV=development`):
  - Uses `pino-pretty` for formatted output
  - Minimum level set to `trace`
- In other environments:
  - Uses `pino/file` with destination to stdout
  - Default level is `info`

### KuzzleElasticsearchPresetOptions

```typescript
interface KuzzleElasticsearchPresetOptions extends BasePresetOptions {
  preset: 'kuzzle-elasticsearch';
  presetOptions: {
    addKuzzleInfo?: boolean;
    esVersion?: number;
    index?: string;
    node: string;
  };
}
```

Configures logging to Elasticsearch with Kuzzle-specific formatting.

#### Properties

- `addKuzzleInfo`: Whether to add Kuzzle metadata (defaults to true)
- `esVersion`: Elasticsearch version (defaults to 8)
- `index`: Index name (defaults to '&platform.logs')
- `node`: Elasticsearch node URL (required)

### LokiPresetOptions

```typescript
interface LokiPresetOptions extends BasePresetOptions {
  preset: 'loki';
  presetOptions: {
    batching?: boolean;
    headers?: Record<string, string>;
    host: string;
    interval?: number;
    labels?: Record<string, string>;
    levelMap?: Record<number, string>;
  };
}
```

Configures logging to Grafana Loki.

#### Properties

- `batching`: Whether to enable log batching (defaults to true)
- `headers`: Custom HTTP headers to send with requests
- `host`: Loki host URL (required)
- `interval`: Batch sending interval in milliseconds (defaults to 1000)
- `labels`: Custom labels to add to log entries
- `levelMap`: Custom mapping of numeric levels to string names

## Examples

### Stdout Preset

```typescript
const config = {
  preset: 'stdout',
  level: 'debug',
};
```

### Elasticsearch Preset

```typescript
const config = {
  preset: 'kuzzle-elasticsearch',
  presetOptions: {
    node: 'http://localhost:9200',
    index: 'my-app-logs',
    esVersion: 8,
  },
};
```

### Loki Preset

```typescript
const config = {
  preset: 'loki',
  presetOptions: {
    host: 'http://localhost:3100',
    labels: {
      app: 'my-app',
      environment: 'production',
    },
    batching: true,
    interval: 2000,
  },
};
```
