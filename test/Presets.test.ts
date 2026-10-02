import { afterEach, describe, expect, it, vi } from 'vitest';

import { Presets } from '../src/Presets';

describe('Presets.expandPresets', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('stdout', () => {
    it('uses pino-pretty in development', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(Presets.expandPresets({ preset: 'stdout' }, {})).toEqual({
        level: 'info',
        options: { minimumLevel: 'trace' },
        target: 'pino-pretty',
      });
    });

    it('defaults to development when NODE_ENV is not set', () => {
      vi.stubEnv('NODE_ENV', undefined);

      expect(Presets.expandPresets({ preset: 'stdout' }, {})).toMatchObject({
        target: 'pino-pretty',
      });
    });

    it('writes JSON to stdout outside development', () => {
      vi.stubEnv('NODE_ENV', 'production');

      expect(Presets.expandPresets({ level: 'debug', preset: 'stdout' }, {})).toEqual({
        level: 'debug',
        options: { destination: 1 },
        target: 'pino/file',
      });
    });
  });

  describe('kuzzle-elasticsearch', () => {
    it('applies the defaults', () => {
      expect(
        Presets.expandPresets(
          { preset: 'kuzzle-elasticsearch', presetOptions: { node: 'http://es:9200' } },
          { serviceName: 'my-service' },
        ),
      ).toEqual({
        level: 'info',
        pipeline: [
          {
            options: {
              additionalBindings: {
                _kuzzle_info: {
                  author: -1,
                  createdAt: '{{ currentDate }}',
                  updatedAt: '{{ currentDate }}',
                  updater: -1,
                },
              },
              serviceName: 'my-service',
            },
            target: 'pino-transport-ecs',
          },
          {
            options: { esVersion: 8, index: '&platform.logs', node: 'http://es:9200' },
            target: 'pino-elasticsearch',
          },
        ],
      });
    });

    it('applies the preset options', () => {
      const config = Presets.expandPresets(
        {
          level: 'warn',
          preset: 'kuzzle-elasticsearch',
          presetOptions: {
            addKuzzleInfo: false,
            esVersion: 7,
            index: 'my-index.logs',
            node: 'http://es:9200',
          },
        },
        {},
      );

      expect(config).toMatchObject({ level: 'warn' });
      expect((config as any).pipeline[0].options.additionalBindings).toEqual({});
      expect((config as any).pipeline[1].options).toEqual({
        esVersion: 7,
        index: 'my-index.logs',
        node: 'http://es:9200',
      });
    });
  });

  describe('loki', () => {
    it('applies the defaults', () => {
      expect(
        Presets.expandPresets(
          { preset: 'loki', presetOptions: { host: 'http://loki:3100' } },
          { serviceName: 'my-service' },
        ),
      ).toEqual({
        level: 'info',
        options: {
          batching: true,
          headers: {},
          host: 'http://loki:3100',
          interval: 1,
          labels: { service_name: 'my-service' },
          levelMap: {
            10: 'trace',
            20: 'debug',
            30: 'info',
            40: 'warning',
            50: 'error',
            60: 'fatal',
          },
          propsToLabels: [],
        },
        target: 'pino-loki',
      });
    });

    it('applies the preset options', () => {
      const config = Presets.expandPresets(
        {
          level: 'debug',
          preset: 'loki',
          presetOptions: {
            batching: false,
            headers: { 'X-Scope-OrgID': 'tenant' },
            host: 'http://loki:3100',
            interval: 5,
            labels: { app: 'my-app' },
            levelMap: { 30: 'INFO' },
            propsToLabels: ['nodeId', 'namespace'],
          },
        },
        { serviceName: 'my-service' },
      );

      expect(config).toEqual({
        level: 'debug',
        options: {
          batching: false,
          headers: { 'X-Scope-OrgID': 'tenant' },
          host: 'http://loki:3100',
          interval: 5,
          labels: { app: 'my-app', service_name: 'my-service' },
          levelMap: { 30: 'INFO' },
          propsToLabels: ['nodeId', 'namespace'],
        },
        target: 'pino-loki',
      });
    });
  });

  describe('file', () => {
    it('applies the defaults', () => {
      expect(
        Presets.expandPresets(
          { preset: 'file', presetOptions: { destination: '/var/log/app.log' } },
          {},
        ),
      ).toEqual({
        level: 'info',
        options: { append: true, destination: '/var/log/app.log', mkdir: true },
        target: 'pino/file',
      });
    });

    it('applies the preset options', () => {
      expect(
        Presets.expandPresets(
          {
            level: 'error',
            preset: 'file',
            presetOptions: { append: false, destination: 2, mkdir: false },
          },
          {},
        ),
      ).toEqual({
        level: 'error',
        options: { append: false, destination: 2, mkdir: false },
        target: 'pino/file',
      });
    });
  });

  it('throws on an unknown preset', () => {
    expect(() => Presets.expandPresets({ preset: 'unknown' } as any, {})).toThrow(
      'Unknown preset: unknown',
    );
  });

  it('returns a raw single target unchanged', () => {
    const transport = { level: 'info', options: { foo: 'bar' }, target: 'my-transport' };

    expect(Presets.expandPresets(transport, {})).toBe(transport);
  });

  it('returns a raw pipeline unchanged', () => {
    const transport = {
      pipeline: [{ target: 'my-transform' }, { target: 'my-transport' }],
    };

    expect(Presets.expandPresets(transport, {})).toBe(transport);
  });

  it('expands presets in targets and keeps raw targets and pipelines', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const rawTarget = { level: 'info', options: {}, target: 'my-transport' };
    const rawPipeline = { pipeline: [{ target: 'my-transform' }, { target: 'my-transport' }] };

    const config = Presets.expandPresets(
      {
        dedupe: true,
        targets: [
          { preset: 'stdout' },
          rawTarget,
          { preset: 'loki', presetOptions: { host: 'http://loki:3100' } },
          rawPipeline,
          { preset: 'file', presetOptions: { destination: '/tmp/app.log' } },
        ],
      },
      { serviceName: 'my-service' },
    );

    expect(config).toMatchObject({ dedupe: true });
    expect((config as any).targets).toEqual([
      { level: 'info', options: { destination: 1 }, target: 'pino/file' },
      rawTarget,
      expect.objectContaining({
        options: expect.objectContaining({ host: 'http://loki:3100' }),
        target: 'pino-loki',
      }),
      rawPipeline,
      {
        level: 'info',
        options: { append: true, destination: '/tmp/app.log', mkdir: true },
        target: 'pino/file',
      },
    ]);
  });
});
