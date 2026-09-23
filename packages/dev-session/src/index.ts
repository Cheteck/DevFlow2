/**
 * @mosaix/dev-session — State Machine & Session Store
 */

export type DevSessionState = "INITIALIZING" | "RUNNING" | "PAUSED" | "STOPPED" | "FAILED";

export interface DevSessionLog {
  timestamp: number;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

export interface DevSession {
  id: string;
  appId: string;
  state: DevSessionState;
  createdAt: number;
  updatedAt: number;
  lastPingAt: number;
  reloadCount: number;
  metadata?: Record<string, unknown>;
  logs: DevSessionLog[];
}

export class DevSessionStore {
  private sessions = new Map<string, DevSession>();
  private stateChangeListeners = new Set<(session: DevSession, previousState: DevSessionState) => void>();

  createSession(id: string, appId: string, metadata?: Record<string, unknown>): DevSession {
    const now = Date.now();
    const session: DevSession = {
      id,
      appId,
      state: "INITIALIZING",
      createdAt: now,
      updatedAt: now,
      lastPingAt: now,
      reloadCount: 0,
      metadata,
      logs: [{ timestamp: now, level: "info", message: `Session initialized for app ${appId}` }],
    };
    this.sessions.set(id, session);
    return session;
  }

  save(session: DevSession): void {
    session.updatedAt = Date.now();
    this.sessions.set(session.id, session);
  }

  get(id: string): DevSession | undefined {
    return this.sessions.get(id);
  }

  list(): DevSession[] {
    return Array.from(this.sessions.values());
  }

  transitionState(id: string, newState: DevSessionState, reason?: string): DevSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`DevSession [${id}] not found.`);
    }

    const previousState = session.state;
    session.state = newState;
    session.updatedAt = Date.now();
    if (reason) {
      session.logs.push({
        timestamp: Date.now(),
        level: newState === "FAILED" ? "error" : "info",
        message: `State transition: ${previousState} -> ${newState} (${reason})`,
      });
    }

    for (const listener of this.stateChangeListeners) {
      try {
        listener(session, previousState);
      } catch (err) {
        console.error("[DevSessionStore] Listener error:", err);
      }
    }

    return session;
  }

  recordReload(id: string, fileChanged: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.reloadCount++;
      session.updatedAt = Date.now();
      session.logs.push({
        timestamp: Date.now(),
        level: "info",
        message: `HMR update triggered by file change: ${fileChanged}`,
      });
    }
  }

  onStateChange(listener: (session: DevSession, previousState: DevSessionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  pruneExpired(maxAgeMs = 1000 * 60 * 60 * 24): number {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.updatedAt < cutoff) {
        this.sessions.delete(id);
        pruned++;
      }
    }
    return pruned;
  }
}
