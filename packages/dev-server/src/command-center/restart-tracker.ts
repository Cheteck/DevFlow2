/**
 * @mosaix/dev-server — Restart Time Machine: bounded in-memory history of
 * restart cycles with genuinely measured step durations.
 */
import type {
  RestartCycle,
  RestartOutcome,
  ServiceName,
} from "./supervisor-types.js";
import { redactSecrets } from "./secret-guard.js";

export const DEFAULT_CYCLE_CAP = 20;

export class RestartTracker {
  private cycles: RestartCycle[] = [];
  private nextId = 1;

  constructor(private readonly cap: number = DEFAULT_CYCLE_CAP) {}

  begin(scope: ServiceName | "all", reason: string): RestartCycle {
    const cycle: RestartCycle = {
      id: this.nextId++,
      scope,
      reason: redactSecrets(reason),
      startedAt: Date.now(),
      endedAt: null,
      phases: {
        detectedAt: Date.now(),
        debounceDoneAt: null,
        stopRequestedAt: null,
        spawnedAt: null,
        readyAt: null,
      },
      events: [],
      outcome: "completed",
      exitCodes: [],
      errors: [],
    };
    this.cycles.push(cycle);
    if (this.cycles.length > this.cap) {
      this.cycles.splice(0, this.cycles.length - this.cap);
    }
    return cycle;
  }

  mark(
    cycle: RestartCycle,
    phase: "debounceDoneAt" | "stopRequestedAt" | "spawnedAt" | "readyAt",
  ): void {
    cycle.phases[phase] = Date.now();
  }

  note(cycle: RestartCycle, text: string): void {
    cycle.events.push(redactSecrets(text));
  }

  fail(cycle: RestartCycle, error: string): void {
    cycle.errors.push(redactSecrets(error));
  }

  finish(cycle: RestartCycle, outcome: RestartOutcome): void {
    cycle.outcome = outcome;
    cycle.endedAt = Date.now();
  }

  getCycles(): RestartCycle[] {
    return [...this.cycles].reverse();
  }

  get size(): number {
    return this.cycles.length;
  }

  /** Median completed-cycle duration, for "slower than usual" detection. */
  medianDurationMs(): number | null {
    const done = this.cycles.filter(
      (c) => c.endedAt !== null && c.outcome === "completed",
    );
    if (done.length === 0) return null;
    const durations = done
      .map((c) => (c.endedAt as number) - c.startedAt)
      .sort((a, b) => a - b);
    return durations[Math.floor(durations.length / 2)];
  }

  formatCycle(cycle: RestartCycle): string[] {
    const total =
      cycle.endedAt !== null
        ? cycle.endedAt - cycle.startedAt
        : Date.now() - cycle.startedAt;
    const at = (t: number | null) =>
      t === null ? "—" : `${t - cycle.startedAt} ms`;
    return [
      `RESTART #${String(cycle.id).padStart(3, "0")} — ${total} ms [${cycle.outcome}] (${cycle.scope})`,
      `00 ms : trigger — ${cycle.reason}`,
      `${at(cycle.phases.debounceDoneAt)} : debounce finished`,
      `${at(cycle.phases.stopRequestedAt)} : stop requested`,
      `${at(cycle.phases.spawnedAt)} : new process spawned`,
      `${at(cycle.phases.readyAt)} : ready per configured criteria`,
    ];
  }
}
