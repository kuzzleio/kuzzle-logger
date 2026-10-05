// Smoke tests of the built package (run `npm run build` first):
// - each entry point is imported from Node (CJS and ESM),
// - each entry point is type-checked with the bundler, node16, nodenext and node10
//   resolutions (node16 and nodenext catch a missing ".js" extension in the browser
//   declarations),
// - the browser entry is bundled by Vite, without Node built-ins, and tree-shaken.
//
// The bundle size is printed, and appended to the GitHub step summary in CI.
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

if (!existsSync(join(root, 'dist', 'esm', 'browser', 'index.js'))) {
  process.stderr.write('dist/ not found: run "npm run build" first\n');
  process.exit(1);
}

// realpath: on macOS, the temporary directory is behind a symlink, which confuses Vite
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'kuzzle-logger-smoke-')));
const write = (file, content) => writeFileSync(join(dir, file), content);
const run = (args) => execFileSync(process.execPath, args, { cwd: dir, stdio: 'inherit' });

function step(name, fn) {
  process.stdout.write(`- ${name}\n`);
  return fn();
}

try {
  mkdirSync(join(dir, 'node_modules'));
  symlinkSync(root, join(dir, 'node_modules', 'kuzzle-logger'), 'dir');
  write('package.json', '{ "private": true }');

  step('Node CJS: kuzzle-logger, kuzzle-logger/kuzzle, kuzzle-logger/dist and deep imports', () => {
    write(
      'cjs.cjs',
      `
      const assert = require('node:assert');
      assert.strictEqual(typeof require('kuzzle-logger').KuzzleLogger, 'function');
      assert.strictEqual(typeof require('kuzzle-logger/dist').KuzzleLogger, 'function');
      assert.strictEqual(typeof require('kuzzle-logger/kuzzle').validateBatch, 'function');
      // Deep imports, with and without extension (as with 1.4, before the exports map)
      assert.strictEqual(typeof require('kuzzle-logger/dist/index').KuzzleLogger, 'function');
      assert.strictEqual(typeof require('kuzzle-logger/dist/KuzzleLogger').KuzzleLogger, 'function');
      assert.strictEqual(typeof require('kuzzle-logger/dist/KuzzleLogger.js').KuzzleLogger, 'function');
      assert.strictEqual(typeof require('kuzzle-logger/dist/Presets').Presets, 'function');
      require('kuzzle-logger/dist/types/KuzzleLoggerConfig');
      `,
    );
    run(['cjs.cjs']);
  });

  step('Node ESM: every entry point', () => {
    write(
      'esm.mjs',
      `
      import assert from 'node:assert';
      import { KuzzleLogger } from 'kuzzle-logger';
      import { validateBatch } from 'kuzzle-logger/kuzzle';
      import { KuzzleLogger as BrowserLogger, PAYLOAD_VERSION } from 'kuzzle-logger/browser';
      import deep from 'kuzzle-logger/dist/KuzzleLogger';
      assert.strictEqual(typeof KuzzleLogger, 'function');
      assert.strictEqual(deep.KuzzleLogger, KuzzleLogger);
      const entries = [];
      new BrowserLogger({ console: false, sender: { send: (entry) => entries.push(entry) } }).info('hi');
      assert.strictEqual(entries[0].msg, 'hi');
      assert.strictEqual(typeof validateBatch, 'function');
      assert.strictEqual(PAYLOAD_VERSION, 1);
      `,
    );
    run(['esm.mjs']);
  });

  step('Types: bundler, node16, nodenext and node10 resolutions', () => {
    const imports = `
      import { KuzzleLogger, TransportConfig } from 'kuzzle-logger';
      import { KuzzleLogger as Legacy } from 'kuzzle-logger/dist';
      import { KuzzleLogger as Deep } from 'kuzzle-logger/dist/KuzzleLogger';
      import { KuzzleLogger as DeepJs } from 'kuzzle-logger/dist/KuzzleLogger.js';
      import { KuzzleLoggerConfig } from 'kuzzle-logger/dist/types/KuzzleLoggerConfig';
      import { validateBatch, BatchValidationResult } from 'kuzzle-logger/kuzzle';
      import { KuzzleLogger as BrowserLogger, PAYLOAD_VERSION, BrowserLogsPayload, VueErrorHandler, captureGlobalErrors, createVueErrorHandler } from 'kuzzle-logger/browser';
      const browserLogger: BrowserLogger = new BrowserLogger({ console: 'warn', level: 'debug' });
      browserLogger.child('map').error(new Error('boom'), 'failed %s', 'x');
      const stop: () => void = captureGlobalErrors(browserLogger, { dedupeInterval: 1000 });
      const errorHandler: VueErrorHandler = createVueErrorHandler(browserLogger, {
        dedupeInterval: 1000,
        previous: (err: unknown, instance: unknown, info: string) => {},
      });
      errorHandler(new Error('boom'), null, 'render function');
      stop();
      const payload: BrowserLogsPayload = { entries: [{ level: 'error' }], version: PAYLOAD_VERSION };
      const result: BatchValidationResult = validateBatch(payload);
      const transport: TransportConfig = { preset: 'stdout' };
      const config: KuzzleLoggerConfig = { level: 'info', transport };
      export const used = [KuzzleLogger, Legacy, Deep, DeepJs, config, result];
    `;
    write('types.ts', imports);
    write('types.mts', imports);

    const tsc = require.resolve('typescript/bin/tsc');
    const common = ['--noEmit', '--strict', '--skipLibCheck', 'false', '--target', 'es2022'];

    run([tsc, ...common, '--module', 'esnext', '--moduleResolution', 'bundler', 'types.ts']);
    run([tsc, ...common, '--module', 'node16', '--moduleResolution', 'node16', 'types.mts']);
    run([tsc, ...common, '--module', 'nodenext', '--moduleResolution', 'nodenext', 'types.mts']);
    run([tsc, ...common, '--module', 'commonjs', '--moduleResolution', 'node10', 'types.ts']);
  });

  await step('Vite: browser bundle', async () => {
    const { build } = await import('vite');

    async function bundle(name, source) {
      write(`${name}.html`, `<script type="module" src="./${name}.js"></script>`);
      write(`${name}.js`, source);

      const output = await build({
        build: {
          emptyOutDir: false,
          minify: true,
          modulePreload: { polyfill: false },
          rollupOptions: { input: join(dir, `${name}.html`) },
          write: false,
        },
        configFile: false,
        logLevel: 'warn',
        root: dir,
      });
      const code = output.output
        .filter((file) => file.type === 'chunk')
        .map((chunk) => chunk.code)
        .join('\n');

      if (code.includes('__vite-browser-external')) {
        throw new Error(`${name}: the browser bundle references Node built-ins`);
      }

      return code;
    }

    const minimal = await bundle(
      'minimal',
      `import { PAYLOAD_VERSION } from 'kuzzle-logger/browser';\nconsole.log(PAYLOAD_VERSION);\n`,
    );

    if (minimal.includes('fatal')) {
      throw new Error('the browser entry is not tree-shaken (unused BROWSER_LOG_LEVELS kept)');
    }

    const full = await bundle(
      'full',
      `import * as logger from 'kuzzle-logger/browser';\nconsole.log(logger);\n`,
    );
    if (!full.includes('fatal')) {
      throw new Error('the tree-shaking check is broken: BROWSER_LOG_LEVELS not found');
    }

    const size = (code) => `${Buffer.byteLength(code)} B (${gzipSync(code).length} B gzip)`;
    const report = [
      '### kuzzle-logger/browser bundle size (Vite, minified)',
      '',
      '| Import | Size |',
      '|---|---|',
      `| Whole entry | ${size(full)} |`,
      `| Single constant (tree-shaking) | ${size(minimal)} |`,
      '',
    ].join('\n');

    process.stdout.write(`${report}\n`);

    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
    }
  });

  process.stdout.write('Smoke tests passed\n');
} finally {
  rmSync(dir, { force: true, recursive: true });
}
