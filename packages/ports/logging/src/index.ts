export type LogMeta = Record<string, unknown>;

/**
 * LoggingPort — Decouples application logging from logging libraries.
 */
export interface LoggingPort {
  /** Log at debug level. */
  debug(message: string, meta?: LogMeta): void;
  /** Log at info level. */
  info(message: string, meta?: LogMeta): void;
  /** Log at warn level. */
  warn(message: string, meta?: LogMeta): void;
  /** Log at error level. */
  error(message: string, error?: Error | unknown, meta?: LogMeta): void;
}
