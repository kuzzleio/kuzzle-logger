---
code: true
type: page
title: TransportConfig type
description: Kuzzle Logger API - TransportConfig type
order: 200
---

# TransportConfig

Type of the `transport` option: where entries are written. See [Transport configuration](/modules/logger/1/guides/transport-configuration) for examples.

```typescript
import { TransportConfig } from 'kuzzle-logger';

type TransportConfig =
  | TransportPresetOptions
  | TransportMultiOptionsWithPreset
  | pino.TransportSingleOptions
  | pino.TransportPipelineOptions;
```

## TransportPresetOptions

A preset: `stdout`, `file`, `loki` or `kuzzle-elasticsearch`. See [Preset options](/modules/logger/1/api/types/preset-options).

## TransportMultiOptionsWithPreset

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

- `targets`: destinations, presets or Pino transports.
- `levels`: custom level names and their numeric values.
- `dedupe`: when `true`, an entry is only written to the target with the highest matching level.

## pino.TransportSingleOptions

```typescript
interface TransportSingleOptions {
  target: string;
  options?: object;
  level?: string;
}
```

- `target`: module name or path of the Pino transport.
- `options`: options passed to the transport.
- `level`: minimum level of the entries it receives.

## pino.TransportPipelineOptions

```typescript
interface TransportPipelineOptions {
  pipeline: Array<{
    target: string;
    options?: object;
  }>;
}
```

- `pipeline`: transports applied in sequence, the last one writes the entries.
