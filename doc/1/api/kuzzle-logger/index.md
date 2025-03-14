---
code: true
type: page
title: KuzzleLogger class
description: Kuzzle Logger API - KuzzleLogger class
order: 100
---

# KuzzleLogger

The main class that provides logging functionality for Kuzzle.

## Constructor

```typescript
constructor(config: KuzzleLoggerConfig)
```

### Parameters

- `config`: Configuration object (see [KuzzleLoggerConfig](./types/kuzzle-logger-config.md))

## Properties

### level

```typescript
get level(): string
set level(level: string)
```

Get or set the current logging level. Valid levels are:

- `'fatal'`
- `'error'`
- `'warn'`
- `'info'`
- `'debug'`
- `'trace'`

### pino

```typescript
get pino(): Logger
```

Get the underlying Pino logger instance.

## Methods

### Logging Methods

All logging methods share similar signatures:

```typescript
method(obj: object, msg?: string, ...args: any[]): void
method(obj: unknown, msg?: string, ...args: any[]): void
method(msg: string, ...args: any[]): void
```

- `trace()`: Log at trace level
- `debug()`: Log at debug level
- `info()`: Log at info level
- `warn()`: Log at warn level
- `error()`: Log at error level
- `fatal()`: Log at fatal level

Each method can be called in multiple ways:

1. With an object and optional message:
   ```typescript
   logger.info({ user: 'john' }, 'User logged in');
   ```
2. With just a message:
   ```typescript
   logger.info('System started');
   ```
3. With an error object:
   ```typescript
   logger.error(new Error('Connection failed'));
   ```

### flush()

```typescript
async flush(): Promise<void>
```

Flushes any buffered logs to their destination.

### child(namespace: string)

```typescript
child(namespace: string): KuzzleLogger
```

Creates a child logger with the specified namespace. The child logger inherits all settings from its parent and adds the namespace to the merging object.
