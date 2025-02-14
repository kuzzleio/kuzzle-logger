import pino from 'pino';

export interface BasePresetOptions<TransportOptions = Record<string, any>>
  extends pino.TransportBaseOptions<TransportOptions> {
  preset: string;
}

export interface DefaultPresetOptions<TransportOptions = Record<string, any>>
  extends BasePresetOptions<TransportOptions> {
  preset: 'default';
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

export type TransportPresetOptions<TransportOptions = Record<string, any>> =
  | DefaultPresetOptions<TransportOptions>
  | KuzzleElasticsearchPresetOptions<TransportOptions>;
