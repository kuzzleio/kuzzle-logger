// The package is CommonJS: mark the browser build as ESM for Node and bundlers.
import { writeFileSync } from 'node:fs';

writeFileSync(
  new URL('../dist/esm/package.json', import.meta.url),
  `${JSON.stringify({ sideEffects: false, type: 'module' }, null, 2)}\n`,
);
