/**
 * @mosaix/core — Observability module (T-EXT-02)
 *
 * Provides `logger` / `metrics` / `tracer` as extension services on the
 * KernelContext. The kernel installs this module by default (in-memory/console
 * implementations); a custom `ObservabilityModule` (production adapters:
 * pino, OTel) can substitute the seams without modifying the core.
 */

import { defaultObservability } from "../observability";
import type {
  Logger,
  LogLevel,
  Metrics,
  ObservabilitySet,
  Trace,
} from "../observability";
import type { KernelContext, KernelModule } from "../kernel-module";

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
    const defaults = defaultObservability(
      this.logLevel ?? ctx.config.logLevel ?? "info",
    );
    const set: ObservabilitySet = {
      logger: this.options.logger ?? defaults.logger,
      metrics: this.options.metrics ?? defaults.metrics,
      tracer: this.options.tracer ?? defaults.tracer,
    };
    ctx.setService("logger", set.logger);
    ctx.setService("metrics", set.metrics);
    ctx.setService("tracer", set.tracer);
  }
}
