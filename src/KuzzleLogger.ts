import { JSONObject } from 'kuzzle-sdk';
import { Logger, pino } from 'pino';

import { Presets } from './Presets';
import { KuzzleLoggerConfig } from './types/KuzzleLoggerConfig';

/**
 * The Logger class provides logging functionality for Kuzzle.
 */
export class KuzzleLogger {
  private _pino: Logger;

  get level(): typeof this._pino.level {
    return this._pino.level;
  }

  set level(level: typeof this._pino.level) {
    this._pino.level = level;
  }

  get pino(): Logger {
    return this._pino;
  }

  protected set pino(pinoInstance: Logger) {
    this._pino = pinoInstance;
  }

  private getMergingObject: () => JSONObject = () => ({});

  constructor(config: KuzzleLoggerConfig) {
    const { transport, getMergingObject, skipPinoInstance, ...globalSettings } = config;

    if (getMergingObject) {
      this.getMergingObject = getMergingObject;
    }

    const transportConfig = Presets.expandPresets(
      transport ?? { preset: 'stdout' },
      globalSettings,
    );

    if (!skipPinoInstance) {
      this._pino = pino(pino.transport(transportConfig));
    }
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
      this._pino.trace(additionalData, message, ...args);
      return;
    }
    this._pino.trace(this.getMergingObject(), objOrMsg, args);
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
      this._pino.debug(additionalData, message, ...args);
      return;
    }
    this._pino.debug(this.getMergingObject(), objOrMsg, ...args);
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
      this._pino.info(additionalData, message, ...args);
      return;
    }
    this._pino.info(this.getMergingObject(), objOrMsg, ...args);
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
      this._pino.warn(additionalData, message, ...args);
      return;
    }
    this._pino.warn(this.getMergingObject(), objOrMsg, ...args);
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
      this._pino.error(additionalData, message, ...args);
      return;
    }
    this._pino.error(this.getMergingObject(), objOrMsg, ...args);
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
      this._pino.fatal(additionalData, message, ...args);
      return;
    }
    this._pino.fatal(this.getMergingObject(), objOrMsg, ...args);
  }

  async flush(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._pino.flush((err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  child(namespace: string): KuzzleLogger {
    const currentMergingObject = this.getMergingObject();
    const newNamespace = currentMergingObject?.namespace
      ? `${currentMergingObject.namespace}:${namespace}`
      : namespace;

    const childLogger = new KuzzleLogger({
      getMergingObject: () => ({
        ...currentMergingObject,
        namespace: newNamespace,
      }),
      skipPinoInstance: true,
    });

    childLogger.pino = this.pino.child({});

    return childLogger;
  }

  private isErrorLike(err: { message?: any }): err is Error {
    return err && typeof err.message === 'string';
  }
}
