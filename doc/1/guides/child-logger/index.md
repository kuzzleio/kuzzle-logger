---
code: false
type: page
title: Child logger
description: Namespace the logs of each part of an application
order: 400
---

# Child Logger

`child(namespace)` returns a logger whose entries have a `namespace` field, to tell which part of the application wrote them. Namespaces are appended with `:`:

```typescript
const authLogger = logger.child('auth'); // namespace "auth"
const loginLogger = authLogger.child('login'); // namespace "auth:login"

loginLogger.info('Login attempt');
```

```json
{ "level": 30, "time": 1742371409983, "namespace": "auth:login", "msg": "Login attempt" }
```

In a Kuzzle application, `app.log` already has a namespace: `app.log.child('mqtt')` logs under `kuzzle:app:mqtt`.

- A child writes to the same transports as its parent, with the parent `getMergingObject` fields.
- Its level follows the parent level, even when the parent level changes later, until a level is set on the child (`child.level = 'debug'`).
- Keep namespaces static (`mqtt`, not `device-${deviceId}`): they are often used as labels, for example with the Loki `propsToLabels` option. Put the variable parts in the logged object.
