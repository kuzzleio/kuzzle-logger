# API Reference

## KuzzleLogger

The main class that provides logging functionality.

### Constructor

```typescript
constructor(config: KuzzleLoggerConfig)
```

#### Parameters

- `config`: Configuration object with the following properties:
  - `serviceName?`: (string) Name of the service for identification in logs
  - `transport?`: Transport configuration (see [Transport Configuration](./transport-configuration.md))
  - `getMergingObject?`: () => JSONObject - Function that returns an object to merge with all log entries

### Methods

#### Logging Methods

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

#### Level Property

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

### Types

#### KuzzleLoggerConfig

```typescript
interface KuzzleLoggerConfig {
  getMergingObject?: () => JSONObject;
  serviceName?: string;
  transport?: TransportConfig;
}
```

#### TransportConfig

Can be one of:

- `TransportPresetOptions`
- `TransportMultiOptionsWithPreset`
- `pino.TransportSingleOptions`
- `pino.TransportPipelineOptions`

See [Transport Configuration](./transport-configuration.md) for more details.
