/**
 * @mosaix/dev-server — shared contracts for MOSAIX // COMMAND CENTER.
 *
 * Dev-only tooling. Never imported by production bundles.
 */

export type ServiceName = "api" | "mcp";

/**
 * Lifecycle states. RUNNING means the OS process is alive but no
 * service-specific readiness signal has confirmed it yet — it must NEVER
 * be read as "serving traffic". READY is only used when a real readiness
 * mechanism (log pattern, probe) confirms it. FAILED means the service
 * explicitly reported it cannot serve (e.g. EADDRINUSE) while its OS
 * process may still be alive (tsx --watch wrappers survive inner crashes).
 */
export type ServiceState =
  | "STOPPED"
  | "STARTING"
  | "RUNNING"
  | "READY"
  | "STOPPING"
  | "CRASHED"
  | "FAILED";

export type EventCategory =
  "SYSTEM" | "WATCH" | "API" | "MCP" | "RESTART" | "DIAG";

export type EventLevel = "info" | "warn" | "error";

export interface SupervisorEvent {
  seq: number;
  at: number;
  category: EventCategory;
  level: EventLevel;
  message: string;
}

export type LogStream = "stdout" | "stderr" | "supervisor";

export interface LogEntry {
  seq: number;
  at: number;
  service: ServiceName | "supervisor";
  stream: LogStream;
  /** Severity is only set when actually known (stderr => error-ish is NOT assumed). */
  level?: EventLevel;
  text: string;
}

export interface ServiceSnapshot {
  name: ServiceName;
  label: string;
  state: ServiceState;
  pid: number | null;
  alive: boolean;
  uptimeMs: number | null;
  restarts: number;
  lastExitCode: number | null;
  lastSignal: string | null;
  lastError: string | null;
  lastBootMs: number | null;
  readiness: string;
  /** Concise startup-failure summary (e.g. "port 3000 in use (EADDRINUSE)"). Null when none observed. */
  startupFailure: string | null;
}

export interface WatchSnapshot {
  files: string[];
  watched: string[];
  active: boolean;
  paused: boolean;
  lastEvent: string | null;
  lastReason: string | null;
}

export type RestartOutcome = "completed" | "failed" | "timeout" | "cancelled";

export interface RestartPhaseMarks {
  detectedAt: number;
  debounceDoneAt: number | null;
  stopRequestedAt: number | null;
  spawnedAt: number | null;
  readyAt: number | null;
}

export interface RestartCycle {
  id: number;
  scope: ServiceName | "all";
  reason: string;
  startedAt: number;
  endedAt: number | null;
  phases: RestartPhaseMarks;
  events: string[];
  outcome: RestartOutcome;
  exitCodes: Array<{
    service: ServiceName;
    code: number | null;
    signal: string | null;
  }>;
  errors: string[];
}

export interface Diagnostic {
  level: EventLevel;
  code: string;
  message: string;
  hint: string;
}

export interface CommandCenterSnapshot {
  startedAt: number;
  now: number;
  overall: "OPERATIONAL" | "DEGRADED" | "DOWN" | "STARTING";
  services: ServiceSnapshot[];
  watch: WatchSnapshot;
  events: SupervisorEvent[];
  logs: LogEntry[];
  cycles: RestartCycle[];
  diagnostics: Diagnostic[];
  restarts: number;
}

export interface SupervisorOptions {
  root: string;
  apiCommand: string;
  apiArgs: string[];
  mcpCommand: string;
  mcpArgs: string[];
  watchedFiles?: string[];
  debounceMs?: number;
  eventBufferSize?: number;
  logBufferSize?: number;
  cycleBufferSize?: number;
  shutdownTimeoutMs?: number;
  readinessTimeoutMs?: number;
  noTui?: boolean;
}
