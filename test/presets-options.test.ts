import { describe, expect, it } from 'vitest';

import { KuzzleLogger } from '../src/KuzzleLogger';
import { Presets } from '../src/Presets';

describe('Presets required options', () => {
  it.each([
    ['kuzzle-elasticsearch', 'node'],
    ['loki', 'host'],
    ['file', 'destination'],
  ])('the "%s" preset fails explicitly without "presetOptions.%s"', (preset, option) => {
    const message = `The "${preset}" preset requires the "presetOptions.${option}" option`;

    expect(() => Presets.expandPresets({ preset } as any, {})).toThrow(message);
    expect(() => Presets.expandPresets({ preset, presetOptions: {} } as any, {})).toThrow(message);
    expect(() =>
      Presets.expandPresets({ preset, presetOptions: { [option]: null } } as any, {}),
    ).toThrow(message);
  });

  it('fails explicitly for a preset nested in targets', () => {
    expect(() =>
      Presets.expandPresets({ targets: [{ preset: 'stdout' }, { preset: 'loki' } as any] }, {}),
    ).toThrow('The "loki" preset requires the "presetOptions.host" option');
  });

  it('fails explicitly from the KuzzleLogger constructor', () => {
    expect(
      () => new KuzzleLogger({ skipPinoInstance: true, transport: { preset: 'loki' } as any }),
    ).toThrow('The "loki" preset requires the "presetOptions.host" option');
  });

  it('accepts a file descriptor as file destination', () => {
    expect(
      Presets.expandPresets({ preset: 'file', presetOptions: { destination: 0 } }, {}),
    ).toMatchObject({ options: { destination: 0 } });
  });
});

describe('loki preset labels', () => {
  const host = 'http://loki:3100';
  const labelsOf = (config: unknown) => (config as { options: { labels: object } }).options.labels;

  it('sets service_name from serviceName', () => {
    expect(
      labelsOf(
        Presets.expandPresets(
          { preset: 'loki', presetOptions: { host, labels: { app: 'my-app' } } },
          { serviceName: 'my-service' },
        ),
      ),
    ).toEqual({ app: 'my-app', service_name: 'my-service' });
  });

  it('does not set service_name when serviceName is not defined', () => {
    const labels = labelsOf(
      Presets.expandPresets(
        { preset: 'loki', presetOptions: { host, labels: { app: 'my-app' } } },
        {},
      ),
    );

    expect(labels).toEqual({ app: 'my-app' });
    expect(labels).not.toHaveProperty('service_name');
  });

  it('lets a user-provided service_name label take precedence', () => {
    expect(
      labelsOf(
        Presets.expandPresets(
          { preset: 'loki', presetOptions: { host, labels: { service_name: 'custom' } } },
          { serviceName: 'my-service' },
        ),
      ),
    ).toEqual({ service_name: 'custom' });
  });

  it('keeps a user-provided service_name label without serviceName', () => {
    expect(
      labelsOf(
        Presets.expandPresets(
          { preset: 'loki', presetOptions: { host, labels: { service_name: 'custom' } } },
          {},
        ),
      ),
    ).toEqual({ service_name: 'custom' });
  });
});
