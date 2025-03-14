---
code: false
type: page
title: Presets
description: Presets
order: 200
---

# Presets

Kuzzle Logger comes with several built-in presets that provide pre-configured transport options for common use cases.

## Available Presets

### 1. Stdout Preset

The default preset that outputs logs to the standard output.

```typescript
{
  preset: 'stdout';
  level?: string;
}
```

#### Behavior

- In development environment (`NODE_ENV=development`):
  - Uses `pino-pretty` for formatted output
  - Minimum level set to `trace`
- In other environments:
  - Uses `pino/file` with destination to stdout
  - Default level is `info`

### 2. Kuzzle Elasticsearch Preset

Configures logging to Elasticsearch with Kuzzle-specific formatting.

```typescript
{
  preset: 'kuzzle-elasticsearch';
  level?: string;
  presetOptions: {
    addKuzzleInfo?: boolean;  // Defaults to true
    esVersion?: number;       // Defaults to 8
    index?: string;          // Defaults to '&platform.logs'
    node: string;            // Required - Elasticsearch node URL
  };
}
```

#### Features

- Automatically adds Kuzzle metadata (can be disabled)
- Uses ECS (Elastic Common Schema) formatting
- Configurable Elasticsearch version and index

### 3. Loki Preset

Configures logging to Grafana Loki.

```typescript
{
  preset: 'loki';
  level?: string;
  presetOptions: {
    batching?: boolean;      // Defaults to true
    headers?: Record<string, string>;  // Custom HTTP headers
    host: string;           // Required - Loki host URL
    interval?: number;      // Defaults to 1000
    labels?: Record<string, string>;  // Custom labels
  };
}
```

An example of Loki dashboard is available [here](/logger/1/guides/grafana-dashboards#Loki).

## Usage Examples

### Stdout Preset

```typescript
const logger = new KuzzleLogger({
  transport: {
    preset: 'stdout',
    level: 'debug',
  },
});
```

### Kuzzle Elasticsearch Preset

```typescript
const logger = new KuzzleLogger({
  serviceName: 'my-service',
  transport: {
    preset: 'kuzzle-elasticsearch',
    presetOptions: {
      node: 'http://localhost:9200',
      index: 'my-app-logs',
      esVersion: 8,
      addKuzzleInfo: true,
    },
  },
});
```

### Loki Preset

```typescript
const logger = new KuzzleLogger({
  serviceName: 'my-service',
  transport: {
    preset: 'loki',
    presetOptions: {
      host: 'http://localhost:3100',
      labels: {
        environment: 'production',
        app: 'my-app',
      },
      headers: {
        Authorization: 'Bearer token',
      },
    },
  },
});
```

## Combining Presets

You can use multiple presets together using the multiple transports configuration:

```typescript
const logger = new KuzzleLogger({
  transport: {
    targets: [
      {
        preset: 'stdout',
        level: 'debug',
      },
      {
        preset: 'loki',
        level: 'info',
        presetOptions: {
          host: 'http://localhost:3100',
        },
      },
    ],
  },
});
```
