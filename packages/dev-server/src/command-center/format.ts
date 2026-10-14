/** @mosaix/dev-server — shared cockpit formatting helpers. */

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

export function formatClock(at: number): string {
  if (!Number.isFinite(at)) return "--:--:--";
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Text bar (real measured ratio): `████▓░░░ 4.5s`. */
export function textBar(
  value: number,
  max: number,
  cells = 8,
): { bar: string; label: string } {
  const safeMax = max > 0 ? max : 1;
  const filled = Math.max(
    value > 0 ? 1 : 0,
    Math.round((Math.min(value, safeMax) / safeMax) * cells),
  );
  return {
    bar: "█".repeat(filled) + "░".repeat(Math.max(0, cells - filled)),
    label: formatDuration(value),
  };
}
