---
code: false
type: page
title: Transport configuration
description: Transport configuration
order: 100
---

# Transport Configuration

The Kuzzle Logger supports various transport configurations to determine how and where logs are written. You can use predefined presets or configure custom transports.

## Transport Types

### 1. Using Presets

```typescript
interface TransportPresetOptions {
  preset: 'stdout' | 'kuzzle-elasticsearch' | 'loki';
  level?: string;
  presetOptions?: PresetSpecificOptions;
}
```

See [Presets](/logger/1/guides/presets) for detailed preset configurations.

### 2. Multiple Transports

```typescript
interface TransportMultiOptionsWithPreset {
  targets: Array<
    TransportPresetOptions | pino.TransportTargetOptions | pino.TransportPipelineOptions
  >;
  levels?: Record<string, number>;
  dedupe?: boolean;
}
```

### 3. Single Transport

```typescript
interface TransportSingleOptions {
  target: string;
  options?: object;
  level?: string;
}
```

### 4. Pipeline Transport

```typescript
interface TransportPipelineOptions {
  pipeline: Array<{
    target: string;
    options?: object;
  }>;
}
```

## Examples

### Using Stdout Preset

```typescript
const logger = new KuzzleLogger({
  transport: {
    preset: 'stdout',
  },
});
```

### Using Multiple Transports

```typescript
const logger = new KuzzleLogger({
  transport: {
    targets: [
      {
        preset: 'stdout',
      },
      {
        preset: 'loki',
        presetOptions: {
          host: 'http://localhost:3100',
          labels: {
            app: 'my-app',
          },
        },
      },
    ],
  },
});
```

### Custom Transport

```typescript
const logger = new KuzzleLogger({
  transport: {
    target: 'pino/file',
    options: {
      destination: '/var/log/app.log',
    },
  },
});
```

### Pipeline Transport

```typescript
const logger = new KuzzleLogger({
  transport: {
    pipeline: [
      {
        target: 'pino-transport-ecs',
        options: {
          serviceName: 'my-service',
        },
      },
      {
        target: 'pino-elasticsearch',
        options: {
          node: 'http://localhost:9200',
          index: 'logs',
        },
      },
    ],
  },
});
```
