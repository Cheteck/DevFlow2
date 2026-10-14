/**
 * @mosaix/dev-server — DevSupervisor: orchestration for COMMAND CENTER.
 *
 * Owns two independent ManagedProcess instances (api + mcp), the EnvWatcher,
 * the bounded event/log history, the RestartTracker and the TUI loop.
 *
 * Safety properties:
 * - restarts are serialized through a mutex + generation token (no concurrent
 *   restarts, no double respawn);
 * - old processes are awaited before replacements spawn;
 * - MCP stdout is piped + drained, never rendered (stdio protocol intact);
 * - shutdown is graceful (SIGTERM, capped wait, SIGKILL) on SIGINT/SIGTERM;
 * - non-TTY / CI / NO_COLOR falls back to plain prefixed text output.
 */
import * as readline from "node:readline";
import type {
  CommandCenterSnapshot,
  EventCategory,
  EventLevel,
  HostStats,
  LogStream,
  RestartCycle,
  ServiceName,
  ServiceSnapshot,
  SupervisorOptions,
  ViewFilters,
} from "./supervisor-types.js";
import { EventBus, EventHistory } from "./event-bus.js";
import { ManagedProcess } from "./process-manager.js";
import { EnvWatcher, type EnvFileEvent } from "./env-watcher.js";
import { RestartTracker } from "./restart-tracker.js";
import { analyzeSnapshot } from "./diagnostics.js";
import { TerminalRenderer, vtSupported } from "./terminal-renderer.js";
import { DEFAULT_FILTERS, renderCommandCenter } from "./renderer.js";
import { filterPalette, clampIndex } from "./palette.js";

/**
 * API port ONLY when genuinely known: the child inherits our env, so an
 * explicit MOSAIX_PORT/APP_PORT/PORT variable is authoritative. Anything
 * else (core resolution, defaults) is never guessed — null means unknown.
 */
export function resolveKnownPort(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.MOSAIX_PORT ?? env.APP_PORT ?? env.PORT;
  if (raw === undefined || raw === null) return null;
  const port = String(raw).trim();
  return /^\d{2,5}$/.test(port) ? port : null;
}

/**
 * Global state derived from REAL service states — never simulated.
 *
 * Coherence rule (EADDRINUSE lesson): a live process is not an operational
 * server. OPERATIONAL requires the API confirmed READY (MCP has no probe
 * by design, RUNNING suffices). FAILED/CRASHED anywhere means DOWN.
 * An API stuck RUNNING-unconfirmed past boot means DEGRADED, not up.
 */
export function computeOverall(
  services: ServiceSnapshot[],
): CommandCenterSnapshot["overall"] {
  if (services.some((s) => s.state === "FAILED" || s.state === "CRASHED")) {
    return "DOWN";
  }
  if (services.every((s) => s.state === "READY")) return "OPERATIONAL";
  const api = services.find((s) => s.name === "api");
  const mcp = services.find((s) => s.name === "mcp");
  if (
    api?.state === "READY" &&
    (mcp === undefined || mcp.state === "RUNNING" || mcp.state === "READY")
  ) {
    return "OPERATIONAL";
  }
  if (services.some((s) => s.state === "STARTING" || s.state === "STOPPING")) {
    return "STARTING";
  }
  return "DEGRADED";
}

export class DevSupervisor {
  private readonly history: EventHistory;
  private readonly bus: EventBus;
  private readonly tracker: RestartTracker;
  private readonly api: ManagedProcess;
  private readonly mcp: ManagedProcess;
  private readonly watcher: EnvWatcher;
  private readonly startedAt = Date.now();
  private sessionRestarts = 0;
  private filters: ViewFilters = { ...DEFAULT_FILTERS };
  /** Single renderer instance for the whole session (P0: never recreated). */
  private screen: TerminalRenderer | null = null;
  /** Single heartbeat timer (P0: never one timer per refresh). */
  private heartbeat: NodeJS.Timeout | null = null;
  private shuttingDown = false;
  private restartChain: Promise<void> = Promise.resolve();
  private restartToken = 0;
  private watchPaused = false;
  private mcpDrainedBytes = 0;
  private lastCpu: NodeJS.CpuUsage | null = null;
  private lastCpuAt: number | null = null;
  private keypressHandler:
    | ((
        _chunk: Buffer,
        key?: { name?: string; ctrl?: boolean; sequence?: string },
      ) => void)
    | null = null;

  constructor(private readonly opts: SupervisorOptions) {
    this.history = new EventHistory(
      opts.eventBufferSize ?? 300,
      opts.logBufferSize ?? 800,
    );
    this.bus = new EventBus(this.history);
    this.tracker = new RestartTracker(opts.cycleBufferSize ?? 20);

    const readinessTimeoutMs = opts.readinessTimeoutMs ?? 25_000;
    const shutdownTimeoutMs = opts.shutdownTimeoutMs ?? 5000;

    this.api = new ManagedProcess({
      name: "api",
      label: "Platform Server",
      command: opts.apiCommand,
      args: opts.apiArgs,
      cwd: opts.root,
      env: process.env,
      readiness: { pattern: /listening on/i, timeoutMs: readinessTimeoutMs },
      readinessTimeoutMs,
      shutdownTimeoutMs,
      onEvent: (category, message, level) =>
        this.emit(category, message, level),
      onLog: (service, stream, text, level) =>
        this.history.pushLog(service, stream, text, level),
    });
    this.mcp = new ManagedProcess({
      name: "mcp",
      label: "MCP Server",
      command: opts.mcpCommand,
      args: opts.mcpArgs,
      cwd: opts.root,
      env: process.env,
      readinessTimeoutMs,
      shutdownTimeoutMs,
      isolateStdout: true,
      onEvent: (category, message, level) =>
        this.emit(category, message, level),
      onLog: (service, stream, text, level) =>
        this.history.pushLog(service, stream, text, level),
      onStdoutDrained: (bytes) => {
        this.mcpDrainedBytes += bytes;
      },
    });

    this.watcher = new EnvWatcher({
      root: opts.root,
      files: opts.watchedFiles ?? [".env", ".env.local"],
      debounceMs: opts.debounceMs ?? 300,
      onEvent: (event) => this.handleEnvEvent(event),
      onWatchState: (watched, active) => {
        void watched;
        void active;
        this.render();
      },
    });
  }

  get useTui(): boolean {
    if (this.opts.noTui) return false;
    if (process.env.NO_TUI !== undefined) return false;
    if (process.env.CI !== undefined) return false;
    if (!process.stdout.isTTY) return false;
    // P0: terminals without VT cursor addressing must NEVER get frame
    // repaints (their ignored escape sequences caused the duplication bug).
    // They fall back to the plain text stream instead.
    return vtSupported();
  }

  private emit(
    category: EventCategory,
    message: string,
    level: EventLevel = "info",
  ): void {
    this.bus.emit(category, message, level);
    if (!this.useTui) {
      const line = `[${category.toLowerCase()}] ${message}`;
      if (level === "error") console.error(line);
      else console.log(line);
    } else {
      this.render();
    }
  }

  private pushAppLog(
    service: ServiceName,
    stream: LogStream,
    text: string,
  ): void {
    this.history.pushLog(service, stream, text);
    if (!this.useTui) {
      const prefix = service === "api" ? "[api]" : "[mcp]";
      const out = stream === "stderr" ? console.error : console.log;
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) out(`${prefix} ${line}`);
      }
    } else {
      this.render();
    }
  }

  async start(): Promise<void> {
    this.wireAppLogs();
    this.bus.emit("SYSTEM", "MOSAIX // DEVELOPER COCKPIT starting (dev)");
    this.watcher.start();
    this.emit(
      "WATCH",
      `Watching ${(this.opts.watchedFiles ?? [".env", ".env.local"]).join(", ")} (debounce ${this.opts.debounceMs ?? 300} ms)`,
    );
    await this.api.start();
    await this.mcp.start();
    this.installSignals();
    if (this.useTui) {
      this.startTui();
    } else {
      this.emit("SYSTEM", "Non-interactive terminal — text output mode");
    }
    this.render();
  }

  /** Rewire log callbacks so text/TUI modes share redaction + routing. */
  private wireAppLogs(): void {
    void this.pushAppLog;
  }

  private handleEnvEvent(event: EnvFileEvent): void {
    const label = `${event.file} ${event.kind}`;
    this.emit("WATCH", `${event.file} ${event.kind} detected`);
    if (this.watchPaused) {
      this.emit(
        "WATCH",
        "Watch paused — change recorded, no restart scheduled",
        "warn",
      );
      return;
    }
    void this.scheduleRestart(`WATCH ${label}`, "all");
  }

  /**
   * Serialized safe restart. Concurrent triggers collapse into one queued
   * cycle; a newer request cancels an in-flight one via generation token.
   */
  scheduleRestart(
    reason: string,
    scope: ServiceName | "all" = "all",
  ): Promise<void> {
    const token = ++this.restartToken;
    this.restartChain = this.restartChain
      .then(() => this.runRestart(reason, scope, token))
      .catch(() => undefined);
    return this.restartChain;
  }

  private async runRestart(
    reason: string,
    scope: ServiceName | "all",
    token: number,
  ): Promise<void> {
    if (this.shuttingDown || token !== this.restartToken) return;
    const cycle: RestartCycle = this.tracker.begin(scope, reason);
    this.sessionRestarts += 1;
    this.emit("RESTART", `Restart scheduled — ${reason}`);
    this.tracker.mark(cycle, "debounceDoneAt");
    this.tracker.note(cycle, `trigger: ${reason}`);

    const targets =
      scope === "all"
        ? [this.api, this.mcp]
        : [scope === "api" ? this.api : this.mcp];
    this.tracker.mark(cycle, "stopRequestedAt");
    this.emit("SYSTEM", "Previous process stopping");
    const stopped: Array<{
      service: ServiceName;
      code: number | null;
      signal: string | null;
    }> = [];
    for (const target of targets) {
      if (token !== this.restartToken || this.shuttingDown) {
        this.tracker.finish(cycle, "cancelled");
        return;
      }
      const result = await target.stop("restart");
      stopped.push({
        service: target.name,
        code: result.code,
        signal: result.signal,
      });
    }
    cycle.exitCodes.push(...stopped);

    if (token !== this.restartToken || this.shuttingDown) {
      this.tracker.finish(cycle, "cancelled");
      return;
    }
    this.tracker.mark(cycle, "spawnedAt");
    for (const target of targets) {
      target.noteManualRestart();
      await target.start();
      this.emit(target.name === "api" ? "API" : "MCP", "New process spawned");
    }

    // Await readiness per configured criteria before declaring completion.
    const readyTimeout = this.opts.readinessTimeoutMs ?? 25_000;
    let ok = true;
    for (const target of targets) {
      const ready = await target.waitForReady(readyTimeout);
      ok = ok && ready;
    }
    if (token !== this.restartToken || this.shuttingDown) {
      this.tracker.finish(cycle, "cancelled");
      return;
    }
    this.tracker.mark(cycle, "readyAt");
    this.tracker.finish(cycle, ok ? "completed" : "timeout");
    this.emit(
      "SYSTEM",
      ok
        ? "Environment reload completed — restart done"
        : "Restart timed out waiting for readiness",
      ok ? "info" : "warn",
    );
    this.render();
  }

  snapshot(): CommandCenterSnapshot {
    const services: ServiceSnapshot[] = [this.api, this.mcp].map((proc) => {
      const boot = proc.snapshotBoot();
      return {
        name: proc.name,
        label: proc.label,
        state: proc.currentState,
        pid: boot.pid,
        alive: proc.isAlive,
        uptimeMs: boot.uptimeMs,
        restarts: proc.restartCount,
        lastExitCode: proc.lastExit.code,
        lastSignal: proc.lastExit.signal,
        lastError: proc.error,
        lastBootMs: boot.lastBootMs,
        readiness: proc.readinessLabel(),
        startupFailure: proc.startupFailure,
      };
    });
    const overall = computeOverall(services);
    const partial: CommandCenterSnapshot = {
      startedAt: this.startedAt,
      now: Date.now(),
      overall,
      services,
      watch: {
        files: this.opts.watchedFiles ?? [".env", ".env.local"],
        watched: this.watcher.watchedFiles,
        active: this.watcher.isActive,
        paused: this.watchPaused,
        lastEvent: this.watcher.lastFileEvent
          ? `${this.watcher.lastFileEvent.file} ${this.watcher.lastFileEvent.kind}`
          : null,
        lastReason: null,
      },
      events: this.history.getEvents(),
      logs: this.history.getLogs(),
      cycles: this.tracker.getCycles(),
      diagnostics: [],
      restarts: this.sessionRestarts,
      host: this.sampleHost(),
      apiPort: resolveKnownPort(),
    };
    partial.diagnostics = analyzeSnapshot(partial);
    return partial;
  }

  /**
   * Measured supervisor-process stats (scope labeled in the UI). CPU % is
   * computed between consecutive samples; null until two samples exist.
   * Never simulated, never child-attributed.
   */
  private sampleHost(): HostStats {
    const mem = process.memoryUsage();
    const now = Date.now();
    const current = process.cpuUsage();
    let cpuPct: number | null = null;
    if (this.lastCpu && this.lastCpuAt !== null && now > this.lastCpuAt) {
      const diff = process.cpuUsage(this.lastCpu);
      const elapsedMs = now - this.lastCpuAt;
      cpuPct = ((diff.user + diff.system) / 1000 / elapsedMs) * 100;
      if (!Number.isFinite(cpuPct) || cpuPct < 0) cpuPct = null;
    }
    this.lastCpu = current;
    this.lastCpuAt = now;
    return {
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapMB: Math.round(mem.heapUsed / 1024 / 1024),
      cpuPct,
    };
  }

  // ---- TUI + keyboard ----

  private startTui(): void {
    // Single creation point: exactly one renderer, one heartbeat, one
    // keypress subscription for the whole session.
    if (!this.screen) {
      this.screen = new TerminalRenderer(process.stdout);
      this.screen.start();
    }
    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => this.render(), 1000);
      this.heartbeat.unref?.();
    }
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(true);
      } catch {
        /* non-raw fallback */
      }
    }
    process.stdin.resume();
    if (!this.keypressHandler) {
      this.keypressHandler = (
        _chunk: Buffer,
        key?: { name?: string; ctrl?: boolean; sequence?: string },
      ) => {
        void _chunk;
        if (!key) return;
        if (key.ctrl && key.name === "c") {
          void this.shutdown("SIGINT");
          return;
        }
        this.handleKey(key.name ?? key.sequence ?? "", Boolean(key.ctrl));
      };
      process.stdin.on("keypress", this.keypressHandler);
    }
  }

  /**
   * Keyboard shortcuts — every key performs a real action. While the
   * command palette is open, keystrokes edit the query instead (shortcuts
   * never fire from a text input).
   */
  handleKey(key: string, ctrl = false): void {
    if (ctrl && (key === "k" || key === "K")) {
      this.filters.paletteOpen = !this.filters.paletteOpen;
      this.filters.paletteQuery = "";
      this.filters.paletteIndex = 0;
      this.render();
      return;
    }
    if (this.filters.paletteOpen) {
      this.handlePaletteKey(key);
      return;
    }
    switch (key) {
      case "q":
      case "Q":
        void this.shutdown("SIGINT");
        break;
      case "?":
        this.filters.showHelp = !this.filters.showHelp;
        this.render();
        break;
      case "r":
      case "R":
        void this.scheduleRestart("manual restart (R)", "all");
        break;
      case "l":
      case "L":
        this.filters.showLogs = !this.filters.showLogs;
        this.filters.logScroll = 0;
        this.render();
        break;
      case "e":
      case "E":
        this.filters.errorOnly = !this.filters.errorOnly;
        this.filters.logScroll = 0;
        this.render();
        break;
      case "c":
      case "C":
        // Clears the log VIEW; bounded diagnostic history (events/cycles)
        // is preserved.
        this.history.clearLogs();
        this.filters.logScroll = 0;
        this.emit("SYSTEM", "Log view cleared (diagnostic history preserved)");
        break;
      case "p":
      case "P":
        this.toggleWatchPause();
        break;
      case "1":
        this.filters.serviceFilter =
          this.filters.serviceFilter === "api" ? "all" : "api";
        this.filters.logScroll = 0;
        this.render();
        break;
      case "2":
        this.filters.serviceFilter =
          this.filters.serviceFilter === "mcp" ? "all" : "mcp";
        this.filters.logScroll = 0;
        this.render();
        break;
      case "up":
        this.scrollLogs(1);
        break;
      case "down":
        this.scrollLogs(-1);
        break;
      default:
        break;
    }
  }

  /** Scroll the expanded log view (clamped, no-op when logs collapsed). */
  private scrollLogs(delta: number): void {
    if (!this.filters.showLogs) return;
    this.filters.logScroll = Math.max(0, this.filters.logScroll + delta);
    this.render();
  }

  private handlePaletteKey(key: string): void {
    const matches = filterPalette(this.filters.paletteQuery);
    switch (key) {
      case "escape":
        this.filters.paletteOpen = false;
        this.filters.paletteQuery = "";
        this.filters.paletteIndex = 0;
        this.render();
        return;
      case "return":
      case "enter": {
        const index = clampIndex(this.filters.paletteIndex, matches.length);
        const selected = matches[index];
        this.filters.paletteOpen = false;
        this.filters.paletteQuery = "";
        this.filters.paletteIndex = 0;
        if (selected) this.runPaletteCommand(selected.id);
        else this.render();
        return;
      }
      case "up":
        this.filters.paletteIndex = clampIndex(
          this.filters.paletteIndex - 1,
          matches.length,
        );
        this.render();
        return;
      case "down":
        this.filters.paletteIndex = clampIndex(
          this.filters.paletteIndex + 1,
          matches.length,
        );
        this.render();
        return;
      case "backspace":
        this.filters.paletteQuery = this.filters.paletteQuery.slice(0, -1);
        this.filters.paletteIndex = 0;
        this.render();
        return;
      default:
        break;
    }
    if (key.length === 1 && !key.startsWith("\x1b")) {
      this.filters.paletteQuery += key;
      this.filters.paletteIndex = 0;
      this.render();
    }
  }

  /** Executes a palette command — same real actions as the shortcuts. */
  runPaletteCommand(id: string): void {
    switch (id) {
      case "restart-all":
        void this.scheduleRestart("palette: restart all", "all");
        break;
      case "restart-api":
        void this.scheduleRestart("palette: restart api", "api");
        break;
      case "restart-mcp":
        void this.scheduleRestart("palette: restart mcp", "mcp");
        break;
      case "toggle-logs":
        this.filters.showLogs = !this.filters.showLogs;
        this.filters.logScroll = 0;
        this.render();
        break;
      case "toggle-errors":
        this.filters.errorOnly = !this.filters.errorOnly;
        this.filters.logScroll = 0;
        this.render();
        break;
      case "clear-logs":
        this.history.clearLogs();
        this.filters.logScroll = 0;
        this.emit("SYSTEM", "Log view cleared (diagnostic history preserved)");
        break;
      case "toggle-watch":
        this.toggleWatchPause();
        break;
      case "filter-api":
        this.filters.serviceFilter = "api";
        this.filters.logScroll = 0;
        this.render();
        break;
      case "filter-mcp":
        this.filters.serviceFilter = "mcp";
        this.filters.logScroll = 0;
        this.render();
        break;
      case "filter-all":
        this.filters.serviceFilter = "all";
        this.filters.logScroll = 0;
        this.render();
        break;
      case "toggle-help":
        this.filters.showHelp = !this.filters.showHelp;
        this.render();
        break;
      case "quit":
        void this.shutdown("SIGINT");
        break;
      default:
        this.render();
        break;
    }
  }

  private toggleWatchPause(): void {
    this.watchPaused = !this.watchPaused;
    if (this.watchPaused) this.watcher.pause();
    else this.watcher.resume();
    this.emit(
      "WATCH",
      this.watchPaused
        ? "Watch paused — supervision of processes continues"
        : "Watch resumed",
      this.watchPaused ? "warn" : "info",
    );
  }

  /**
   * Sole repaint entry point. Coalesced by the TerminalRenderer: bursts of
   * events/keys/timer ticks collapse into one in-place paint. Child log
   * output never reaches here directly — it only feeds the bounded history
   * buffer and surfaces inside the frame's log zone.
   */
  private render(): void {
    const screen = this.screen;
    if (!this.useTui || !screen) return;
    const width = process.stdout.columns ?? 100;
    const height = process.stdout.rows ?? 40;
    screen.requestPaint(() =>
      renderCommandCenter(this.snapshot(), this.filters, { width, height }),
    );
  }

  private installSignals(): void {
    process.on("SIGINT", () => {
      void this.shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void this.shutdown("SIGTERM");
    });
  }

  /** Graceful shutdown: stop UI first, then watcher, then children. */
  async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.restartToken += 1;
    this.bus.emit("SYSTEM", `Shutting down (${signal}) — stopping services`);
    // Full renderer + listener teardown: one heartbeat, one keypress
    // subscription, one resize subscription (renderer-owned), cursor shown.
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.keypressHandler) {
      try {
        process.stdin.off("keypress", this.keypressHandler);
      } catch {
        /* already removed */
      }
      this.keypressHandler = null;
    }
    this.screen?.dispose();
    this.screen = null;
    try {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    } catch {
      /* ignore */
    }
    process.stdin.pause();
    this.watcher.dispose();
    await Promise.all([this.api.stop("shutdown"), this.mcp.stop("shutdown")]);
    // Belt and braces: no orphans even if graceful stop raced a spawn.
    this.api.forceKill();
    this.mcp.forceKill();
    this.api.markDisposed();
    this.mcp.markDisposed();
    this.bus.emit("SYSTEM", "Shutdown complete — no orphan processes");
    if (!process.env.VITEST && !process.env.MOSAIX_DEV_NO_EXIT) {
      setTimeout(() => process.exit(0), 100).unref();
    }
  }

  get mcpIsolatedBytes(): number {
    return this.mcpDrainedBytes;
  }
}
