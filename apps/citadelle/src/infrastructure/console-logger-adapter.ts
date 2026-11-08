/**
 * @apps/citadelle — Console Logger Adapter
 *
 * Simple LoggingPort implementation using console.* for development.
 * Production should replace with a structured logging adapter.
 */

import type { LoggingPort, LogMeta } from "@mosaix/ports-logging";

export class ConsoleLoggerAdapter implements LoggingPort {
  private readonly prefix: string;

  constructor(prefix: string = "[citadelle]") {
    this.prefix = prefix;
  }

  debug(message: string, meta?: LogMeta): void {
    if (process.env.DEBUG) {
      console.log(`${this.prefix} [DEBUG] ${message}`, meta ? JSON.stringify(meta) : "");
    }
  }

  info(message: string, meta?: LogMeta): void {
    console.log(`${this.prefix} [INFO] ${message}`, meta ? JSON.stringify(meta) : "");
  }

  warn(message: string, meta?: LogMeta): void {
    console.warn(`${this.prefix} [WARN] ${message}`, meta ? JSON.stringify(meta) : "");
  }

  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errMsg = error instanceof Error ? error.stack || error.message : String(error);
    console.error(`${this.prefix} [ERROR] ${message}`, errMsg, meta ? JSON.stringify(meta) : "");
  }
}
