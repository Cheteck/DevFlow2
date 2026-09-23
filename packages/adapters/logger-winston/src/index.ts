import winston from "winston";
import type { LoggingPort, LogMeta } from "@mosaix/ports-logging";

export class WinstonLoggerAdapter implements LoggingPort {
  private readonly logger: winston.Logger;

  constructor(options?: winston.LoggerOptions) {
    this.logger = winston.createLogger(
      options ?? {
        level: "info",
        transports: [
          new winston.transports.Console({
            format: winston.format.json(),
          }),
        ],
      },
    );
  }

  debug(message: string, meta?: LogMeta): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errorMeta =
      error instanceof Error
        ? { err: { message: error.message, stack: error.stack }, ...meta }
        : { err: error, ...meta };

    this.logger.error(message, errorMeta);
  }
}
