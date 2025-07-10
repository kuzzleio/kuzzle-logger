import { pino } from 'pino';
import { PinoTransportEcsOptions } from 'pino-transport-ecs/dist/types';
import { GlobalSettings, TransportMultiOptionsWithPreset } from './types/KuzzleLoggerConfig';
import { TransportPresetOptions } from './types/KuzzleLoggerPresets';

export abstract class Presets {
  static expandPresets(
    transport:
      | pino.TransportSingleOptions
      | TransportMultiOptionsWithPreset
      | pino.TransportPipelineOptions
      | TransportPresetOptions,
    globalSettings: GlobalSettings,
  ): pino.TransportSingleOptions | pino.TransportMultiOptions | pino.TransportPipelineOptions {
    // config is a TransportPresetOptions
    if ('preset' in transport) {
      return this.getPresetConfig(transport, globalSettings);
    }

    // config is a TransportMultiOptionsWithPreset
    if ('targets' in transport) {
      return {
        ...transport,
        targets: transport.targets.map((t) => {
          if ('preset' in t) {
            return this.expandPresets(t, globalSettings);
          }

          return t;
        }),
      } as pino.TransportMultiOptions;
    }

    // config is a TransportSingleOptions or a TransportPipelineOptions
    return transport;
  }

  static getPresetConfig(
    transport: TransportPresetOptions,
    globalSettings: GlobalSettings,
  ): pino.TransportSingleOptions | pino.TransportMultiOptions | pino.TransportPipelineOptions {
    const preset = transport.preset;
    switch (preset) {
      case 'stdout': {
        const env = process.env.NODE_ENV ?? 'development';

        if (env === 'development') {
          return {
            level: transport.level ?? 'info',
            options: {
              minimumLevel: 'trace',
            },
            target: 'pino-pretty',
          };
        }

        return {
          level: transport.level ?? 'info',
          options: { destination: 1 },
          target: 'pino/file',
        };
      }

      case 'kuzzle-elasticsearch': {
        const addKuzzleInfo = transport.presetOptions.addKuzzleInfo ?? true;
        const kuzzleInfo = addKuzzleInfo
          ? {
              _kuzzle_info: {
                author: -1,
                createdAt: '{{ currentDate }}',
                updatedAt: '{{ currentDate }}',
                updater: -1,
              },
            }
          : {};

        return {
          level: transport.level ?? 'info',
          pipeline: [
            {
              options: {
                additionalBindings: {
                  ...kuzzleInfo,
                },
                serviceName: globalSettings.serviceName,
              } satisfies PinoTransportEcsOptions,
              target: 'pino-transport-ecs',
            },
            {
              options: {
                esVersion: transport.presetOptions.esVersion ?? 8,
                index: transport.presetOptions.index ?? '&platform.logs',
                node: transport.presetOptions.node,
              },
              target: 'pino-elasticsearch',
            },
          ],
        };
      }

      case 'loki': {
        return {
          level: transport.level ?? 'info',
          options: {
            batching: transport.presetOptions.batching ?? true,
            headers: transport.presetOptions.headers ?? {},
            host: transport.presetOptions.host,
            interval: transport.presetOptions.interval ?? 1,
            labels: {
              ...(transport.presetOptions.labels ?? {}),
              service_name: globalSettings.serviceName,
            },
            levelMap: transport.presetOptions.levelMap ?? {
              10: 'trace',
              20: 'debug',
              30: 'info',
              40: 'warning',
              50: 'error',
              60: 'fatal',
            },
          },
          target: 'pino-loki',
        };
      }

      case 'file': {
        return {
          level: transport.level ?? 'info',
          options: {
            append: transport.presetOptions.append ?? true,
            destination: transport.presetOptions.destination,
            mkdir: transport.presetOptions.mkdir ?? true,
          },
          target: 'pino/file',
        };
      }

      default: {
        throw new Error(`Unknown preset: ${preset}`);
      }
    }
  }
}
