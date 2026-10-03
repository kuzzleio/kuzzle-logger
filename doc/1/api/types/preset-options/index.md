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

- When `NODE_ENV` is `development` or not set: entries are pretty-printed with `pino-pretty`, which must be installed.
- Otherwise: entries are written to stdout as JSON lines.
- The default level is `info`.

### FilePresetOptions

```typescript
interface FilePresetOptions extends BasePresetOptions {
  preset: 'file';
  presetOptions: {
    destination: string | number; // File path to write logs
    mkdir?: boolean; // Whether to create directory if it doesn't exist (defaults to true)
    append?: boolean; // Whether to append to file instead of overwriting (defaults to true)
  };
}
```

#### Properties

- `destination`: File path where logs will be written (required). If a number is provided, it will be treated as a file descriptor (e.g., `1` for stdout and `2` for stderr).
- `mkdir`: Whether to create the directory if it doesn't exist (defaults to true)
- `append`: Whether to append to the file instead of overwriting (defaults to true)

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
    propsToLabels?: string[];
  };
}
```

Configures logging to Grafana Loki.

#### Properties

- `batching`: Whether to enable log batching (defaults to true)
- `headers`: Custom HTTP headers to send with requests
- `host`: Loki host URL (required)
- `interval`: Batch sending interval in seconds (defaults to 1)
- `labels`: Custom labels to add to log entries. The `service_name` label is set from `serviceName` when it is defined; a `service_name` provided here takes precedence
- `levelMap`: Custom mapping of numeric levels to string names
- `propsToLabels`: Log entry properties to use as Loki labels (e.g. `["namespace"]`). Only use low-cardinality properties

## Examples

### Stdout Preset

```typescript
const config = {
  preset: 'stdout',
  level: 'debug',
};
```

### File Preset

```typescript
const config = {
  preset: 'file',
  presetOptions: {
    destination: '/var/log/my-app.log',
    mkdir: true, // Create directory if it doesn't exist
    append: true, // Append to file instead of overwriting
  },
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
    interval: 2,
    propsToLabels: ['nodeId', 'namespace'],
  },
};
```
