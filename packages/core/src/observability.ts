/**
 * @mosaix/core — Native observability
 *
 * Structured logging, metrics and traces with OpenTelemetry-ready seams.
 * Default implementations are dependency-free (in-memory / console) so the
 * kernel is self-sufficient; production adapters (OTel, CloudWatch, …) can
 * replace them via a module without touching consumers.
 */

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

export class ConsoleLogger implements Logger {
  private readonly bound: Record<string, unknown> = {};
  private readonly minLevel: number;

  constructor(level: LogLevel = "info", bound: Record<string, unknown> = {}) {
    this.minLevel = LEVEL_ORDER[level];
    this.bound = bound;
  }

  child(fields: Record<string, unknown>): Logger {
    return new ConsoleLogger(this.minLevel as unknown as LogLevel, {
      ...this.bound,
      ...fields,
    });
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
    if (level === "error") {
      console.error(JSON.stringify(record));
    } else {
      console.log(JSON.stringify(record));
    }
  }
}

export interface Metrics {
  increment(
    counter: string,
    by?: number,
    fields?: Record<string, unknown>,
  ): void;
  gauge(name: string, value: number, fields?: Record<string, unknown>): void;
  snapshot(): Record<string, number>;
}

export class InMemoryMetrics implements Metrics {
  private readonly counters = new Map<string, number>();

  increment(counter: string, by = 1, fields?: Record<string, unknown>): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + by);
    if (fields && Object.keys(fields).length > 0) {
      const labeled = `${counter}${JSON.stringify(fields)}`;
      this.counters.set(labeled, (this.counters.get(labeled) ?? 0) + by);
    }
  }

  gauge(name: string, value: number, fields?: Record<string, unknown>): void {
    void fields;
    this.counters.set(name, value);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }
}

export type TraceStatus = "ok" | "error";

export interface KernelTrace {
  action: string;
  actor: string;
  tenant?: string;
  capability?: string;
  correlationId?: string;
  durationMs: number;
  status: TraceStatus;
  error?: string;
  timestamp: string;
}

export interface Trace {
  begin(action: string, init?: Partial<KernelTrace>): TraceSpan;
  list(): KernelTrace[];
  clear(): void;
}

export interface TraceSpan {
  readonly trace: KernelTrace;
  end(status: TraceStatus, error?: unknown): KernelTrace;
}

export class InMemoryTracer implements Trace {
  private readonly traces: KernelTrace[] = [];

  begin(action: string, init: Partial<KernelTrace> = {}): TraceSpan {
    const startedAt = Date.now();
    const trace: KernelTrace = {
      action,
      actor: init.actor ?? "kernel",
      durationMs: 0,
      status: "ok",
      timestamp: new Date().toISOString(),
      ...(init.tenant !== undefined ? { tenant: init.tenant } : {}),
      ...(init.capability !== undefined ? { capability: init.capability } : {}),
      ...(init.correlationId !== undefined
        ? { correlationId: init.correlationId }
        : {}),
    };
    return {
      trace,
      end: (status, error) => {
        trace.durationMs = Date.now() - startedAt;
        trace.status = status;
        if (error instanceof Error) trace.error = error.message;
        else if (error !== undefined) trace.error = String(error);
        this.traces.push(trace);
        return trace;
      },
    };
  }

  list(): KernelTrace[] {
    return [...this.traces];
  }

  clear(): void {
    this.traces.length = 0;
  }
}

/**
 * Bucket of the three observability seams (T-EXT-02). The kernel builds it with
 * in-memory/console defaults, then exposes each seam as an extension service
 * (`logger` / `metrics` / `tracer`) on the context so a custom
 * `ObservabilityModule` can substitute any of them without touching the core.
 */
export interface ObservabilitySet {
  logger: Logger;
  metrics: Metrics;
  tracer: Trace;
}

/** Build the default in-memory/console observability set (T-EXT-02). */
export function defaultObservability(logLevel: LogLevel): ObservabilitySet {
  return {
    logger: new ConsoleLogger(logLevel),
    metrics: new InMemoryMetrics(),
    tracer: new InMemoryTracer(),
  };
}
