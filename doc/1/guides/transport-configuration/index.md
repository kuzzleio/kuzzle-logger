---
code: false
type: page
title: Transport configuration
description: Write to several destinations, or use any Pino transport
order: 300
---

# Transport Configuration

The `transport` option says where entries are written. It takes one of:

- a [preset](/modules/logger/1/guides/presets): `{ preset: 'loki', presetOptions: { ... } }`;
- several targets, presets or Pino transports: `{ targets: [...] }`;
- a Pino transport: `{ target: '...' }`, or a chain of them: `{ pipeline: [...] }`.

Without `transport`, entries are written to stdout (`stdout` preset). The types are in [TransportConfig](/modules/logger/1/api/types/transport-config).

## Several destinations

`targets` mixes presets and Pino transports. Each target can have its own `level`:

```typescript
const logger = new KuzzleLogger({
  level: 'debug',
  serviceName: 'my-service',
  transport: {
    targets: [
      { preset: 'stdout', level: 'debug' },
      {
        preset: 'loki',
        level: 'info',
        presetOptions: { host: 'http://localhost:3100' },
      },
    ],
  },
});
```

The logger `level` is applied first: a target only receives the entries at or above both levels.

## Pino transports

Any [Pino transport](https://getpino.io/#/docs/transports) can be used with `target` and its `options`:

```typescript
const logger = new KuzzleLogger({
  transport: {
    target: 'pino/file',
    options: { destination: '/var/log/app.log' },
  },
});
```

`pipeline` chains transports, each one transforming the entries before the next. This is what the `kuzzle-elasticsearch` preset does:

```typescript
const logger = new KuzzleLogger({
  transport: {
    pipeline: [
      { target: 'pino-transport-ecs', options: { serviceName: 'my-service' } },
      {
        target: 'pino-elasticsearch',
        options: { node: 'http://localhost:9200', index: 'logs' },
      },
    ],
  },
});
```
