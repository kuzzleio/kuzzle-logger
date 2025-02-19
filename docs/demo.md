```javascript
import { KuzzleLogger } from 'kuzzle-logger';

const logger = new KuzzleLogger({
  getMergingObject: () => ({ foo: 'bar' }),
  serviceName: 'my-service',
  transport: {
    targets: [
      {
        preset: 'stdout',
      },
      {
        presetOptions: {
          host: 'http://localhost:3100',
        },
        preset: 'pino-loki',
      },
    ],
  },
});

logger.warn({ baz: 'qux' }, 'This is a warning message');
logger.error('This is an %s message', 'error');

setInterval(() => {
  logger.info('This is an info message');
}, 10000);
```
