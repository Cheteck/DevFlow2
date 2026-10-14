/**
 * @mosaix/dev-server — fact-based diagnostics. Every finding references an
 * actually observed condition; nothing claims an automatic root cause.
 */
import type { CommandCenterSnapshot, Diagnostic } from "./supervisor-types.js";

export function analyzeSnapshot(snapshot: CommandCenterSnapshot): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const service of snapshot.services) {
    if (service.state === "FAILED") {
      const failure = service.startupFailure ?? "startup failed";
      const portClash = /in use|EADDRINUSE/i.test(failure);
      out.push({
        level: "error",
        code: `${service.name.toUpperCase()}_STARTUP_FAILED`,
        message: `${service.label} failed to start: ${failure} — process alive but NOT serving.`,
        hint: portClash
          ? "Free the port (or set MOSAIX_PORT), then press R to restart."
          : "Fix the reported startup error, then press R to restart.",
      });
    }
    if (
      service.lastExitCode !== null &&
      service.lastExitCode !== 0 &&
      (service.state === "CRASHED" || service.state === "STOPPED")
    ) {
      out.push({
        level: "error",
        code: `${service.name.toUpperCase()}_NONZERO_EXIT`,
        message: `${service.label} exited with code ${service.lastExitCode}.`,
        hint: "Inspect the service logs above; fix the crash, then press R to restart.",
      });
    }
    if (service.state === "CRASHED") {
      out.push({
        level: "error",
        code: `${service.name.toUpperCase()}_CRASHED`,
        message: `${service.label} is not running (unexpected exit).`,
        hint: "Check the last error line on its card; auto-restart applies backoff.",
      });
    }
    if (service.state === "RUNNING" && service.readiness.includes("unknown")) {
      out.push({
        level: "warn",
        code: `${service.name.toUpperCase()}_READINESS_UNKNOWN`,
        message: `${service.label} is alive but readiness could not be confirmed.`,
        hint: "Process is up; no readiness signal is configured for this service.",
      });
    }
    if (
      service.name === "api" &&
      service.state === "RUNNING" &&
      !service.readiness.includes("unknown")
    ) {
      out.push({
        level: "warn",
        code: "API_READINESS_UNCONFIRMED",
        message:
          "Platform Server process is alive but never confirmed serving — not counted as up.",
        hint: "Check the logs for a listen error; press R after fixing.",
      });
    }
    if (service.restarts >= 4) {
      out.push({
        level: "warn",
        code: `${service.name.toUpperCase()}_RESTART_LOOP`,
        message: `${service.label} restarted ${service.restarts} times this session.`,
        hint: "If restarts keep climbing, stop (Q) and fix the underlying crash loop.",
      });
    }
    if (service.lastBootMs !== null && service.lastBootMs > 15_000) {
      out.push({
        level: "warn",
        code: `${service.name.toUpperCase()}_SLOW_BOOT`,
        message: `${service.label} took ${service.lastBootMs} ms to become ready.`,
        hint: "Compare with previous cycles (Restart Time Machine) to spot regressions.",
      });
    }
  }
  if (!snapshot.watch.active) {
    out.push({
      level: "warn",
      code: "WATCH_INACTIVE",
      message: "Environment watcher is not active.",
      hint: ".env edits will not trigger restarts until watching resumes (P).",
    });
  }
  const median = medianCycle(snapshot);
  const last = snapshot.cycles[0];
  if (median !== null && last?.endedAt !== null) {
    const duration = last.endedAt - last.startedAt;
    if (duration > median * 2 && duration > 2000) {
      out.push({
        level: "warn",
        code: "RESTART_SLOW",
        message: `Last restart took ${duration} ms vs ${median} ms median.`,
        hint: "Check which phase stretched in the cycle detail.",
      });
    }
  }
  return out;
}

function medianCycle(snapshot: CommandCenterSnapshot): number | null {
  const done = snapshot.cycles.filter(
    (c) => c.endedAt !== null && c.outcome === "completed",
  );
  if (done.length < 2) return null;
  const sorted = done
    .map((c) => (c.endedAt as number) - c.startedAt)
    .sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
