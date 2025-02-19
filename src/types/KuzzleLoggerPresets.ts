import pino from 'pino';

export interface BasePresetOptions<TransportOptions = Record<string, any>>
  extends pino.TransportBaseOptions<TransportOptions> {
  preset: string;
}

export interface StdoutPresetOptions<TransportOptions = Record<string, any>>
  extends BasePresetOptions<TransportOptions> {
  preset: 'stdout';
}

export interface KuzzleElasticsearchPresetOptions<TransportOptions = Record<string, any>>
  extends BasePresetOptions<TransportOptions> {
  preset: 'kuzzle-elasticsearch';
  presetOptions: {
    addKuzzleInfo?: boolean;
    esVersion?: number;
    index?: string;
    node: string;
  };
}

export interface LokiPresetOptions<TransportOptions = Record<string, any>>
  extends BasePresetOptions<TransportOptions> {
  preset: 'loki';
  presetOptions: {
    batching?: boolean;
    headers?: Record<string, string>;
    host: string;
    interval?: number;
    labels?: Record<string, string>;
  };
}

export type TransportPresetOptions<TransportOptions = Record<string, any>> =
  | StdoutPresetOptions<TransportOptions>
  | KuzzleElasticsearchPresetOptions<TransportOptions>
  | LokiPresetOptions<TransportOptions>;
