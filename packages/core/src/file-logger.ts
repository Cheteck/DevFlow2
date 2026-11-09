/**
 * @mosaix/core — File logger
 *
 * Dependency-free `Logger` implementation that appends structured JSON-lines
 * to a rotating daily log file. Used by the dev server (`pnpm dev`) so that
 * supervisor + application logs are persisted to disk instead of vanishing
 * when the terminal closes.
 *
 * Dogfooding: implements the same `Logger` interface as `ConsoleLogger`, so
 * any consumer typed against `Logger` can swap in file output without change.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  fields?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class FileLogger implements Logger {
  private readonly bound: Record<string, unknown> = {};
  private readonly minLevel: number;
  private readonly logDir: string;
  private readonly fileName: string;

  constructor(
    level: LogLevel = "info",
    bound: Record<string, unknown> = {},
    options: { logDir?: string; fileName?: string } = {},
  ) {
    this.minLevel = LEVEL_ORDER[level];
    this.bound = bound;
    this.logDir = options.logDir ?? path.join(process.cwd(), ".mosaix", "logs");
    this.fileName = options.fileName ?? "dev.log";
    this.ensureDir();
  }

  child(fields: Record<string, unknown>): Logger {
    return new FileLogger(
      this.minLevel as unknown as LogLevel,
      { ...this.bound, ...fields },
      { logDir: this.logDir, fileName: this.fileName },
    );
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.log("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.log("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.log("error", message, fields);
  }

  private log(
    level: LogLevel,
    message: string,
    fields?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;
    const record: LogRecord = {
      level,
      message,
      timestamp: new Date().toISOString(),
      fields: { ...this.bound, ...fields },
    };
    this.append(JSON.stringify(record));
  }

  private ensureDir(): void {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch {
      // Directory may already exist or be unwritable; logging will degrade
      // gracefully on append failure.
    }
  }

  private append(line: string): void {
    const filePath = path.join(this.logDir, this.fileName);
    try {
      fs.appendFileSync(filePath, line + "\n", { encoding: "utf8" });
    } catch {
      // Best-effort: never crash the app because a log write failed.
    }
  }
}
