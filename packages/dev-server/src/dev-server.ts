/**
 * @mosaix/dev-server — MosaiX Dev Server & Real HMR Event Broadcaster
 */

import { DevSessionStore, type DevSession } from "@mosaix/dev-session";

export interface DevSessionConfig {
  sessionId: string;
  appId: string;
  targetDir: string;
}

export interface HmrEvent {
  type: "update" | "reload" | "error";
  sessionId: string;
  fileChanged: string;
  timestamp: number;
  invalidatedModules?: string[];
}

export class DevServer {
  private sessions = new Map<string, DevSessionConfig>();
  private store = new DevSessionStore();
  private subscribers = new Map<string, Set<(event: HmrEvent) => void>>();

  getStore(): DevSessionStore {
    return this.store;
  }

  startSession(config: DevSessionConfig): DevSession {
    this.sessions.set(config.sessionId, config);
    const session = this.store.createSession(config.sessionId, config.appId, {
      targetDir: config.targetDir,
    });
    this.store.transitionState(config.sessionId, "RUNNING", "Dev server started");
    return session;
  }

  subscribe(sessionId: string, listener: (event: HmrEvent) => void): () => void {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    const set = this.subscribers.get(sessionId)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.subscribers.delete(sessionId);
      }
    };
  }

  triggerHMR(sessionId: string, fileChanged: string): HmrEvent {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`DevSession [${sessionId}] not found in DevServer.`);
    }

    this.store.recordReload(sessionId, fileChanged);

    const event: HmrEvent = {
      type: "update",
      sessionId,
      fileChanged,
      timestamp: Date.now(),
      invalidatedModules: [fileChanged],
    };

    const set = this.subscribers.get(sessionId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[DevServer] Error dispatching HMR event to subscriber for ${sessionId}:`, err);
        }
      }
    }

    return event;
  }

  stopSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.store.transitionState(sessionId, "STOPPED", "Dev server session stopped");
      this.sessions.delete(sessionId);
      this.subscribers.delete(sessionId);
    }
  }
}
