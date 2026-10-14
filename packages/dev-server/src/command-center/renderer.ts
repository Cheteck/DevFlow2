/**
 * @mosaix/dev-server — MOSAIX // DEVELOPER COCKPIT renderer.
 *
 * Design: graphite/night-blue dark console, minimal chrome (no ASCII boxes),
 * whitespace + hairline separators, coherent status symbols:
 *   ● live state dot (mint = serving, amber = transitional/unconfirmed,
 *     red = incident, grey = stopped)
 *   ✖ incident   ◷ timeline   ≡ logs   ↻ restart
 *
 * Coherence rule: only READY services (plus MCP RUNNING, which has no probe
 * by design) count as up. A live-but-unconfirmed API is amber, never mint.
 *
 * Zero dependencies. Pure string rendering — unit-testable, deterministic
 * text fallback for CI / non-TTY / --no-tui.
 */
import type {
  CommandCenterSnapshot,
  EventLevel,
  ServiceSnapshot,
  ServiceState,
} from "./supervisor-types.js";

export interface ViewFilters {
  showLogs: boolean;
  errorOnly: boolean;
  serviceFilter: "all" | "api" | "mcp";
  showHelp: boolean;
  paused: boolean;
}

export const DEFAULT_FILTERS: ViewFilters = {
  showLogs: false,
  errorOnly: false,
  serviceFilter: "all",
  showHelp: false,
  paused: false,
};

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  mint: "\x1b[32m",
  amber: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  grey: "\x1b[90m",
  white: "\x1b[37m",
};

function colorsEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.CI !== undefined) return false;
  return true;
}

function paint(text: string, code: string, enabled: boolean): string {
  if (!enabled) return text;
  return `${code}${text}${ANSI.reset}`;
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Visible width (ANSI escapes excluded). */
function vlen(text: string): number {
  return stripAnsi(text).length;
}

function fit(text: string, width: number, enabled: boolean): string {
  if (vlen(text) <= width) return text + " ".repeat(width - vlen(text));
  // ANSI-aware truncation: walk escape sequences + visible runs so colors
  // survive and no escape is ever cut mid-sequence.
  // eslint-disable-next-line no-control-regex
  const tokens = text.match(/\x1b\[[0-9;]*m|[^\x1b]+/g) ?? [];
  let out = "";
  let count = 0;
  for (const token of tokens) {
    if (token.startsWith("\x1b")) {
      out += token;
      continue;
    }
    const room = width - 1 - count;
    if (room <= 0) break;
    if (token.length <= room) {
      out += token;
      count += token.length;
    } else {
      out += token.slice(0, room);
      break;
    }
  }
  return `${out}…${enabled ? ANSI.reset : ""}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

function formatClock(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Display color for a service state. API RUNNING is amber: alive ≠ serving. */
function stateColor(state: ServiceState, service?: ServiceSnapshot): string {
  switch (state) {
    case "READY":
      return ANSI.mint;
    case "RUNNING":
      return service?.name === "mcp" ? ANSI.mint : ANSI.amber;
    case "STARTING":
    case "STOPPING":
      return ANSI.amber;
    case "CRASHED":
    case "FAILED":
      return ANSI.red;
    default:
      return ANSI.grey;
  }
}

/** A service counts as up only when serving is confirmed (MCP: no probe). */
export function isUp(service: ServiceSnapshot): boolean {
  return (
    service.state === "READY" ||
    (service.name === "mcp" && service.state === "RUNNING")
  );
}

function isIncident(service: ServiceSnapshot): boolean {
  return service.state === "FAILED" || service.state === "CRASHED";
}

function shortTag(category: string): string {
  switch (category) {
    case "SYSTEM":
      return "sys";
    case "WATCH":
      return "watch";
    case "RESTART":
      return "restart";
    case "DIAG":
      return "diag";
    case "API":
      return "api";
    case "MCP":
      return "mcp";
    default:
      return category.toLowerCase();
  }
}

function levelColor(level: EventLevel): string {
  if (level === "error") return ANSI.red;
  if (level === "warn") return ANSI.amber;
  return ANSI.grey;
}

function extractCode(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/\b(EADDRINUSE|EACCES|ENOENT|ECONNREFUSED|EPIPE)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function incidentHeadline(service: ServiceSnapshot): string {
  if (service.startupFailure) return service.startupFailure;
  if (service.lastError) return service.lastError.split("\n")[0].slice(0, 110);
  if (service.lastExitCode !== null && service.lastExitCode !== 0) {
    return `unexpected exit (code ${service.lastExitCode})`;
  }
  return "unexpected stop — see logs";
}

function incidentHint(service: ServiceSnapshot): string {
  const text = `${service.startupFailure ?? ""} ${service.lastError ?? ""}`;
  if (/in use|EADDRINUSE/i.test(text)) {
    return "free the port or set MOSAIX_PORT, then R";
  }
  if (service.state === "CRASHED") {
    return "fix the crash, then R to restart";
  }
  return "inspect logs (L), fix, then R";
}

function servicePanel(
  service: ServiceSnapshot,
  colWidth: number,
  enabled: boolean,
): string[] {
  const color = stateColor(service.state, service);
  const dot = paint("●", color, enabled);
  const title = `${dot} ${paint(service.name.toUpperCase(), ANSI.bold, enabled)}  ${paint(service.label.toUpperCase(), ANSI.grey, enabled)}`;
  const stateWord = paint(service.state, color + ANSI.bold, enabled);
  const kpi =
    `${paint("pid", ANSI.grey, enabled)} ${service.pid ?? "—"}   ` +
    `${paint("up", ANSI.grey, enabled)} ${formatDuration(service.uptimeMs)}   ` +
    `${paint("restarts", ANSI.grey, enabled)} ${service.restarts}`;
  let status: string;
  if (service.state === "READY") {
    status = paint(
      `serving confirmed · boot ${formatDuration(service.lastBootMs)}`,
      ANSI.mint,
      enabled,
    );
  } else if (service.state === "FAILED") {
    status = paint(`✖ ${incidentHeadline(service)}`, ANSI.red, enabled);
  } else if (service.state === "CRASHED") {
    status = paint(`✖ ${incidentHeadline(service)}`, ANSI.red, enabled);
  } else if (service.state === "RUNNING" && service.name === "api") {
    status = paint(
      "serving unconfirmed — not counted as up",
      ANSI.amber,
      enabled,
    );
  } else if (service.state === "RUNNING") {
    status = paint("stdio isolated · no probe by design", ANSI.grey, enabled);
  } else if (service.state === "STARTING" || service.state === "STOPPING") {
    status = paint(service.readiness, ANSI.amber, enabled);
  } else {
    status = paint(service.readiness, ANSI.grey, enabled);
  }
  return [
    fit(title, colWidth, enabled),
    fit(stateWord, colWidth, enabled),
    fit(kpi, colWidth, enabled),
    fit(status, colWidth, enabled),
  ];
}

export function renderCommandCenter(
  snapshot: CommandCenterSnapshot,
  filters: ViewFilters,
  options?: { width?: number; forceColor?: boolean },
): string {
  const enabled = options?.forceColor ?? colorsEnabled();
  const width = Math.max(60, Math.min(options?.width ?? 100, 160));
  const narrow = width < 80;
  const lines: string[] = [];

  const services = snapshot.services.filter(
    (s) => filters.serviceFilter === "all" || filters.serviceFilter === s.name,
  );
  const upCount = snapshot.services.filter(isUp).length;
  const incidents = snapshot.services.filter(isIncident);
  const sessionMs = snapshot.now - snapshot.startedAt;

  const overallColor =
    snapshot.overall === "OPERATIONAL"
      ? ANSI.mint
      : snapshot.overall === "STARTING"
        ? ANSI.amber
        : snapshot.overall === "DEGRADED"
          ? ANSI.amber
          : ANSI.red;

  // — Header: identity + live counters on one line, context on a dim second.
  const statusBits = [
    `${paint("●", overallColor, enabled)} ${paint(snapshot.overall, overallColor + ANSI.bold, enabled)}`,
    `${upCount}/${snapshot.services.length} up`,
    incidents.length > 0
      ? paint(
          `${incidents.length} incident${incidents.length > 1 ? "s" : ""}`,
          ANSI.red + ANSI.bold,
          enabled,
        )
      : paint("0 incidents", ANSI.grey, enabled),
    formatDuration(sessionMs),
  ].join(paint(" · ", ANSI.grey, enabled));
  lines.push(
    fit(
      `${paint("MOSAIX // DEVELOPER COCKPIT", ANSI.bold + ANSI.white, enabled)}  ${paint("DEV", ANSI.amber, enabled)}   ${statusBits}`,
      width,
      enabled,
    ),
  );
  lines.push(
    fit(
      paint(
        `watch ${snapshot.watch.watched.join(", ") || "—"} ${snapshot.watch.active ? (snapshot.watch.paused ? "paused" : "on") : "off"}` +
          (snapshot.watch.lastEvent
            ? ` · last ${snapshot.watch.lastEvent}`
            : "") +
          ` · restarts ${snapshot.restarts}`,
        ANSI.grey,
        enabled,
      ),
      width,
      enabled,
    ),
  );
  lines.push(paint("─".repeat(width), ANSI.grey, enabled));

  // — Services: side-by-side panels on wide terminals, stacked otherwise.
  lines.push(paint("SERVICES", ANSI.bold, enabled));
  const twoCol =
    !narrow &&
    services.length === 2 &&
    filters.serviceFilter === "all" &&
    width >= 96;
  if (twoCol) {
    const colWidth = Math.floor((width - 3) / 2);
    const left = servicePanel(services[0], colWidth, enabled);
    const right = servicePanel(services[1], colWidth, enabled);
    const sep = paint("│", ANSI.grey, enabled);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      lines.push(`${left[i] ?? " ".repeat(colWidth)} ${sep} ${right[i] ?? ""}`);
    }
  } else {
    for (const service of services) {
      lines.push(
        ...servicePanel(service, width, enabled).map((l) => l.trimEnd()),
      );
      lines.push("");
    }
    lines.pop();
  }
  lines.push("");

  // — Incidents: concise summaries, never raw dumps.
  if (incidents.length > 0) {
    lines.push(
      paint(`✖ INCIDENTS · ${incidents.length}`, ANSI.red + ANSI.bold, enabled),
    );
    for (const service of incidents) {
      const code = extractCode(
        `${service.startupFailure ?? ""} ${service.lastError ?? ""}`,
      );
      const exit =
        service.lastExitCode !== null
          ? `exit ${service.lastExitCode}`
          : "exit —";
      lines.push(
        fit(
          `${paint("✖", ANSI.red, enabled)} ${paint(service.name, ANSI.bold, enabled)}  ${incidentHeadline(service)}`,
          width,
          enabled,
        ),
      );
      lines.push(
        fit(
          paint(
            `  ${code ? `code ${code} · ` : ""}${exit} · ${incidentHint(service)} · L full logs`,
            ANSI.grey,
            enabled,
          ),
          width,
          enabled,
        ),
      );
    }
    lines.push("");
  } else {
    lines.push(
      fit(
        paint("✓ no incidents — systems nominal", ANSI.grey, enabled),
        width,
        enabled,
      ),
    );
    lines.push("");
  }

  // — Timeline: compact, newest last for stable reading.
  lines.push(paint("◷ TIMELINE", ANSI.bold, enabled));
  const eventCount = narrow ? 4 : 6;
  const events = snapshot.events.slice(-eventCount);
  if (events.length === 0) {
    lines.push(paint("  no events yet", ANSI.grey, enabled));
  } else {
    for (const event of events) {
      lines.push(
        fit(
          `  ${paint(formatClock(event.at), ANSI.grey, enabled)} ${paint(shortTag(event.category).padEnd(7), levelColor(event.level), enabled)} ${event.message}`,
          width,
          enabled,
        ),
      );
    }
  }
  lines.push("");

  // — Restart Time Machine: one measured line, detail preserved in cycles.
  const latest = snapshot.cycles[0];
  if (latest) {
    const total =
      latest.endedAt !== null
        ? latest.endedAt - latest.startedAt
        : snapshot.now - latest.startedAt;
    const marks = latest.phases;
    const rel = (t: number | null) =>
      t === null ? "—" : `${t - latest.startedAt}ms`;
    lines.push(
      fit(
        paint(
          `↻ restart #${String(latest.id).padStart(3, "0")} · ${total}ms · ${latest.outcome} · trigger ${rel(marks.debounceDoneAt)} stop ${rel(marks.stopRequestedAt)} spawn ${rel(marks.spawnedAt)} ready ${rel(marks.readyAt)}`,
          ANSI.grey,
          enabled,
        ),
        width,
        enabled,
      ),
    );
    lines.push("");
  }

  // — Logs: secondary by default. Counts stay visible so nothing is hidden silently.
  if (filters.showLogs) {
    const scope =
      filters.serviceFilter === "all"
        ? "ALL"
        : filters.serviceFilter.toUpperCase();
    lines.push(
      paint(
        `≡ LOGS [${scope}]${filters.errorOnly ? " · errors only" : ""} · L to collapse`,
        ANSI.bold,
        enabled,
      ),
    );
    let logs = snapshot.logs;
    if (filters.serviceFilter !== "all") {
      logs = logs.filter(
        (l) =>
          l.service === filters.serviceFilter || l.service === "supervisor",
      );
    }
    if (filters.errorOnly) {
      logs = logs.filter((l) => l.level === "error" || l.stream === "stderr");
    }
    const tail = logs.slice(narrow ? -8 : -12);
    if (tail.length === 0) {
      lines.push(paint("  no log lines", ANSI.grey, enabled));
    } else {
      for (const log of tail) {
        const origin =
          log.service === "supervisor"
            ? paint("sys", ANSI.cyan, enabled)
            : paint(
                log.service,
                log.service === "api" ? ANSI.mint : ANSI.cyan,
                enabled,
              );
        lines.push(
          fit(
            `  ${paint(formatClock(log.at), ANSI.grey, enabled)} ${origin}› ${log.text}`,
            width,
            enabled,
          ),
        );
      }
    }
    lines.push("");
  } else {
    lines.push(
      fit(
        paint(
          `≡ logs — ${snapshot.logs.length} lines buffered · L to expand${filters.errorOnly ? " · E errors-only armed" : ""}`,
          ANSI.grey,
          enabled,
        ),
        width,
        enabled,
      ),
    );
    lines.push("");
  }

  // — Footer shortcuts.
  lines.push(
    fit(
      paint(
        narrow
          ? "R restart · L logs · Q quit · ? help"
          : "R restart · L logs · E errors · C clear · P watch · 1 api · 2 mcp · ? help · Q quit",
        ANSI.grey,
        enabled,
      ),
      width,
      enabled,
    ),
  );
  if (filters.showHelp) {
    const help: Array<[string, string]> = [
      ["R", "safe restart (stop awaited → spawn → readiness)"],
      ["L", "expand / collapse logs"],
      ["E", "error-only log filter"],
      ["C", "clear log view (events + cycles preserved)"],
      ["P", "pause / resume .env watch (supervision continues)"],
      ["1 / 2", "filter platform server / MCP"],
      ["Q · Ctrl+C", "graceful shutdown, no orphans"],
    ];
    for (const [key, desc] of help) {
      lines.push(
        fit(
          `  ${paint(key.padEnd(10), ANSI.white, enabled)}${paint(desc, ANSI.grey, enabled)}`,
          width,
          enabled,
        ),
      );
    }
  }

  return lines.join("\n");
}
