import { pino } from 'pino';
import { TransportMultiOptionsWithPreset } from './types/KuzzleLoggerConfig';
import { TransportPresetOptions } from './types/KuzzleLoggerPresets';

export abstract class Presets {
  static expandPresets(
    config:
      | pino.TransportSingleOptions
      | TransportMultiOptionsWithPreset
      | pino.TransportPipelineOptions
      | TransportPresetOptions,
  ): pino.TransportSingleOptions | pino.TransportMultiOptions | pino.TransportPipelineOptions {
    // config is a TransportPresetOptions
    if ('preset' in config) {
      return this.getPresetConfig(config);
    }

    // config is a TransportMultiOptionsWithPreset
    if ('targets' in config) {
      return {
        ...config,
        targets: config.targets.map((t) => {
          if ('preset' in t) {
            return this.expandPresets(t);
          }

          return t;
        }),
      } as pino.TransportMultiOptions;
    }

    // config is a TransportSingleOptions or a TransportPipelineOptions
    return config;
  }

  static getPresetConfig(
    config: TransportPresetOptions,
  ): pino.TransportSingleOptions | pino.TransportMultiOptions | pino.TransportPipelineOptions {
    const preset = config.preset;
    switch (preset) {
      case 'default': {
        const env = process.env.NODE_ENV ?? 'development';

        if (env === 'development') {
          return {
            options: {
              minimumLevel: 'trace',
            },
            target: 'pino-pretty',
          };
        }

        return {
          options: { destination: 1 },
          target: 'pino/file',
        };
      }

      case 'kuzzle-elasticsearch': {
        const addKuzzleInfo = config.presetOptions.addKuzzleInfo ?? true;
        const transportEcsOptions = addKuzzleInfo
          ? {
              options: {
                additionalBindings: {
                  _kuzzle_info: {
                    author: -1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    updater: -1,
                  },
                },
              },
            }
          : {};

        return {
          pipeline: [
            {
              ...transportEcsOptions,
              target: 'pino-transport-ecs',
            },
            {
              options: {
                esVersion: config.presetOptions.esVersion ?? 8,
                index: config.presetOptions.index ?? '&platform.logs',
                node: config.presetOptions.node,
              },
              target: 'pino-elasticsearch',
            },
          ],
        };
      }

      default: {
        throw new Error(`Unknown preset: ${preset}`);
      }
    }
  }
}
