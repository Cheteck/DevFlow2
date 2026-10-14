/**
 * @mosaix/dev-server — supervised child process with honest readiness.
 *
 * Guarantees:
 * - api and mcp are supervised independently (one instance per manager);
 * - spawn `error` events are surfaced, never unhandled;
 * - early exits (before handlers settle) are observed;
 * - graceful stop with capped timeout + forced kill fallback;
 * - exponential capped backoff on unexpected crashes;
 * - MCP stdout stays piped & drained but NEVER forwarded to the UI
 *   (stdio protocol isolation);
 * - every externally visible string passes through secret redaction.
 */
import { spawn, type ChildProcess } from "node:child_process";
import type {
  EventLevel,
  LogStream,
  ServiceName,
  ServiceState,
} from "./supervisor-types.js";
import { redactSecrets } from "./secret-guard.js";

export interface ReadinessSpec {
  /** Log line proving the service accepts work (e.g. /listening on/i). */
  pattern?: RegExp;
  timeoutMs?: number;
  /**
   * Log lines proving the service CANNOT serve (e.g. EADDRINUSE). Checked
   * on every chunk while STARTING or RUNNING-unconfirmed. Defaults cover
   * the classic Node listen failures.
   */
  failurePatterns?: RegExp[];
}

export interface ManagedProcessOptions {
  name: ServiceName;
  label: string;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  readiness?: ReadinessSpec;
  readinessTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  backoffInitialMs?: number;
  backoffMaxMs?: number;
  maxRestartsPerMinute?: number;
  isolateStdout?: boolean;
  onEvent: (
    category: "API" | "MCP" | "SYSTEM",
    message: string,
    level?: EventLevel,
  ) => void;
  onLog: (
    service: ServiceName,
    stream: LogStream,
    text: string,
    level?: EventLevel,
  ) => void;
  onStdoutDrained?: (bytes: number) => void;
}

const DEFAULT_SHUTDOWN_MS = 5000;
const DEFAULT_READINESS_MS = 25000;

/** Boot failures that prove "alive process" ≠ "serving". Checked first. */
const DEFAULT_FAILURE_PATTERNS: RegExp[] = [
  /EADDRINUSE/i,
  /address already in use/i,
  /error:\s*listen/i,
  /listen\s+EACCES/i,
  /EACCES.*permission denied/i,
];

export class ManagedProcess {
  readonly name: ServiceName;
  readonly label: string;

  private child: ChildProcess | null = null;
  private state: ServiceState = "STOPPED";
  private pid: number | null = null;
  private startTime: number | null = null;
  private readyAt: number | null = null;
  private restarts = 0;
  private lastExitCode: number | null = null;
  private lastSignal: string | null = null;
  private lastError: string | null = null;
  private expectedStop = false;
  private spawnFailed = false;
  private backoffMs: number;
  private readonly backoffMax: number;
  private readonly backoffInitial: number;
  private restartMarks: number[] = [];
  private disposed = false;
  private readyResolve: (() => void) | null = null;
  private readyTimer: NodeJS.Timeout | null = null;
  private mcpStdoutBytes = 0;
  private failureSummary: string | null = null;

  constructor(private readonly opts: ManagedProcessOptions) {
    this.name = opts.name;
    this.label = opts.label;
    this.backoffInitial = opts.backoffInitialMs ?? 500;
    this.backoffMax = opts.backoffMaxMs ?? 8000;
    this.backoffMs = this.backoffInitial;
  }

  get currentState(): ServiceState {
    return this.state;
  }

  get isAlive(): boolean {
    return (
      this.child !== null &&
      this.child.exitCode === null &&
      this.child.signalCode === null &&
      !this.spawnFailed
    );
  }

  get restartCount(): number {
    return this.restarts;
  }

  snapshotBoot(): {
    pid: number | null;
    uptimeMs: number | null;
    lastBootMs: number | null;
  } {
    const uptimeMs =
      this.startTime !== null && this.isAlive
        ? Date.now() - this.startTime
        : null;
    const lastBootMs =
      this.startTime !== null && this.readyAt !== null
        ? this.readyAt - this.startTime
        : null;
    return { pid: this.pid, uptimeMs, lastBootMs };
  }

  get lastExit(): { code: number | null; signal: string | null } {
    return { code: this.lastExitCode, signal: this.lastSignal };
  }

  get error(): string | null {
    return this.lastError;
  }

  /** Honest readiness label: READY only when a real signal confirmed it. */
  readinessLabel(): string {
    if (this.state === "READY") return "confirmed";
    if (this.state === "FAILED") return "startup failed";
    if (this.opts.readiness?.pattern) return "awaiting log signal";
    return "readiness unknown (no probe)";
  }

  /** Concise startup-failure summary, if a boot failure was observed. */
  get startupFailure(): string | null {
    return this.failureSummary;
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    if (this.state === "STARTING" || this.isAlive) return;
    if (this.child) {
      // Defensive: never stack two children for one service.
      await this.stop("restart-cleanup").catch(() => undefined);
    }
    this.expectedStop = false;
    this.spawnFailed = false;
    this.failureSummary = null;
    this.state = "STARTING";
    this.startTime = Date.now();
    this.readyAt = null;
    const tag = this.name === "api" ? "API" : "MCP";

    let child: ChildProcess;
    // Shell is only needed to resolve bare bin names (npx/tsx/pnpm.cmd)
    // on Windows. Absolute paths (.exe) and POSIX bins spawn directly.
    // When a shell is needed the command is joined into ONE string (the
    // tokens we spawn never contain spaces) — passing an args array with
    // shell:true would trigger DEP0190 and break paths with spaces
    // such as `C:\Program Files\nodejs\node.exe`.
    const needsShell =
      process.platform === "win32" &&
      !/[/\\]/.test(this.opts.command) &&
      !/\.exe$/i.test(this.opts.command);
    const spawnCommand = needsShell
      ? [this.opts.command, ...this.opts.args].join(" ")
      : this.opts.command;
    const spawnArgs = needsShell ? [] : this.opts.args;
    try {
      child = spawn(spawnCommand, spawnArgs, {
        cwd: this.opts.cwd,
        env: this.opts.env ?? process.env,
        shell: needsShell,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      this.spawnFailed = true;
      this.state = "CRASHED";
      this.lastError = redactSecrets(
        err instanceof Error ? err.message : String(err),
      );
      this.opts.onEvent(
        tag,
        `Process spawn failed: ${this.lastError}`,
        "error",
      );
      return;
    }
    this.child = child;
    this.pid = child.pid ?? null;
    this.opts.onEvent(
      tag,
      `New process spawned${this.pid ? ` (pid ${this.pid})` : ""}`,
    );

    // Spawn errors (ENOENT, EACCES…) arrive as 'error' — must be observed
    // or Node throws unhandled. This also covers failures before 'exit'.
    child.on("error", (err: Error) => {
      this.spawnFailed = true;
      this.lastError = redactSecrets(err.message);
      this.state = "CRASHED";
      this.opts.onEvent(tag, `Process error: ${this.lastError}`, "error");
      this.clearReadyWait();
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      if (this.opts.isolateStdout) {
        // MCP protocol stream: drain to avoid backpressure, never display.
        this.mcpStdoutBytes += chunk.length;
        this.opts.onStdoutDrained?.(chunk.length);
        return;
      }
      const text = chunk.toString("utf8");
      this.opts.onLog(this.name, "stdout", text);
      if (!this.checkBootFailure(text)) this.checkReadiness(text);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      this.opts.onLog(this.name, "stderr", text);
      if (!this.checkBootFailure(text)) this.checkReadiness(text);
    });

    // Early-exit race: the child may die before handlers settle. Observe on
    // next tick as well as on 'exit' so nothing is missed.
    setImmediate(() => {
      if (child.exitCode !== null || child.signalCode !== null) {
        this.handleExit(child.exitCode, child.signalCode);
      }
    });
    child.on("exit", (code, signal) => this.handleExit(code, signal));

    // No readiness pattern (MCP stdio) => RUNNING as soon as spawned.
    if (!this.opts.readiness?.pattern) {
      if (this.state === "STARTING") this.state = "RUNNING";
    } else {
      const timeout =
        this.opts.readinessTimeoutMs ??
        this.opts.readiness.timeoutMs ??
        DEFAULT_READINESS_MS;
      this.readyTimer = setTimeout(() => {
        if (this.state === "STARTING") {
          this.state = "RUNNING";
          this.opts.onEvent(
            tag,
            "Readiness not confirmed within budget — marked RUNNING (not READY)",
            "warn",
          );
        }
      }, timeout);
      this.readyTimer.unref?.();
    }
  }

  /**
   * Boot-failure scan. Runs BEFORE the readiness check on every chunk.
   * A live process whose server reports EADDRINUSE (or sibling listen
   * failures) is NOT operational: flip to FAILED with a concise summary.
   * Applies while STARTING or RUNNING-unconfirmed for services that own a
   * readiness contract. Returns true when a failure was recorded.
   */
  private checkBootFailure(text: string): boolean {
    if (this.state !== "STARTING" && this.state !== "RUNNING") return false;
    if (!this.opts.readiness?.pattern) return false;
    const patterns =
      this.opts.readiness.failurePatterns ?? DEFAULT_FAILURE_PATTERNS;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (patterns.some((pattern) => pattern.test(trimmed))) {
        this.failureSummary = summarizeFailureLine(trimmed);
        this.lastError = redactSecrets(trimmed).slice(0, 300);
        this.state = "FAILED";
        this.clearReadyWait();
        const tag = this.name === "api" ? "API" : "MCP";
        this.opts.onEvent(
          tag,
          `Startup failure: ${this.failureSummary} (process alive but NOT serving)`,
          "error",
        );
        return true;
      }
    }
    return false;
  }

  private checkReadiness(text: string): void {
    const pattern = this.opts.readiness?.pattern;
    if (!pattern || this.state !== "STARTING") return;
    if (pattern.test(text)) {
      this.readyAt = Date.now();
      this.state = "READY";
      this.clearReadyWait();
      const ms = this.startTime ? this.readyAt - this.startTime : 0;
      const tag = this.name === "api" ? "API" : "MCP";
      this.opts.onEvent(tag, `Ready in ${ms} ms (readiness signal observed)`);
    }
  }

  private clearReadyWait(): void {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    this.readyResolve = null;
  }

  private handleExit(code: number | null, signal: string | null): void {
    const wasExpected = this.expectedStop;
    this.lastExitCode = code;
    this.lastSignal = signal;
    this.pid = null;
    this.child = null;
    this.clearReadyWait();
    const tag = this.name === "api" ? "API" : "MCP";
    if (wasExpected) {
      this.state = "STOPPED";
      this.backoffMs = this.backoffInitial;
      this.opts.onEvent(
        tag,
        `Process terminated (code=${code ?? "?"} signal=${signal ?? "?"})`,
      );
      return;
    }
    this.state = "CRASHED";
    if (code !== null && code !== 0) {
      this.lastError = `exited with code ${code}`;
    } else if (signal) {
      this.lastError = `terminated by signal ${signal}`;
    }
    this.opts.onEvent(
      tag,
      `Unexpected exit (code=${code ?? "?"} signal=${signal ?? "?"}) — backoff ${this.backoffMs} ms`,
      "error",
    );
  }

  waitForExit(): Promise<void> {
    const child = this.child;
    if (!child) return Promise.resolve();
    if (child.exitCode !== null || child.signalCode !== null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      child.once("exit", () => resolve());
    });
  }

  waitForReady(timeoutMs?: number): Promise<boolean> {
    if (this.state === "READY" || this.state === "RUNNING") {
      return Promise.resolve(true);
    }
    if (
      this.state === "FAILED" ||
      this.state === "CRASHED" ||
      this.state === "STOPPED"
    ) {
      return Promise.resolve(false);
    }
    const budget =
      timeoutMs ?? this.opts.readinessTimeoutMs ?? DEFAULT_READINESS_MS;
    return new Promise((resolve) => {
      this.readyResolve = () => resolve(true);
      const timer = setTimeout(() => {
        this.readyResolve = null;
        resolve(this.state === "READY" || this.state === "RUNNING");
      }, budget);
      timer.unref?.();
      const poll = setInterval(() => {
        if (this.state === "READY" || this.state === "RUNNING") {
          clearTimeout(timer);
          clearInterval(poll);
          resolve(true);
        } else if (
          this.state === "FAILED" ||
          this.state === "CRASHED" ||
          this.state === "STOPPED"
        ) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve(false);
        }
      }, 50);
      poll.unref?.();
    });
  }

  /** Graceful stop: SIGTERM, capped wait, then SIGKILL. Always resolves. */
  async stop(
    _reason = "stop",
  ): Promise<{ code: number | null; signal: string | null }> {
    const child = this.child;
    if (!child || !this.isAlive) {
      this.state = this.state === "CRASHED" ? "CRASHED" : "STOPPED";
      return { code: this.lastExitCode, signal: this.lastSignal };
    }
    this.expectedStop = true;
    this.state = "STOPPING";
    const timeoutMs = this.opts.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_MS;
    const exited = this.waitForExit();
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
    // Windows: SIGTERM only terminates the wrapper (cmd/npx) — the real
    // servers underneath would be orphaned. Give them a short grace
    // period, then terminate the whole tree instead of waiting out the
    // full shutdown budget.
    const graceMs =
      process.platform === "win32" ? Math.min(1000, timeoutMs) : timeoutMs;
    const winner = await Promise.race([
      exited.then(() => "exited" as const),
      new Promise<"timeout">((resolve) => {
        const t = setTimeout(() => resolve("timeout"), graceMs);
        t.unref?.();
      }),
    ]);
    if (winner === "timeout" && this.isAlive) {
      this.killTree();
      await Promise.race([
        exited,
        new Promise<void>((resolve) => {
          const t = setTimeout(
            () => resolve(),
            Math.max(0, timeoutMs - graceMs),
          );
          t.unref?.();
        }),
      ]);
    } else {
      await exited;
    }
    this.child = null;
    this.state = "STOPPED";
    return { code: this.lastExitCode, signal: this.lastSignal };
  }

  /**
   * Crash backoff decision: capped exponential delay, or null when the
   * service restarts too often (caller should surface a diagnostic and
   * stop auto-cycling).
   */
  nextBackoffDelay(): number | null {
    const now = Date.now();
    const windowMs = 60_000;
    this.restartMarks = this.restartMarks.filter((t) => now - t < windowMs);
    const maxPerMinute = this.opts.maxRestartsPerMinute ?? 5;
    if (this.restartMarks.length >= maxPerMinute) return null;
    this.restartMarks.push(now);
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, this.backoffMax);
    return delay;
  }

  noteManualRestart(): void {
    this.restarts += 1;
    this.backoffMs = this.backoffInitial;
  }

  markDisposed(): void {
    this.disposed = true;
    this.clearReadyWait();
  }

  forceKill(): void {
    this.killTree();
  }

  /**
   * On Windows a graceful signal only reaches the direct child (cmd/npx
   * wrapper) — grandchildren (tsx, node) would be orphaned. taskkill /T
   * terminates the whole tree. POSIX falls back to SIGKILL.
   */
  private killTree(): void {
    const child = this.child;
    if (!child) return;
    if (process.platform === "win32" && child.pid !== undefined) {
      try {
        const killer = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          {
            stdio: "ignore",
            windowsHide: true,
          },
        );
        killer.on("error", () => {
          try {
            child.kill("SIGKILL");
          } catch {
            /* ignore */
          }
        });
        return;
      } catch {
        /* fall through to SIGKILL */
      }
    }
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

/**
 * Collapse a raw boot-failure line into a one-line human summary.
 * Keeps the error code and the actionable noun (port/path), drops stack
 * prefixes and secrets (values are redacted upstream anyway).
 */
export function summarizeFailureLine(line: string): string {
  const clean = redactSecrets(line)
    .replace(/^\s*(Error|error|FAIL|fatal):?\s*/, "")
    .trim();
  const codeMatch = clean.match(
    /\b(EADDRINUSE|EACCES|ENOENT|ECONNREFUSED|EPIPE)\b/i,
  );
  const code = codeMatch ? codeMatch[1].toUpperCase() : null;
  const portMatch = clean.match(/:::?(\d{2,5})\b|:(\d{2,5})\b/);
  const port = portMatch ? (portMatch[1] ?? portMatch[2]) : null;
  if (code === "EADDRINUSE" && port) return `port ${port} in use (${code})`;
  if (code === "EADDRINUSE") return `address in use (${code})`;
  if (code === "EACCES")
    return `permission denied binding${port ? ` :${port}` : ""} (${code})`;
  if (code) return `${clean.slice(0, 90)} (${code})`;
  return clean.slice(0, 120) || "startup failed";
}
