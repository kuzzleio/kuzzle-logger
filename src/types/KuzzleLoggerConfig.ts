import { JSONObject } from 'kuzzle-sdk';
import { pino } from 'pino';
import { TransportPresetOptions } from './KuzzleLoggerPresets';

export interface TransportMultiOptionsWithPreset<TransportOptions = Record<string, any>>
  extends pino.TransportBaseOptions<TransportOptions> {
  targets: readonly (
    | pino.TransportTargetOptions<TransportOptions>
    | pino.TransportPipelineOptions<TransportOptions>
    | TransportPresetOptions<TransportOptions>
  )[];
  levels?: Record<string, number>;
  dedupe?: boolean;
}

export type KuzzleLoggerConfig = {
  getMergingObject?: () => JSONObject;
  serviceName?: string;
  transport?:
    | pino.TransportSingleOptions
    | TransportMultiOptionsWithPreset
    | pino.TransportPipelineOptions
    | TransportPresetOptions;
};

export type GlobalSettings = Omit<KuzzleLoggerConfig, 'getMergingObject' | 'transport'>;
