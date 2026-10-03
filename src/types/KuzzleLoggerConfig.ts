import { pino } from 'pino';
import { JSONObject } from './JSONObject';
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

/**
 * Transport configuration: a preset, a Pino transport (single, multi or pipeline),
 * or several targets mixing presets and Pino targets.
 */
export type TransportConfig =
  | TransportPresetOptions
  | TransportMultiOptionsWithPreset
  | pino.TransportSingleOptions
  | pino.TransportPipelineOptions;

export type KuzzleLoggerConfig = {
  getMergingObject?: () => JSONObject;
  level?: pino.LevelWithSilent;
  serviceName?: string;
  skipPinoInstance?: boolean;
  transport?: TransportConfig;
};

export type GlobalSettings = Omit<KuzzleLoggerConfig, 'getMergingObject' | 'transport'>;
