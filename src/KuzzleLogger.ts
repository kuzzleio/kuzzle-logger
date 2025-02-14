import { JSONObject } from 'kuzzle-sdk';
import { Logger, pino } from 'pino';

import { Presets } from './Presets';
import { KuzzleLoggerConfig } from './types/KuzzleLoggerConfig';

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

    const transportConfig = Presets.expandPresets(config.transport ?? { preset: 'default' });

    const transport = pino.transport(transportConfig);

    this.pino = pino(transport);
  }

  /**
   * Logs a message with the "trace" level.
   *
   * @param obj - The object to log.
   * @param msg - An optional message to add to the logged object.
   * @param args - Additional arguments to log.
   */
  trace<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  trace(obj: unknown, msg?: string, ...args: any[]): void;
  trace(msg: string, ...args: any[]): void;
  trace(objOrMsg: any, ...args: any[]): void {
    if (typeof objOrMsg === 'object') {
      const additionalData = {
        ...objOrMsg,
        ...(this.isErrorLike(objOrMsg) ? {} : this.getMergingObject()),
      };
      const message = args.shift();
      this.pino.trace(additionalData, message, ...args);
      return;
    }
    this.pino.trace(this.getMergingObject(), objOrMsg, args);
  }

  /**
   * Logs a message with the "debug" level.
   *
   * @param obj - The object to log.
   * @param msg - An optional message to add to the logged object.
   * @param args - Additional arguments to log.
   */
  debug<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  debug(obj: unknown, msg?: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  debug(objOrMsg: any, ...args: any[]): void {
    if (typeof objOrMsg === 'object') {
      const additionalData = {
        ...objOrMsg,
        ...(this.isErrorLike(objOrMsg) ? {} : this.getMergingObject()),
      };
      const message = args.shift();
      this.pino.debug(additionalData, message, ...args);
      return;
    }
    this.pino.debug(this.getMergingObject(), objOrMsg, ...args);
  }

  /**
   * Logs a message with the "info" level.
   *
   * @param obj - The object to log.
   * @param msg - An optional message to add to the logged object.
   * @param args - Additional arguments to log.
   */
  info<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  info(obj: unknown, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  info(objOrMsg: any, ...args: any[]): void {
    if (typeof objOrMsg === 'object') {
      const additionalData = {
        ...objOrMsg,
        ...(this.isErrorLike(objOrMsg) ? {} : this.getMergingObject()),
      };
      const message = args.shift();
      this.pino.info(additionalData, message, ...args);
      return;
    }
    this.pino.info(this.getMergingObject(), objOrMsg, ...args);
  }

  /**
   * Logs a message with the "warn" level.
   *
   * @param obj - The object to log.
   * @param msg - An optional message to add to the logged object.
   * @param args - Additional arguments to log.
   */
  warn<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  warn(obj: unknown, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  warn(objOrMsg: any, ...args: any[]): void {
    if (typeof objOrMsg === 'object') {
      const additionalData = {
        ...objOrMsg,
        ...(this.isErrorLike(objOrMsg) ? {} : this.getMergingObject()),
      };
      const message = args.shift();
      this.pino.warn(additionalData, message, ...args);
      return;
    }
    this.pino.warn(this.getMergingObject(), objOrMsg, ...args);
  }

  /**
   * Logs a message with the "error" level.
   *
   * @param obj - The object to log.
   * @param msg - An optional message to add to the logged object.
   * @param args - Additional arguments to log.
   */
  error<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  error(obj: unknown, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  error(objOrMsg: any, ...args: any[]): void {
    if (typeof objOrMsg === 'object') {
      const additionalData = {
        ...objOrMsg,
        ...(this.isErrorLike(objOrMsg) ? {} : this.getMergingObject()),
      };
      const message = args.shift();
      this.pino.error(additionalData, message, ...args);
      return;
    }
    this.pino.error(this.getMergingObject(), objOrMsg, ...args);
  }

  /**
   * Logs a message with the "fatal" level.
   *
   * @param obj - The object to log.
   * @param msg - An optional message to add to the logged object.
   * @param args - Additional arguments to log.
   */
  fatal<T extends object>(obj: T, msg?: string, ...args: any[]): void;
  fatal(obj: unknown, msg?: string, ...args: any[]): void;
  fatal(msg: string, ...args: any[]): void;
  fatal(objOrMsg: any, ...args: any[]): void {
    if (typeof objOrMsg === 'object') {
      const additionalData = {
        ...objOrMsg,
        ...(this.isErrorLike(objOrMsg) ? {} : this.getMergingObject()),
      };
      const message = args.shift();
      this.pino.fatal(additionalData, message, ...args);
      return;
    }
    this.pino.fatal(this.getMergingObject(), objOrMsg, ...args);
  }

  get level(): typeof this.pino.level {
    return this.pino.level;
  }

  set level(level: typeof this.pino.level) {
    this.pino.level = level;
  }

  private isErrorLike(err: { message?: any }): err is Error {
    return err && typeof err.message === 'string';
  }
}
