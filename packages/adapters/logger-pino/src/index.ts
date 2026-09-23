import pino from "pino";
import type { LoggingPort, LogMeta } from "@mosaix/ports-logging";

export class PinoLoggerAdapter implements LoggingPort {
  private readonly logger: pino.Logger;

  constructor(
    options?: pino.LoggerOptions,
    destination?: pino.DestinationStream,
  ) {
    this.logger = destination
      ? pino(options ?? { level: "info" }, destination)
      : pino(options ?? { level: "info" });
  }

  debug(message: string, meta?: LogMeta): void {
    if (meta) {
      this.logger.debug(meta, message);
    } else {
      this.logger.debug(message);
    }
  }

  info(message: string, meta?: LogMeta): void {
    if (meta) {
      this.logger.info(meta, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, meta?: LogMeta): void {
    if (meta) {
      this.logger.warn(meta, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errorMeta =
      error instanceof Error
        ? { err: { message: error.message, stack: error.stack }, ...meta }
        : { err: error, ...meta };

    this.logger.error(errorMeta, message);
  }
}
