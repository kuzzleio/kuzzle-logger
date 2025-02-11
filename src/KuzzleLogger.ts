import { JSONObject } from "kuzzle-sdk";
import { Logger, pino } from "pino";

import { Presets } from "./Presets";
import { KuzzleLoggerConfig } from "./types/KuzzleLoggerConfig";

/**
 * The Logger class provides logging functionality for Kuzzle.
 */
export class KuzzleLogger {
  private pino: Logger;

  private getMergingObject: () => JSONObject = () => ({});

  constructor(config: KuzzleLoggerConfig) {
    if (config.getMergingObject) {
      this.getMergingObject = config.getMergingObject;
    }

    const transportConfig = Presets.expandPresets(
      config.transport ?? { preset: "default" },
    );

    const transport = pino.transport(transportConfig);

    this.pino = pino(transport);
  }

  /**
   * Logs a message with the "trace" level.
   *
   * @param message - The message to log.
   */
  trace(message: string) {
    this.pino.trace(this.getMergingObject(), message);
  }

  /**
   * Logs a message with the "debug" level.
   *
   * @param message - The message to log.
   */
  debug(message: string) {
    this.pino.debug(this.getMergingObject(), message);
  }

  /**
   * Logs a message with the "info" level.
   *
   * @param message - The message to log.
   */
  info(message: string) {
    this.pino.info(this.getMergingObject(), message);
  }

  /**
   * Logs a message with the "warn" level.
   *
   * @param message - The message to log.
   */
  warn(message: string) {
    this.pino.warn(this.getMergingObject(), message);
  }

  /**
   * Logs a message with the "error" level.
   *
   * @param message - The message to log.
   */
  error(message: string | Error) {
    if (message instanceof Error) {
      this.pino.error(message);
    } else {
      this.pino.error(this.getMergingObject(), message);
    }
  }

  /**
   * Logs a message with the "fatal" level.
   *
   * @param message - The message to log.
   */
  fatal(message: string) {
    this.pino.fatal(this.getMergingObject(), message);
  }
}
