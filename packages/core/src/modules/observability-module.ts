/**
 * @mosaix/core — Observability module (T-EXT-02)
 *
 * Provides `logger` / `metrics` / `tracer` as extension services on the
 * KernelContext. The kernel installs this module by default (in-memory/console
 * implementations); a custom `ObservabilityModule` (production adapters:
 * pino, OTel) can substitute the seams without modifying the core.
 */

import { InMemoryGuard } from "@mosaix/support";
import { ConsoleLogger, InMemoryMetrics, InMemoryTracer, type Logger, type LogLevel, type Metrics, type Trace } from "../observability.js";
import type { KernelContext, KernelModule } from "../kernel-module.js";

export interface ObservabilityModuleOptions {
  /** Substitute the logger (default: ConsoleLogger). */
  logger?: Logger;
  /** Substitute the metrics channel (default: InMemoryMetrics). */
  metrics?: Metrics;
  /** Substitute the tracer (default: InMemoryTracer). */
  tracer?: Trace;
}

export class ObservabilityModule implements KernelModule {
  readonly name = "observability";
  readonly version = "1.0.0";
  private readonly options: ObservabilityModuleOptions;

  constructor(
    options: ObservabilityModuleOptions = {},
    private readonly logLevel?: LogLevel,
  ) {
    this.options = options;
  }

  register(ctx: KernelContext): void {
    const logLevel = this.logLevel ?? ctx.config.logLevel ?? "info";

    const logger = this.options.logger ?? new ConsoleLogger(logLevel);

    let metrics = this.options.metrics;
    if (!metrics) {
      InMemoryGuard.reportFallback("Metrics");
      metrics = new InMemoryMetrics();
    }

    let tracer = this.options.tracer;
    if (!tracer) {
      InMemoryGuard.reportFallback("Tracer");
      tracer = new InMemoryTracer();
    }

    ctx.setService("logger", logger);
    ctx.setService("metrics", metrics);
    ctx.setService("tracer", tracer);
  }
}
