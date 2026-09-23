import type { SessionStore, Session } from "@mosaix/ports-session-store";

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async get(id: string): Promise<Session | null> {
    const s = this.sessions.get(id);
    if (!s || s.revokedAt) return null;
    return s;
  }

  async revoke(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s) {
      s.revokedAt = new Date().toISOString();
    }
  }

  async revokeAllForIdentity(identityId: string): Promise<void> {
    for (const s of this.sessions.values()) {
      if (s.identityId === identityId) {
        s.revokedAt = new Date().toISOString();
      }
    }
  }

  async listActiveForIdentity(identityId: string): Promise<Session[]> {
    const list: Session[] = [];
    for (const s of this.sessions.values()) {
      if (s.identityId === identityId && !s.revokedAt) {
        list.push(s);
      }
    }
    return list;
  }
}
