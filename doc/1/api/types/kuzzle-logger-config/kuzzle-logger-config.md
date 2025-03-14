---
code: true
type: page
title: KuzzleLoggerConfig interface
description: Kuzzle Logger API - KuzzleLoggerConfig interface
order: 100
---

# KuzzleLoggerConfig

Configuration type for the KuzzleLogger constructor.

## Type Definition

```typescript
interface KuzzleLoggerConfig {
  getMergingObject?: () => JSONObject;
  level?: string;
  serviceName?: string;
  skipPinoInstance?: boolean;
  transport?: TransportConfig;
}
```

## Properties

### getMergingObject

```typescript
getMergingObject?: () => JSONObject
```

Optional function that returns an object to merge with all log entries. This is useful for adding consistent metadata to all logs.

### level

```typescript
level?: string
```

The minimum log level to output. Valid values are:

- `'fatal'`
- `'error'`
- `'warn'`
- `'info'`
- `'debug'`
- `'trace'`

### serviceName

```typescript
serviceName?: string
```

Name of the service for identification in logs.

### skipPinoInstance

```typescript
skipPinoInstance?: boolean
```

If true, skips the creation of a Pino instance. This is used internally for child loggers.

### transport

```typescript
transport?: TransportConfig
```

Transport configuration that determines how and where logs are written. See [TransportConfig](./transport-config.md) for details.
