---
code: false
type: root
order: 0
title: Kuzzle Logger
description: Kuzzle Logger Documentation
---

# Kuzzle Logger Documentation

The Kuzzle Logger is a powerful logging utility built on top of [Pino](https://github.com/pinojs/pino) that provides structured logging capabilities with multiple transport options and preset configurations.

## Installation

```bash
npm install kuzzle-logger
```

## Basic Usage

```typescript
import { KuzzleLogger } from 'kuzzle-logger';

// Create a logger with default configuration (stdout preset)
const logger = new KuzzleLogger({
  serviceName: 'my-service',
});

// Log messages with different levels
logger.info('Hello, world!');
logger.error({ err: new Error('Something went wrong') }, 'Error occurred');

// Log with additional context
logger.debug({ userId: '123', action: 'login' }, 'User login attempt');
```

For more detailed information about the API and configuration options, please refer to the specific documentation sections linked in the table of contents.
