import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { encoding: 'utf8', recursive: true })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

describe('packaging', () => {
  it.each(['pino-elasticsearch', 'pino-loki', 'pino-pretty', 'pino-transport-ecs'])(
    'declares the %s transport as an optional peer dependency',
    (name) => {
      expect(pkg.peerDependencies).toHaveProperty(name);
      expect(pkg.peerDependenciesMeta[name]).toEqual({ optional: true });
    },
  );

  it('only imports runtime or peer dependencies from the sources', () => {
    const allowed = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ]);
    const forbidden: string[] = [];

    for (const file of listSourceFiles(join(root, 'src'))) {
      const content = readFileSync(file, 'utf8');

      for (const [, specifier] of content.matchAll(/from\s+'([^']+)'/g)) {
        if (
          specifier.startsWith('.') ||
          specifier.startsWith('node:') ||
          builtinModules.includes(specifier)
        ) {
          continue;
        }

        if (!allowed.has(packageName(specifier))) {
          forbidden.push(`${file.slice(root.length + 1)}: ${specifier}`);
        }
      }
    }

    expect(forbidden).toEqual([]);
  });
});
