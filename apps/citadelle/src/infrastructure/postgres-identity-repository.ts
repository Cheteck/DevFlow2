import type { DatabasePort } from "@mosaix/ports-database";

export interface Identity {
  id: string;
  tenant_id: string;
  email: string;
  status: string;
  display_name?: string;
  metadata?: Record<string, unknown>;
}

export class PostgresIdentityRepository {
  constructor(private readonly db: DatabasePort) {}

  async findById(id: string): Promise<Identity | null> {
    const rows = await this.db.query<Record<string, unknown>>("SELECT * FROM citadelle_identities WHERE id = $1", [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      email: String(r.email),
      status: String(r.status),
      display_name: r.display_name ? String(r.display_name) : undefined,
      metadata: typeof r.metadata === "object" && r.metadata !== null ? (r.metadata as Record<string, unknown>) : undefined,
    };
  }

  async save(identity: Identity): Promise<void> {
    await this.db.query(
      `INSERT INTO citadelle_identities (id, tenant_id, email, status, display_name, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = $3, status = $4, display_name = $5, metadata = $6, updated_at = NOW()`,
      [identity.id, identity.tenant_id, identity.email, identity.status, identity.display_name, identity.metadata ? JSON.stringify(identity.metadata) : null]
    );
  }
}
