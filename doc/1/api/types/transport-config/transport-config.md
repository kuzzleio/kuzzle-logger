---
code: true
type: page
title: TransportConfig type
description: Kuzzle Logger API - TransportConfig type
order: 200
---

# TransportConfig

Transport configuration types that determine how and where logs are written.

## Type Definition

The `TransportConfig` type can be one of the following:

```typescript
type TransportConfig =
  | TransportPresetOptions
  | TransportMultiOptionsWithPreset
  | pino.TransportSingleOptions
  | pino.TransportPipelineOptions;
```

## Types

### TransportPresetOptions

Configures a preset transport. See [PresetOptions](./preset-options.md) for details.

### TransportMultiOptionsWithPreset

```typescript
interface TransportMultiOptionsWithPreset {
  targets: readonly (
    | TransportPresetOptions
    | pino.TransportTargetOptions
    | pino.TransportPipelineOptions
  )[];
  levels?: Record<string, number>;
  dedupe?: boolean;
}
```

Configuration for multiple transports:

- `targets`: Array of transport configurations
- `levels`: Optional mapping of level names to their numeric values
- `dedupe`: Optional flag to enable/disable deduplication of logs

### TransportSingleOptions

```typescript
interface TransportSingleOptions {
  target: string;
  options?: object;
  level?: string;
}
```

Configuration for a single transport:

- `target`: The transport module name
- `options`: Optional configuration for the transport
- `level`: Optional minimum log level

### TransportPipelineOptions

```typescript
interface TransportPipelineOptions {
  pipeline: Array<{
    target: string;
    options?: object;
  }>;
}
```

Configuration for a pipeline of transports:

- `pipeline`: Array of transport configurations that will process logs in sequence

## Examples

### Using a Preset

```typescript
const config: TransportConfig = {
  preset: 'stdout',
  level: 'info',
};
```

### Using Multiple Transports

```typescript
const config: TransportConfig = {
  targets: [
    { preset: 'stdout' },
    {
      preset: 'loki',
      presetOptions: {
        host: 'http://localhost:3100',
      },
    },
  ],
  dedupe: true,
};
```

### Using a Single Transport

```typescript
const config: TransportConfig = {
  target: 'pino/file',
  options: {
    destination: '/var/log/app.log',
  },
};
```

### Using a Pipeline

```typescript
const config: TransportConfig = {
  pipeline: [
    {
      target: 'pino-transport-ecs',
      options: { serviceName: 'my-service' },
    },
    {
      target: 'pino-elasticsearch',
      options: {
        node: 'http://localhost:9200',
        index: 'logs',
      },
    },
  ],
};
```
