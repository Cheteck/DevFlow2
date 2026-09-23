import type { DatabasePort } from "@mosaix/ports-database";

export interface Session {
  id: string;
  identity_id: string;
  expires_at: Date;
  data?: Record<string, unknown>;
}

export class PostgresSessionStore {
  constructor(private readonly db: DatabasePort) {}

  async getSession(id: string): Promise<Session | null> {
    const rows = await this.db.query<Record<string, unknown>>("SELECT * FROM citadelle_sessions WHERE id = $1", [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      identity_id: String(r.identity_id),
      expires_at: new Date(String(r.expires_at)),
      data: typeof r.data === "object" && r.data !== null ? (r.data as Record<string, unknown>) : undefined,
    };
  }

  async saveSession(session: Session): Promise<void> {
    await this.db.query(
      `INSERT INTO citadelle_sessions (id, identity_id, expires_at, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         expires_at = $3, data = $4`,
      [session.id, session.identity_id, session.expires_at, session.data ? JSON.stringify(session.data) : null]
    );
  }
}
