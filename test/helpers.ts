import { Logger, pino } from 'pino';

import { KuzzleLogger } from '../src/KuzzleLogger';
import { KuzzleLoggerConfig } from '../src/types/KuzzleLoggerConfig';

export type LogLine = Record<string, any>;

export type MemoryDestination = {
  lines: LogLine[];
  write: (chunk: string) => void;
};

export function createMemoryDestination(): MemoryDestination {
  const lines: LogLine[] = [];

  return {
    lines,
    write: (chunk: string) => {
      lines.push(JSON.parse(chunk));
    },
  };
}

/**
 * Creates a KuzzleLogger that writes synchronously to an in-memory destination,
 * without spawning a worker transport.
 */
export function createMemoryLogger(
  config: Omit<KuzzleLoggerConfig, 'skipPinoInstance' | 'transport'> = {},
  destination: {
    write: (chunk: string) => void;
    flush?: (cb: (err?: Error) => void) => void;
  } = createMemoryDestination(),
): { logger: KuzzleLogger; lines: LogLine[] } {
  const logger = new KuzzleLogger({ ...config, skipPinoInstance: true });

  // The pino setter is protected: tests inject an in-memory pino instance.
  (logger as unknown as { pino: Logger }).pino = pino(
    { level: config.level ?? 'info' },
    destination,
  );

  return {
    lines: (destination as MemoryDestination).lines ?? [],
    logger,
  };
}
