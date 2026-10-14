/**
 * @mosaix/dev-server — cockpit panels. Bordered, titled, data-real-only.
 *
 * Every panel renders from the live snapshot; unavailable data is labeled
 * explicitly ("—"), never invented. Borders are thin with the title fused
 * into the top edge; border color follows the centralized theme meaning.
 */
import { ANSI, paint, vlen, stripAnsi, SYMBOLS } from "./theme.js";
import { formatClock, formatDuration, textBar } from "./format.js";
import type {
  CommandCenterSnapshot,
  Diagnostic,
  LogEntry,
  RestartCycle,
  ServiceSnapshot,
  SupervisorEvent,
  ViewFilters,
} from "./supervisor-types.js";

/** A service counts as up only when serving is confirmed (MCP: no probe). */
export function isUp(service: ServiceSnapshot): boolean {
  return (
    service.state === "READY" ||
    (service.name === "mcp" && service.state === "RUNNING")
  );
}

export interface Panel {
  id: string;
  lines: string[];
}

/** Thin bordered panel with the title fused into the top edge. */
export function panel(
  title: string,
  borderColor: string,
  body: string[],
  width: number,
  enabled: boolean,
): string[] {
  const w = Math.max(12, width);
  const inner = w - 2;
  const head = `─ ${title} `;
  const top =
    paint("┌", borderColor, enabled) +
    paint(head, borderColor, enabled) +
    paint(
      "─".repeat(Math.max(0, inner - vlen(head))) + "┐",
      borderColor,
      enabled,
    );
  const bottom = paint(`└${"─".repeat(inner)}┘`, borderColor, enabled);
  const out = [top];
  for (const line of body) {
    const plain = stripAnsi(line);
    const content =
      vlen(line) > inner ? plain.slice(0, Math.max(0, inner - 1)) + "…" : line;
    out.push(
      paint("│", borderColor, enabled) +
        content +
        " ".repeat(Math.max(0, inner - vlen(content))) +
        paint("│", borderColor, enabled),
    );
  }
  out.push(bottom);
  return out;
}

function stateWord(service: ServiceSnapshot, enabled: boolean): string {
  const color =
    service.state === "READY" ||
    (service.name === "mcp" && service.state === "RUNNING")
      ? ANSI.green
      : service.state === "FAILED" || service.state === "CRASHED"
        ? ANSI.red
        : service.state === "STOPPED"
          ? ANSI.grey
          : ANSI.amber;
  return paint(service.state, color + ANSI.bold, enabled);
}

function dot(service: ServiceSnapshot, enabled: boolean): string {
  const color =
    service.state === "READY" ||
    (service.name === "mcp" && service.state === "RUNNING")
      ? ANSI.green
      : service.state === "FAILED" || service.state === "CRASHED"
        ? ANSI.red
        : service.state === "STOPPED"
          ? ANSI.grey
          : ANSI.amber;
  return paint(SYMBOLS.dot, color, enabled);
}

export function headerBar(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean,
): string[] {
  const up = snapshot.services.filter(isUp).length;
  const incidents = snapshot.diagnostics.filter(
    (d) => d.level === "error",
  ).length;
  const overallColor =
    snapshot.overall === "OPERATIONAL"
      ? ANSI.green
      : snapshot.overall === "STARTING"
        ? ANSI.amber
        : snapshot.overall === "DEGRADED"
          ? ANSI.amber
          : ANSI.red;
  const line =
    `${paint(`${SYMBOLS.brand} MOSAIX // COMMAND CENTER`, ANSI.bold + ANSI.cyan, enabled)}  ` +
    `${paint("DEV", ANSI.amber, enabled)}  ` +
    `${paint(SYMBOLS.dot, overallColor, enabled)} ${paint(snapshot.overall, overallColor + ANSI.bold, enabled)}  ` +
    `${paint("SERVICES", ANSI.grey, enabled)} ${up}/${snapshot.services.length}  ` +
    `${incidents > 0 ? paint(`INCIDENTS ${incidents}`, ANSI.red + ANSI.bold, enabled) : paint("INCIDENTS 0", ANSI.grey, enabled)}  ` +
    `${paint("RESTARTS", ANSI.grey, enabled)} ${snapshot.restarts}  ` +
    `${paint("SESSION", ANSI.grey, enabled)} ${formatDuration(snapshot.now - snapshot.startedAt)}`;
  const sub = paint(
    `watch ${snapshot.watch.watched.join(", ") || "—"} ${snapshot.watch.active ? (snapshot.watch.paused ? "paused" : "on") : "off"}` +
      (snapshot.watch.lastEvent ? ` · last ${snapshot.watch.lastEvent}` : ""),
    ANSI.grey,
    enabled,
  );
  return [fitLine(line, width, enabled), fitLine(sub, width, enabled)];
}

/** ANSI-aware pad-or-truncate to exactly `width` visible cells. */
export function fitLine(text: string, width: number, enabled: boolean): string {
  if (vlen(text) <= width) return text + " ".repeat(width - vlen(text));
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

function k(label: string, enabled: boolean): string {
  return paint(label, ANSI.grey, enabled);
}

/** One-line human summary of a service failure (startup summary first). */
export function incidentHeadline(service: ServiceSnapshot): string {
  if (service.startupFailure) return service.startupFailure;
  if (service.lastError) return service.lastError.split("\n")[0].slice(0, 110);
  if (service.lastExitCode !== null && service.lastExitCode !== 0) {
    return `unexpected exit (code ${service.lastExitCode})`;
  }
  return "unexpected stop — see logs";
}

export function infrastructurePanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean,
  serviceFilter: ViewFilters["serviceFilter"],
): Panel {
  const body: string[] = [];
  for (const s of snapshot.services) {
    if (serviceFilter !== "all" && serviceFilter !== s.name) continue;
    const avail =
      s.state === "READY"
        ? paint("confirmed", ANSI.green, enabled)
        : s.state === "FAILED"
          ? paint("startup failed", ANSI.red, enabled)
          : s.name === "mcp" && s.state === "RUNNING"
            ? paint("unknown (no probe)", ANSI.amber, enabled)
            : s.state === "RUNNING"
              ? paint("unconfirmed", ANSI.amber, enabled)
              : paint(s.readiness, ANSI.grey, enabled);
    body.push(
      `${dot(s, enabled)} ${paint(s.name.toUpperCase(), ANSI.bold, enabled)} ${paint(s.label.toUpperCase(), ANSI.grey, enabled)}`,
    );
    body.push(
      `  ${stateWord(s, enabled)}  ${k("pid", enabled)} ${s.pid ?? "—"}  ${k("up", enabled)} ${formatDuration(s.uptimeMs)}  ${k("rst", enabled)} ${s.restarts}`,
    );
    if (s.state === "FAILED" || s.state === "CRASHED") {
      body.push(
        `  ${paint(`${SYMBOLS.incident} ${incidentHeadline(s)}`, ANSI.red, enabled)}`,
      );
    }
    const port =
      s.name === "api"
        ? snapshot.apiPort
          ? paint(`:${snapshot.apiPort}`, ANSI.blue, enabled)
          : paint("port —", ANSI.grey, enabled)
        : paint("stdio", ANSI.grey, enabled);
    body.push(
      `  ${k("avail", enabled)} ${avail}  ${port}  ${k("exit", enabled)} ${s.lastExitCode ?? "—"}`,
    );
  }
  if (body.length === 0)
    body.push(paint("  no services match filter", ANSI.grey, enabled));
  return {
    id: "infrastructure",
    lines: panel("INFRASTRUCTURE", ANSI.cyan, body, width, enabled),
  };
}

export function fleetPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean,
  serviceFilter: ViewFilters["serviceFilter"],
  compact = false,
): Panel {
  const body: string[] = [];
  for (const s of snapshot.services) {
    if (serviceFilter !== "all" && serviceFilter !== s.name) continue;
    if (compact) {
      body.push(
        `${paint(s.name, ANSI.violet + ANSI.bold, enabled)} ${stateWord(s, enabled)} ${k("pid", enabled)} ${s.pid ?? "—"} ${k("rst", enabled)} ${s.restarts} ${k("exit", enabled)} ${s.lastExitCode ?? "—"}`,
      );
      continue;
    }
    body.push(
      `${paint(s.name, ANSI.violet + ANSI.bold, enabled)}  ${k("pid", enabled)} ${s.pid ?? "—"}  ${stateWord(s, enabled)}`,
    );
    body.push(
      `  ${k("last boot", enabled)} ${formatDuration(s.lastBootMs)}  ${k("up", enabled)} ${formatDuration(s.uptimeMs)}  ${k("restarts", enabled)} ${s.restarts}  ${k("exit", enabled)} ${s.lastExitCode ?? "—"}/${s.lastSignal ?? "—"}`,
    );
  }
  if (body.length === 0)
    body.push(paint("  no history (filter)", ANSI.grey, enabled));
  if (!compact) {
    body.push(
      paint(
        "  last stop: tracked via exit code/signal above",
        ANSI.grey,
        enabled,
      ),
    );
  }
  return {
    id: "fleet",
    lines: panel("PROCESS FLEET", ANSI.violet, body, width, enabled),
  };
}

export function vitalsPanel(
  snapshot: CommandCenterSnapshot,
  width: number,
  enabled: boolean,
  compact = false,
): Panel {
  const host = snapshot.host;
  const mem = host
    ? `rss ${host.rssMB}MB heap ${host.heapMB}MB`
    : "rss — heap — (sampling…)";
  const cpu =
    host?.cpuPct !== null && host?.cpuPct !== undefined
      ? `${host.cpuPct.toFixed(1)}%`
      : "—";
  const body = [
    `  ${k("watch", enabled)} ${snapshot.watch.watched.join(", ") || "—"} ${snapshot.watch.active ? paint("on", ANSI.green, enabled) : paint("OFF", ANSI.red + ANSI.bold, enabled)}${snapshot.watch.paused ? paint(" (paused)", ANSI.amber, enabled) : ""}`,
    `  ${k("supervisor", enabled)} cpu ${cpu} · mem ${mem} ${paint("(scope: supervisor)", ANSI.grey, enabled)}`,
  ];
  if (!compact) {
    const boots = snapshot.services
      .map((s) => `${s.name} ${formatDuration(s.lastBootMs)}`)
      .join(" · ");
    const exits = snapshot.services
      .map((s) => `${s.name} ${s.lastExitCode ?? "—"}`)
      .join(" · ");
    body.push(`  ${k("boot", enabled)} ${boots}`);
    body.push(
      `  ${k("exits", enabled)} ${exits}  ${k("restarts", enabled)} ${snapshot.restarts}`,
    );
  }
  return {
    id: "vitals",
    lines: panel("VITALS", ANSI.blue, body, width, enabled),
  };
}

function eventTag(e: SupervisorEvent, enabled: boolean): string {
  const short =
    e.category === "SYSTEM"
      ? "sys"
      : e.category === "WATCH"
        ? "watch"
        : e.category === "RESTART"
          ? "rst"
          : e.category.toLowerCase();
  const color =
    e.level === "error"
      ? ANSI.red
      : e.level === "warn"
        ? ANSI.amber
        : ANSI.violet;
  return paint(short.padEnd(5), color, enabled);
}

export function sessionsPanel(
  events: SupervisorEvent[],
  width: number,
  rows: number,
  enabled: boolean,
): Panel {
  const tail = events.slice(-Math.max(1, rows));
  const body =
    tail.length === 0
      ? [paint("  no events yet", ANSI.grey, enabled)]
      : tail.map(
          (e) =>
            `  ${paint(formatClock(e.at), ANSI.grey, enabled)} ${eventTag(e, enabled)} ${e.message}`,
        );
  return {
    id: "sessions",
    lines: panel("SESSIONS / ACTIVITY", ANSI.violet, body, width, enabled),
  };
}

function diagColor(d: Diagnostic): string {
  return d.level === "error" ? ANSI.red : ANSI.amber;
}

export function diagnosticsPanel(
  diagnostics: Diagnostic[],
  width: number,
  maxItems: number,
  enabled: boolean,
): Panel {
  const color = diagnostics.some((d) => d.level === "error")
    ? ANSI.red
    : diagnostics.length > 0
      ? ANSI.amber
      : ANSI.green;
  const title = `DIAGNOSTICS · ${diagnostics.length}`;
  if (diagnostics.length === 0) {
    return {
      id: "diagnostics",
      lines: panel(
        title,
        color,
        [paint(`  ${SYMBOLS.ok} no active incidents`, ANSI.green, enabled)],
        width,
        enabled,
      ),
    };
  }
  const body: string[] = [];
  for (const d of diagnostics.slice(0, Math.max(1, maxItems))) {
    body.push(
      `  ${paint(d.level === "error" ? SYMBOLS.incident : SYMBOLS.warn, diagColor(d), enabled)} ${paint(d.code, diagColor(d) + ANSI.bold, enabled)}  ${d.message}`,
    );
    body.push(
      `    ${paint(formatClock(d.at), ANSI.grey, enabled)} ${paint(d.hint, ANSI.grey, enabled)}`,
    );
  }
  return {
    id: "diagnostics",
    lines: panel(title, color, body, width, enabled),
  };
}

function logOrigin(log: LogEntry, enabled: boolean): string {
  if (log.service === "supervisor") return paint("sys", ANSI.blue, enabled);
  const color =
    log.stream === "stderr"
      ? ANSI.amber
      : log.service === "api"
        ? ANSI.green
        : ANSI.cyan;
  return paint(log.service, color, enabled);
}

export function logsPanel(
  logs: LogEntry[],
  filters: ViewFilters,
  width: number,
  rows: number,
  enabled: boolean,
): Panel {
  const scope =
    filters.serviceFilter === "all"
      ? "ALL"
      : filters.serviceFilter.toUpperCase();
  const title = `LIVE LOGS [${scope}]${filters.errorOnly ? " · ERRORS" : ""}${filters.logScroll > 0 ? ` · ▲${filters.logScroll}` : ""}`;
  let view = logs;
  if (filters.serviceFilter !== "all") {
    view = view.filter(
      (l) => l.service === filters.serviceFilter || l.service === "supervisor",
    );
  }
  if (filters.errorOnly) {
    view = view.filter((l) => l.level === "error" || l.stream === "stderr");
  }
  // Clamp scroll defensively: never scroll past the oldest buffered line.
  const maxScroll = Math.max(0, view.length - Math.max(1, rows));
  const scroll = Math.max(0, Math.min(filters.logScroll, maxScroll));
  if (view.length === 0) {
    return {
      id: "logs",
      lines: panel(
        title,
        ANSI.blue,
        [paint("  no log lines", ANSI.grey, enabled)],
        width,
        enabled,
      ),
    };
  }
  const start = Math.max(0, view.length - rows - scroll);
  const body = view
    .slice(start, start + Math.max(1, rows))
    .map(
      (l) =>
        `  ${paint(formatClock(l.at), ANSI.grey, enabled)} ${logOrigin(l, enabled)}${paint(l.stream === "stderr" ? "!" : "›", ANSI.grey, enabled)} ${l.text}`,
    );
  return { id: "logs", lines: panel(title, ANSI.blue, body, width, enabled) };
}

export function logsCollapsedPanel(
  buffered: number,
  filters: ViewFilters,
  width: number,
  enabled: boolean,
): Panel {
  const extra = filters.errorOnly ? " · errors-only armed" : "";
  return {
    id: "logs",
    lines: panel(
      "LIVE LOGS",
      ANSI.blue,
      [
        paint(
          `  ${buffered} lines buffered · L to expand${extra}`,
          ANSI.grey,
          enabled,
        ),
      ],
      width,
      enabled,
    ),
  };
}
export function restartsPanel(
  cycles: RestartCycle[],
  width: number,
  rows: number,
  showBars: boolean,
  enabled: boolean,
): Panel {
  const done = cycles.filter((c) => c.endedAt !== null);
  const max = done.reduce(
    (m, c) => Math.max(m, (c.endedAt as number) - c.startedAt),
    0,
  );
  const median = (() => {
    const ds = done
      .filter((c) => c.outcome === "completed")
      .map((c) => (c.endedAt as number) - c.startedAt)
      .sort((a, b) => a - b);
    return ds.length > 0 ? ds[Math.floor(ds.length / 2)] : null;
  })();
  if (cycles.length === 0) {
    return {
      id: "restarts",
      lines: panel(
        "RESTART TIME MACHINE",
        ANSI.amber,
        [paint("  no cycles yet — press R", ANSI.grey, enabled)],
        width,
        enabled,
      ),
    };
  }
  const body: string[] = [];
  for (const c of cycles.slice(0, Math.max(1, rows))) {
    const total =
      c.endedAt !== null ? c.endedAt - c.startedAt : Date.now() - c.startedAt;
    const outcomeColor =
      c.outcome === "completed"
        ? ANSI.green
        : c.outcome === "timeout"
          ? ANSI.amber
          : ANSI.red;
    const bar = showBars ? ` ${textBar(total, Math.max(max, 1)).bar}` : "";
    const cmp =
      median !== null && c.endedAt !== null
        ? total > median * 1.5
          ? paint(" slower than median", ANSI.amber, enabled)
          : paint(" ≈ median", ANSI.grey, enabled)
        : "";
    body.push(
      `  ${paint(`#${String(c.id).padStart(3, "0")}`, ANSI.bold, enabled)} ${paint(c.outcome, outcomeColor, enabled)} ${formatDuration(total)}${bar} ${paint(`${c.scope}`, ANSI.grey, enabled)} — ${c.reason}${cmp}`,
    );
  }
  return {
    id: "restarts",
    lines: panel("RESTART TIME MACHINE", ANSI.amber, body, width, enabled),
  };
}

export function statusBar(
  filters: ViewFilters,
  width: number,
  enabled: boolean,
): string[] {
  const ctx: string[] = [];
  if (filters.serviceFilter !== "all")
    ctx.push(`filter:${filters.serviceFilter}`);
  if (filters.errorOnly) ctx.push("errors-only");
  if (filters.paused) ctx.push("watch-paused");
  const keys =
    "R Restart | L Logs | E Errors | C Clear | P Watch | 1 API | 2 MCP | Ctrl+K Cmd | ? Help | Q Quit";
  const line = `${paint(keys, ANSI.grey, enabled)}${ctx.length > 0 ? paint(`   [${ctx.join(" · ")}]`, ANSI.amber, enabled) : ""}`;
  return [fitLine(line, width, enabled)];
}
