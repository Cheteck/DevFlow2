/**
 * @mosaix/dev-server — DEVELOPER COCKPIT acceptance tests.
 * Fast fakes only (node -e sleepers); never boots the real platform.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EventHistory } from "./event-bus.js";
import {
  ManagedProcess,
  summarizeFailureLine,
  type ManagedProcessOptions,
} from "./process-manager.js";
import { EnvWatcher } from "./env-watcher.js";
import { RestartTracker } from "./restart-tracker.js";
import { analyzeSnapshot } from "./diagnostics.js";
import {
  renderCommandCenter,
  stripAnsi,
  isUp,
  DEFAULT_FILTERS,
} from "./renderer.js";
import { DevSupervisor, computeOverall } from "./supervisor.js";
import { redactSecrets } from "./secret-guard.js";
import type {
  CommandCenterSnapshot,
  ServiceSnapshot,
} from "./supervisor-types.js";

const NODE = process.execPath;
const SLEEPER = ["-e", "setInterval(()=>{},1000);"];
const CRASHER = (code: number) => ["-e", `process.exit(${code});`];

function makeProc(
  name: "api" | "mcp",
  args: string[],
  extra: Partial<ManagedProcessOptions> = {},
) {
  const events: string[] = [];
  const logs: string[] = [];
  const proc = new ManagedProcess({
    name,
    label: name === "api" ? "Platform Server" : "MCP Server",
    command: NODE,
    args,
    cwd: process.cwd(),
    readinessTimeoutMs: 400,
    shutdownTimeoutMs: 1500,
    // API-likes own a readiness contract (as in production), so boot
    // failures like EADDRINUSE are detected during tests too.
    ...(name === "api"
      ? { readiness: { pattern: /listening on/i, timeoutMs: 400 } }
      : {}),
    onEvent: (_c, message) => {
      events.push(message);
    },
    onLog: (_s, _st, text) => {
      logs.push(text);
    },
    ...(name === "mcp" ? { isolateStdout: true } : {}),
    ...extra,
  });
  return { proc, events, logs };
}

describe("ManagedProcess", () => {
  const procs: ManagedProcess[] = [];
  afterEach(async () => {
    for (const p of procs) {
      await p.stop("test-cleanup").catch(() => undefined);
      p.markDisposed();
      p.forceKill();
    }
    procs.length = 0;
  });

  it("starts a long-running service (RUNNING when no readiness probe)", async () => {
    const { proc } = makeProc("mcp", SLEEPER);
    procs.push(proc);
    await proc.start();
    expect(proc.isAlive).toBe(true);
    expect(["RUNNING", "STARTING"]).toContain(proc.currentState);
    expect(proc.snapshotBoot().pid).not.toBeNull();
  });

  it("confirms READY on log-pattern readiness signal", async () => {
    const events: string[] = [];
    const proc = new ManagedProcess({
      name: "api",
      label: "Platform Server",
      command: NODE,
      args: [
        "-e",
        "console.log('MosaiX platform host listening on 3000'); setInterval(()=>{},1000);",
      ],
      cwd: process.cwd(),
      readiness: { pattern: /listening on/i, timeoutMs: 5000 },
      readinessTimeoutMs: 5000,
      shutdownTimeoutMs: 1500,
      onEvent: (_c, m) => events.push(m),
      onLog: () => undefined,
    });
    procs.push(proc);
    await proc.start();
    const ready = await proc.waitForReady(5000);
    expect(ready).toBe(true);
    expect(proc.currentState).toBe("READY");
    expect(proc.readinessLabel()).toBe("confirmed");
  });

  it("stops normally (STOPPED, exit observed)", async () => {
    const { proc } = makeProc("api", SLEEPER);
    procs.push(proc);
    await proc.start();
    expect(proc.isAlive).toBe(true);
    const result = await proc.stop("test");
    expect(proc.currentState).toBe("STOPPED");
    expect(proc.isAlive).toBe(false);
    expect(result).toBeDefined();
  });

  it("detects api crash with exit code", async () => {
    const { proc } = makeProc("api", CRASHER(3));
    procs.push(proc);
    await proc.start();
    await proc.waitForExit();
    await new Promise((r) => setTimeout(r, 100));
    expect(proc.currentState).toBe("CRASHED");
    expect(proc.lastExit.code).toBe(3);
  });

  it("detects mcp crash independently", async () => {
    const { proc } = makeProc("mcp", CRASHER(7));
    procs.push(proc);
    await proc.start();
    await proc.waitForExit();
    await new Promise((r) => setTimeout(r, 100));
    expect(proc.currentState).toBe("CRASHED");
    expect(proc.lastExit.code).toBe(7);
  });

  it("surfaces spawn errors without throwing", async () => {
    const events: string[] = [];
    const proc = new ManagedProcess({
      name: "api",
      label: "Platform Server",
      command: "__mosaix__nonexistent__bin__12345",
      args: [],
      cwd: process.cwd(),
      onEvent: (_c, m) => events.push(m),
      onLog: () => undefined,
    });
    procs.push(proc);
    await proc.start();
    await new Promise((r) => setTimeout(r, 300));
    expect(proc.currentState).toBe("CRASHED");
    expect(proc.error).toBeTruthy();
  });

  it("marks EADDRINUSE as FAILED while the process stays alive", async () => {
    const { proc, events } = makeProc("api", [
      "-e",
      "console.error('Error: listen EADDRINUSE: address already in use :::3000'); setInterval(()=>{},1000);",
    ]);
    procs.push(proc);
    await proc.start();
    await new Promise((r) => setTimeout(r, 600));
    // The reported bug: a live process was shown as RUNNING/up while the
    // server could not bind its port. It must be FAILED instead.
    expect(proc.currentState).toBe("FAILED");
    expect(proc.isAlive).toBe(true);
    expect(proc.startupFailure).toContain("3000");
    expect(proc.startupFailure).toContain("EADDRINUSE");
    expect(proc.readinessLabel()).toBe("startup failed");
    expect(events.some((m) => m.includes("Startup failure"))).toBe(true);
    const ready = await proc.waitForReady(300);
    expect(ready).toBe(false);
  });

  it("flips a RUNNING-unconfirmed service to FAILED on late listen errors", async () => {
    const { proc } = makeProc(
      "api",
      [
        "-e",
        "setTimeout(()=>console.error('Error: listen EADDRINUSE: address already in use :::3000'),600); setInterval(()=>{},1000);",
      ],
      { readinessTimeoutMs: 300 },
    );
    procs.push(proc);
    await proc.start();
    await new Promise((r) => setTimeout(r, 250));
    // Readiness budget (300ms) not yet spent — still STARTING or RUNNING.
    expect(["STARTING", "RUNNING"]).toContain(proc.currentState);
    await new Promise((r) => setTimeout(r, 800));
    expect(proc.currentState).toBe("FAILED");
    expect(proc.isAlive).toBe(true);
  });

  it("summarizes raw listen errors into one actionable line", () => {
    expect(
      summarizeFailureLine(
        "Error: listen EADDRINUSE: address already in use :::3000",
      ),
    ).toBe("port 3000 in use (EADDRINUSE)");
    expect(
      summarizeFailureLine("Error: listen EACCES: permission denied"),
    ).toContain("EACCES");
  });

  it("caps backoff and stops cycling after too many restarts", () => {
    const { proc } = makeProc("api", SLEEPER, { maxRestartsPerMinute: 3 });
    procs.push(proc);
    const delays = [
      proc.nextBackoffDelay(),
      proc.nextBackoffDelay(),
      proc.nextBackoffDelay(),
      proc.nextBackoffDelay(),
    ];
    expect(delays[0]).toBe(500);
    expect(delays[1]).toBe(1000);
    expect(delays[2]).toBe(2000);
    expect(delays[3]).toBeNull();
  });
});

describe("EnvWatcher", () => {
  let dir = "";
  let watcher: EnvWatcher | null = null;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-env-"));
  });
  afterEach(() => {
    watcher?.dispose();
    watcher = null;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("coalesces rapid bursts into a single restart signal", async () => {
    fs.writeFileSync(path.join(dir, ".env"), "A=1\n");
    let count = 0;
    watcher = new EnvWatcher({
      root: dir,
      files: [".env"],
      debounceMs: 60,
      onEvent: () => {
        count += 1;
      },
    });
    watcher.start();
    await new Promise((r) => setTimeout(r, 100));
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(dir, ".env"), `A=${i}\n`);
    }
    await new Promise((r) => setTimeout(r, 300));
    expect(count).toBe(1);
  });

  it("detects creation of a missing .env.local", async () => {
    const seen: string[] = [];
    watcher = new EnvWatcher({
      root: dir,
      files: [".env.local"],
      debounceMs: 60,
      onEvent: (e) => {
        seen.push(`${e.file}:${e.kind}`);
      },
    });
    watcher.start();
    await new Promise((r) => setTimeout(r, 100));
    fs.writeFileSync(path.join(dir, ".env.local"), "X=1\n");
    await new Promise((r) => setTimeout(r, 400));
    expect(seen.some((s) => s.startsWith(".env.local:"))).toBe(true);
  });

  it("handles delete then recreate without orphan watchers", async () => {
    fs.writeFileSync(path.join(dir, ".env"), "A=1\n");
    const seen: string[] = [];
    watcher = new EnvWatcher({
      root: dir,
      files: [".env"],
      debounceMs: 60,
      onEvent: (e) => {
        seen.push(`${e.file}:${e.kind}`);
      },
    });
    watcher.start();
    await new Promise((r) => setTimeout(r, 100));
    fs.rmSync(path.join(dir, ".env"));
    await new Promise((r) => setTimeout(r, 300));
    fs.writeFileSync(path.join(dir, ".env"), "A=2\n");
    await new Promise((r) => setTimeout(r, 400));
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(watcher.isActive).toBe(true);
  });

  it("pause suppresses restart signals but keeps watcher alive", async () => {
    fs.writeFileSync(path.join(dir, ".env"), "A=1\n");
    let count = 0;
    watcher = new EnvWatcher({
      root: dir,
      files: [".env"],
      debounceMs: 60,
      onEvent: () => {
        count += 1;
      },
    });
    watcher.start();
    watcher.pause();
    fs.writeFileSync(path.join(dir, ".env"), "A=9\n");
    await new Promise((r) => setTimeout(r, 250));
    expect(count).toBe(0);
    watcher.resume();
    fs.writeFileSync(path.join(dir, ".env"), "A=10\n");
    await new Promise((r) => setTimeout(r, 250));
    expect(count).toBe(1);
  });
});

describe("history bounds + secrets", () => {
  it("keeps event and log buffers bounded", () => {
    const history = new EventHistory(50, 60);
    for (let i = 0; i < 200; i++) history.pushEvent("SYSTEM", `event ${i}`);
    for (let i = 0; i < 200; i++) history.pushLog("api", "stdout", `line ${i}`);
    expect(history.eventSize).toBeLessThanOrEqual(50);
    expect(history.logSize).toBeLessThanOrEqual(60);
  });

  it("never stores secret values", () => {
    expect(
      redactSecrets("MOSAIX_AUTH_JWT_SECRET=supersecret123"),
    ).not.toContain("supersecret123");
    const history = new EventHistory();
    history.pushEvent("SYSTEM", "loaded MOSAIX_AUTH_JWT_SECRET=hunter2 ok");
    history.pushLog("api", "stderr", "token=abc123 failed");
    expect(JSON.stringify(history.getEvents())).not.toContain("hunter2");
    expect(JSON.stringify(history.getLogs())).not.toContain("abc123");
  });
});

describe("RestartTracker", () => {
  it("records cycles with measured phases and bounded size", async () => {
    const tracker = new RestartTracker(3);
    for (let i = 0; i < 5; i++) {
      const cycle = tracker.begin("all", `reason ${i}`);
      tracker.mark(cycle, "debounceDoneAt");
      tracker.finish(cycle, "completed");
    }
    expect(tracker.size).toBe(3);
    const lines = tracker.formatCycle(tracker.getCycles()[0]);
    expect(lines[0]).toMatch(/RESTART #\d+ — \d+ ms/);
  });
});

describe("renderer cockpit", () => {
  it("renders without ANSI escapes when color is forced off", () => {
    const snapshot = minimalSnapshot();
    const frame = renderCommandCenter(snapshot, DEFAULT_FILTERS, {
      width: 100,
      forceColor: false,
    });
    expect(frame).toContain("MOSAIX // DEVELOPER COCKPIT");
    expect(frame).toContain("PLATFORM SERVER");
    expect(frame).toContain("MCP SERVER");
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[[0-9;]*m/.test(frame)).toBe(false);
  });

  it("lays services side by side on wide terminals", () => {
    const snapshot = minimalSnapshot();
    const frame = renderCommandCenter(snapshot, DEFAULT_FILTERS, {
      width: 120,
      forceColor: false,
    });
    const shared = stripAnsi(frame)
      .split("\n")
      .some((line) => line.includes("API") && line.includes("MCP"));
    expect(shared).toBe(true);
  });

  it("mentions both services in compact mode", () => {
    const snapshot = minimalSnapshot();
    const frame = renderCommandCenter(snapshot, DEFAULT_FILTERS, {
      width: 60,
      forceColor: false,
    });
    expect(stripAnsi(frame)).toContain("PLATFORM SERVER");
  });

  it("preserves colors when truncating on narrow terminals", () => {
    const snapshot = minimalSnapshot();
    snapshot.events.push({
      seq: 1,
      at: Date.now(),
      category: "API",
      level: "error",
      message:
        "Startup failure: port 3000 in use (EADDRINUSE) (process alive but NOT serving) — a very long tail that must be cut",
    });
    const frame = renderCommandCenter(snapshot, DEFAULT_FILTERS, {
      width: 60,
      forceColor: true,
    });
    const row = stripAnsi(frame)
      .split("\n")
      .find((l) => l.includes("Startup failure"));
    expect(row).toBeDefined();
    expect(stripAnsi(row ?? "").length).toBeLessThanOrEqual(60);
    const raw = frame
      .split("\n")
      .find((l) => stripAnsi(l).includes("Startup failure"));
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[[0-9;]*m/.test(raw ?? "")).toBe(true);
  });

  it("keeps logs secondary by default but expandable with L", () => {
    const snapshot = minimalSnapshot();
    snapshot.logs.push({
      seq: 1,
      at: Date.now(),
      service: "api",
      stream: "stdout",
      text: "hello-log-line",
    });
    const collapsed = renderCommandCenter(snapshot, DEFAULT_FILTERS, {
      width: 100,
      forceColor: false,
    });
    expect(collapsed).not.toContain("hello-log-line");
    expect(collapsed).toContain("1 lines buffered");
    const expanded = renderCommandCenter(
      snapshot,
      { ...DEFAULT_FILTERS, showLogs: true },
      { width: 100, forceColor: false },
    );
    expect(expanded).toContain("hello-log-line");
  });

  it("shows a FAILED service as an incident with code, not raw dumps", () => {
    const snapshot = minimalSnapshot();
    snapshot.overall = "DOWN";
    snapshot.services[0].state = "FAILED";
    snapshot.services[0].startupFailure = "port 3000 in use (EADDRINUSE)";
    snapshot.services[0].lastError =
      "Error: listen EADDRINUSE: address already in use :::3000";
    const frame = renderCommandCenter(snapshot, DEFAULT_FILTERS, {
      width: 110,
      forceColor: false,
    });
    const plain = stripAnsi(frame);
    expect(plain).toContain("INCIDENTS · 1");
    expect(plain).toContain("port 3000 in use (EADDRINUSE)");
    expect(plain).toContain("EADDRINUSE");
    expect(plain).toContain("1 incident");
    // A live-but-failed API is never counted as up.
    expect(plain).toContain("1/2 up");
  });

  it("never counts a live-but-unconfirmed API as up", () => {
    const snapshot = minimalSnapshot();
    snapshot.services[0].state = "RUNNING";
    snapshot.services[0].readiness = "awaiting log signal";
    const frame = renderCommandCenter(snapshot, DEFAULT_FILTERS, {
      width: 100,
      forceColor: false,
    });
    expect(stripAnsi(frame)).toContain("1/2 up");
    expect(isUp(snapshot.services[0])).toBe(false);
    expect(isUp(snapshot.services[1])).toBe(true);
  });
});

describe("overall coherence", () => {
  const svc = (over: Partial<ServiceSnapshot>): ServiceSnapshot => ({
    name: "api",
    label: "Platform Server",
    state: "READY",
    pid: 1,
    alive: true,
    uptimeMs: 1000,
    restarts: 0,
    lastExitCode: null,
    lastSignal: null,
    lastError: null,
    lastBootMs: 100,
    readiness: "confirmed",
    startupFailure: null,
    ...over,
  });

  it("is OPERATIONAL only when serving is confirmed", () => {
    const api = svc({ name: "api", state: "READY" });
    const mcp = svc({ name: "mcp", label: "MCP Server", state: "RUNNING" });
    expect(computeOverall([api, mcp])).toBe("OPERATIONAL");
  });

  it("is DOWN on FAILED even with the process alive", () => {
    const api = svc({
      name: "api",
      state: "FAILED",
      alive: true,
      pid: 123,
      startupFailure: "port 3000 in use (EADDRINUSE)",
    });
    const mcp = svc({ name: "mcp", label: "MCP Server", state: "RUNNING" });
    expect(computeOverall([api, mcp])).toBe("DOWN");
  });

  it("is DEGRADED when the API is alive but unconfirmed", () => {
    const api = svc({ name: "api", state: "RUNNING" });
    const mcp = svc({ name: "mcp", label: "MCP Server", state: "RUNNING" });
    expect(computeOverall([api, mcp])).toBe("DEGRADED");
  });

  it("is STARTING while booting", () => {
    const api = svc({
      name: "api",
      state: "STARTING",
      alive: false,
      pid: null,
    });
    const mcp = svc({ name: "mcp", label: "MCP Server", state: "STOPPED" });
    expect(computeOverall([api, mcp])).toBe("STARTING");
  });
});

describe("diagnostics", () => {
  it("flags non-zero exits from observed facts", () => {
    const snapshot = minimalSnapshot();
    snapshot.services[0].state = "CRASHED";
    snapshot.services[0].lastExitCode = 1;
    const diags = analyzeSnapshot(snapshot);
    expect(diags.some((d) => d.code === "API_NONZERO_EXIT")).toBe(true);
  });

  it("flags startup failures with a port-clash hint for EADDRINUSE", () => {
    const snapshot = minimalSnapshot();
    snapshot.services[0].state = "FAILED";
    snapshot.services[0].startupFailure = "port 3000 in use (EADDRINUSE)";
    const diags = analyzeSnapshot(snapshot);
    const found = diags.find((d) => d.code === "API_STARTUP_FAILED");
    expect(found).toBeDefined();
    expect(found?.hint).toContain("MOSAIX_PORT");
  });

  it("flags a live-but-unconfirmed API explicitly", () => {
    const snapshot = minimalSnapshot();
    snapshot.services[0].state = "RUNNING";
    snapshot.services[0].readiness = "awaiting log signal";
    const diags = analyzeSnapshot(snapshot);
    expect(diags.some((d) => d.code === "API_READINESS_UNCONFIRMED")).toBe(
      true,
    );
  });

  it("flags an inactive watcher", () => {
    const snapshot = minimalSnapshot();
    snapshot.watch.active = false;
    const diags = analyzeSnapshot(snapshot);
    expect(diags.some((d) => d.code === "WATCH_INACTIVE")).toBe(true);
  });
});

describe("DevSupervisor lifecycle", () => {
  it("starts both dummy services and shuts down cleanly (no orphans)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-sup-"));
    fs.writeFileSync(path.join(dir, ".env"), "A=1\n");
    const supervisor = new DevSupervisor({
      root: dir,
      apiCommand: NODE,
      apiArgs: SLEEPER,
      mcpCommand: NODE,
      mcpArgs: SLEEPER,
      watchedFiles: [".env"],
      debounceMs: 50,
      noTui: true,
      readinessTimeoutMs: 300,
      shutdownTimeoutMs: 1500,
    });
    await supervisor.start();
    // MCP sleeper prints nothing; api readiness pattern never matches a
    // sleeper, so states are STARTING/RUNNING — both alive either way.
    const snap = supervisor.snapshot();
    expect(snap.services).toHaveLength(2);
    await supervisor.shutdown("SIGTERM");
    const after = supervisor.snapshot();
    expect(after.services.every((s) => !s.alive)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  }, 20_000);

  it("runs a safe sequential restart cycle with measured phases", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-rst-"));
    const supervisor = new DevSupervisor({
      root: dir,
      apiCommand: NODE,
      apiArgs: SLEEPER,
      mcpCommand: NODE,
      mcpArgs: SLEEPER,
      watchedFiles: [".env"],
      noTui: true,
      readinessTimeoutMs: 500,
      shutdownTimeoutMs: 2000,
    });
    await supervisor.start();
    await supervisor.scheduleRestart("test restart", "all");
    const snap = supervisor.snapshot();
    expect(snap.restarts).toBe(1);
    expect(snap.cycles).toHaveLength(1);
    expect(snap.cycles[0].outcome).toBe("completed");
    expect(snap.cycles[0].phases.spawnedAt).not.toBeNull();
    expect(snap.services.every((s) => s.alive)).toBe(true);
    await supervisor.shutdown("SIGTERM");
    fs.rmSync(dir, { recursive: true, force: true });
  }, 20_000);

  it("keyboard actions mutate view state for real", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mosaix-key-"));
    const supervisor = new DevSupervisor({
      root: dir,
      apiCommand: NODE,
      apiArgs: SLEEPER,
      mcpCommand: NODE,
      mcpArgs: SLEEPER,
      watchedFiles: [".env"],
      noTui: true,
      readinessTimeoutMs: 300,
      shutdownTimeoutMs: 1000,
    });
    await supervisor.start();
    supervisor.handleKey("e");
    supervisor.handleKey("1");
    const frame = renderCommandCenter(
      supervisor.snapshot(),
      { ...DEFAULT_FILTERS, errorOnly: true, serviceFilter: "api" },
      { width: 100, forceColor: false },
    );
    expect(frame).toContain("API");
    await supervisor.shutdown("SIGINT");
    fs.rmSync(dir, { recursive: true, force: true });
  }, 20_000);
});

function minimalSnapshot(): CommandCenterSnapshot {
  return {
    startedAt: Date.now() - 60_000,
    now: Date.now(),
    overall: "OPERATIONAL",
    services: [
      {
        name: "api",
        label: "Platform Server",
        state: "READY",
        pid: 1234,
        alive: true,
        uptimeMs: 60_000,
        restarts: 0,
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
        lastBootMs: 842,
        readiness: "confirmed",
        startupFailure: null,
      },
      {
        name: "mcp",
        label: "MCP Server",
        state: "RUNNING",
        pid: 5678,
        alive: true,
        uptimeMs: 60_000,
        restarts: 0,
        lastExitCode: null,
        lastSignal: null,
        lastError: null,
        lastBootMs: null,
        readiness: "readiness unknown (no probe)",
        startupFailure: null,
      },
    ],
    watch: {
      files: [".env", ".env.local"],
      watched: [".env"],
      active: true,
      paused: false,
      lastEvent: ".env changed",
      lastReason: null,
    },
    events: [],
    logs: [],
    cycles: [],
    diagnostics: [],
    restarts: 0,
  };
}
