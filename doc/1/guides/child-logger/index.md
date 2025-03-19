---
code: false
type: page
title: Child logger
description: Child logger
order: 400
---

# Child Logger

The Kuzzle Logger provides a child logger functionality that allows you to create namespaced loggers. This is particularly useful when you want to organize logs by different components or modules of your application.

## Creating a Child Logger

You can create a child logger using the `child()` method:

```typescript
const logger = new KuzzleLogger(config);
const childLogger = logger.child('myNamespace');
```

## Namespace Binding

The child logger automatically handles namespace binding:

- If the parent logger has no namespace, the child logger will use the provided namespace directly
- If the parent logger already has a namespace, the child logger will append its namespace to the parent's namespace using a colon (`:`) separator

For example:

```typescript
const logger = new KuzzleLogger(config);
const childLogger = logger.child('auth'); // namespace: "auth"
const grandChildLogger = childLogger.child('login'); // namespace: "auth:login"
```

## Usage Example

```typescript
const logger = new KuzzleLogger(config);
const authLogger = logger.child('auth');

// These logs will include the "auth" namespace
authLogger.info('User authentication started');
authLogger.error('Invalid credentials');

const loginLogger = authLogger.child('login');
// These logs will include the "auth:login" namespace
loginLogger.info('Login attempt');
loginLogger.debug('Validating credentials');
```

## Log Output

When using a child logger, the namespace will be included in the log output, making it easier to identify the source of each log entry. For example:

```json
{
  "level": 30,
  "namespace": "auth:login",
  "msg": "Login attempt",
  "time":1742371409983,
  ...
}
```
