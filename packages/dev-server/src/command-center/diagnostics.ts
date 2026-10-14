/**
 * @mosaix/dev-server — fact-based diagnostics. Every finding references an
 * actually observed condition; nothing claims an automatic root cause.
 * `at` is stamped by the supervisor (detection time per snapshot).
 */
import type { CommandCenterSnapshot, Diagnostic } from "./supervisor-types.js";

function diag(
  at: number,
  level: Diagnostic["level"],
  code: string,
  message: string,
  hint: string,
): Diagnostic {
  return { at, level, code, message, hint };
}

export function analyzeSnapshot(snapshot: CommandCenterSnapshot): Diagnostic[] {
  const at = snapshot.now;
  const out: Diagnostic[] = [];
  for (const service of snapshot.services) {
    if (service.state === "FAILED") {
      const failure = service.startupFailure ?? "startup failed";
      const portClash = /in use|EADDRINUSE/i.test(failure);
      if (portClash && service.name === "api") {
        // Specific beats generic: one incident per root cause, no duplicates.
        out.push(
          diag(
            at,
            "error",
            "API_PORT_CONFLICT",
            `Platform Server failed to bind: ${failure} — process alive but NOT serving.`,
            "Free the port (or set MOSAIX_PORT), then press R to restart.",
          ),
        );
      } else {
        out.push(
          diag(
            at,
            "error",
            `${service.name.toUpperCase()}_STARTUP_FAILED`,
            `${service.label} failed to start: ${failure} — process alive but NOT serving.`,
            portClash
              ? "Free the port (or set MOSAIX_PORT), then press R to restart."
              : "Fix the reported startup error, then press R to restart.",
          ),
        );
      }
    }
    if (
      service.lastExitCode !== null &&
      service.lastExitCode !== 0 &&
      (service.state === "CRASHED" || service.state === "STOPPED")
    ) {
      out.push(
        diag(
          at,
          "error",
          `${service.name.toUpperCase()}_NONZERO_EXIT`,
          `${service.label} exited with code ${service.lastExitCode}.`,
          "Inspect the service logs above; fix the crash, then press R to restart.",
        ),
      );
    }
    if (service.state === "CRASHED") {
      out.push(
        diag(
          at,
          "error",
          `${service.name.toUpperCase()}_CRASHED`,
          `${service.label} is not running (unexpected exit).`,
          "Check the last error line on its card; auto-restart applies backoff.",
        ),
      );
    }
    if (service.state === "RUNNING" && service.readiness.includes("unknown")) {
      out.push(
        diag(
          at,
          "warn",
          `${service.name.toUpperCase()}_READINESS_UNKNOWN`,
          `${service.label} is alive but readiness could not be confirmed.`,
          "Process is up; no readiness signal is configured for this service.",
        ),
      );
    }
    if (
      service.name === "api" &&
      service.state === "RUNNING" &&
      !service.readiness.includes("unknown")
    ) {
      out.push(
        diag(
          at,
          "warn",
          "API_READINESS_UNCONFIRMED",
          "Platform Server process is alive but never confirmed serving — not counted as up.",
          "Check the logs for a listen error; press R after fixing.",
        ),
      );
    }
    if (service.restarts >= 4) {
      out.push(
        diag(
          at,
          "warn",
          `${service.name.toUpperCase()}_RESTART_LOOP`,
          `${service.label} restarted ${service.restarts} times this session.`,
          "If restarts keep climbing, stop (Q) and fix the underlying crash loop.",
        ),
      );
    }
    if (service.lastBootMs !== null && service.lastBootMs > 15_000) {
      out.push(
        diag(
          at,
          "warn",
          `${service.name.toUpperCase()}_SLOW_BOOT`,
          `${service.label} took ${service.lastBootMs} ms to become ready.`,
          "Compare with previous cycles (Restart Time Machine) to spot regressions.",
        ),
      );
    }
  }
  if (!snapshot.watch.active) {
    out.push(
      diag(
        at,
        "error",
        "ENV_WATCHER_UNAVAILABLE",
        "Environment watcher is not active — .env edits will NOT trigger restarts.",
        "Resume watching with P, then verify the watched files exist.",
      ),
    );
  }
  if (snapshot.restarts >= 6) {
    out.push(
      diag(
        at,
        "warn",
        "RESTART_LOOP_DETECTED",
        `${snapshot.restarts} restarts this session — possible restart loop.`,
        "Stop (Q) and fix the underlying cause instead of restarting again.",
      ),
    );
  }
  const median = medianCycle(snapshot);
  const last = snapshot.cycles[0];
  if (median !== null && last?.endedAt !== null) {
    const duration = last.endedAt - last.startedAt;
    if (duration > median * 2 && duration > 2000) {
      out.push(
        diag(
          at,
          "warn",
          "RESTART_SLOW",
          `Last restart took ${duration} ms vs ${median} ms median.`,
          "Check which phase stretched in the cycle detail.",
        ),
      );
    }
  }
  // Critical first, then warnings — the incident panel relies on this order.
  return out.sort((a, b) => {
    if (a.level !== b.level) return a.level === "error" ? -1 : 1;
    return a.code.localeCompare(b.code);
  });
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
