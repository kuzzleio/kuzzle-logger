---
code: false
type: page
title: Preset options
description: Kuzzle Logger API - Preset options
order: 300
---

# Preset Options

Types of the built-in presets. See [Presets](/modules/logger/1/guides/presets) for their behavior, defaults and examples.

```typescript
import { TransportPresetOptions } from 'kuzzle-logger';

type TransportPresetOptions =
  | StdoutPresetOptions
  | FilePresetOptions
  | LokiPresetOptions
  | KuzzleElasticsearchPresetOptions;

interface BasePresetOptions {
  preset: string;
  level?: string; // Defaults to 'info'
}
```

## StdoutPresetOptions

```typescript
interface StdoutPresetOptions extends BasePresetOptions {
  preset: 'stdout';
}
```

## FilePresetOptions

```typescript
interface FilePresetOptions extends BasePresetOptions {
  preset: 'file';
  presetOptions: {
    destination: string | number; // File path, or file descriptor
    mkdir?: boolean; // Defaults to true
    append?: boolean; // Defaults to true
  };
}
```

## LokiPresetOptions

```typescript
interface LokiPresetOptions extends BasePresetOptions {
  preset: 'loki';
  presetOptions: {
    host: string;
    labels?: Record<string, string>;
    propsToLabels?: string[];
    headers?: Record<string, string>;
    batching?: boolean; // Defaults to true
    interval?: number; // In seconds. Defaults to 1
    levelMap?: Record<number, string>;
  };
}
```

## KuzzleElasticsearchPresetOptions

```typescript
interface KuzzleElasticsearchPresetOptions extends BasePresetOptions {
  preset: 'kuzzle-elasticsearch';
  presetOptions: {
    node: string;
    index?: string; // Defaults to '&platform.logs'
    esVersion?: number; // Defaults to 8
    addKuzzleInfo?: boolean; // Defaults to true
  };
}
```
