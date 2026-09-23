/**
 * @mosaix/adapter-identity-store-postgres – PostgreSQL adapter for IdentityStore port.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type {
  Identity,
  ExternalIdentity,
  LinkExternalIdentityInput,
  IdentityStore,
} from "@mosaix/ports-identity-store";

function parseJsonAttributes(attributes: unknown): Record<string, unknown> {
  if (!attributes) return {};
  if (typeof attributes === "object") return attributes as Record<string, unknown>;
  if (typeof attributes === "string") {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export class PostgresIdentityStoreAdapter implements IdentityStore {
  private readonly db: DatabasePort;

  constructor(db: DatabasePort) {
    this.db = db;
  }

  async findById(id: string): Promise<Identity | null> {
    const rows = await this.db.query<
      Identity & { attributes: unknown } & {
        externalId: string | null;
        provider: string | null;
        linkedAt: string | null;
        externalAttributes: unknown;
      }
    >(
      `SELECT 
        i.id, 
        i.tenant_id AS "tenantId", 
        i.email, 
        i.display_name AS "displayName", 
        i.status, 
        i.created_at AS "createdAt", 
        i.updated_at AS "updatedAt", 
        i.attributes,
        e.provider,
        e.external_id AS "externalId",
        e.linked_at AS "linkedAt",
        e.attributes AS "externalAttributes"
      FROM identities i
      LEFT JOIN external_identities e ON i.id = e.identity_id
      WHERE i.id = $1`,
      [id]
    );

    if (rows.length === 0) return null;
    const first = rows[0]!;

    const identityMap = new Map<string, Identity & { externalIdentities: ExternalIdentity[] }>();

    for (const row of rows) {
      if (!identityMap.has(row.id)) {
        identityMap.set(row.id, {
          id: row.id,
          tenantId: row.tenantId,
          ...(row.email !== undefined ? { email: row.email } : {}),
          ...(row.displayName !== undefined ? { displayName: row.displayName } : {}),
          status: row.status as "active" | "disabled" | "pending",
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          externalIdentities: [],
          attributes: parseJsonAttributes(row.attributes),
        });
      }

      if (row.provider && row.externalId && row.linkedAt) {
        const identity = identityMap.get(row.id)!;
        identity.externalIdentities.push({
          provider: row.provider,
          externalId: row.externalId,
          linkedAt: row.linkedAt,
          attributes: parseJsonAttributes(row.externalAttributes),
        });
      }
    }

    const identity = identityMap.get(first.id);
    if (!identity) return null;

    identity.externalIdentities = [
      ...new Map(
        identity.externalIdentities.map((ei) => [ei.provider + ":" + ei.externalId, ei])
      ).values(),
    ];

    return identity;
  }

  async findByExternalIdentity(
    provider: string,
    externalId: string,
  ): Promise<Identity | null> {
    const rows = await this.db.query<
      & Identity
      & { attributes: unknown; externalId: string; provider: string; linkedAt: string; externalAttributes: unknown }
    >(
      `SELECT 
        i.id, 
        i.tenant_id AS "tenantId", 
        i.email, 
        i.display_name AS "displayName", 
        i.status, 
        i.created_at AS "createdAt", 
        i.updated_at AS "updatedAt", 
        i.attributes,
        e.provider,
        e.external_id AS "externalId",
        e.linked_at AS "linkedAt",
        e.attributes AS "externalAttributes"
      FROM identities i
      JOIN external_identities e ON i.id = e.identity_id
      WHERE e.provider = $1 AND e.external_id = $2`,
      [provider, externalId]
    );

    if (rows.length === 0) return null;

    const identityMap = new Map<string, Identity & { externalIdentities: ExternalIdentity[] }>();

    for (const row of rows) {
      if (!identityMap.has(row.id)) {
        identityMap.set(row.id, {
          id: row.id,
          tenantId: row.tenantId,
          ...(row.email !== undefined ? { email: row.email } : {}),
          ...(row.displayName !== undefined ? { displayName: row.displayName } : {}),
          status: row.status as "active" | "disabled" | "pending",
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          externalIdentities: [],
          attributes: parseJsonAttributes(row.attributes),
        });
      }

      if (row.provider && row.externalId && row.linkedAt) {
        const identity = identityMap.get(row.id)!;
        identity.externalIdentities.push({
          provider: row.provider,
          externalId: row.externalId,
          linkedAt: row.linkedAt,
          attributes: parseJsonAttributes(row.externalAttributes),
        });
      }
    }

    const firstRow = rows[0]!;
    const identity = identityMap.get(firstRow.id);
    if (!identity) return null;

    identity.externalIdentities = [
      ...new Map(
        identity.externalIdentities.map((ei) => [ei.provider + ":" + ei.externalId, ei])
      ).values(),
    ];

    return identity;
  }

  async findByEmail(email: string): Promise<Identity | null> {
    const rows = await this.db.query<
      Identity & { attributes: unknown } & {
        externalId: string | null;
        provider: string | null;
        linkedAt: string | null;
        externalAttributes: unknown;
      }
    >(
      `SELECT 
        i.id, 
        i.tenant_id AS "tenantId", 
        i.email, 
        i.display_name AS "displayName", 
        i.status, 
        i.created_at AS "createdAt", 
        i.updated_at AS "updatedAt", 
        i.attributes,
        e.provider,
        e.external_id AS "externalId",
        e.linked_at AS "linkedAt",
        e.attributes AS "externalAttributes"
      FROM identities i
      LEFT JOIN external_identities e ON i.id = e.identity_id
      WHERE i.email = $1`,
      [email]
    );

    if (rows.length === 0) return null;

    const identityMap = new Map<string, Identity & { externalIdentities: ExternalIdentity[] }>();

    for (const row of rows) {
      if (!identityMap.has(row.id)) {
        identityMap.set(row.id, {
          id: row.id,
          tenantId: row.tenantId,
          ...(row.email !== undefined ? { email: row.email } : {}),
          ...(row.displayName !== undefined ? { displayName: row.displayName } : {}),
          status: row.status as "active" | "disabled" | "pending",
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          externalIdentities: [],
          attributes: parseJsonAttributes(row.attributes),
        });
      }

      if (row.provider && row.externalId && row.linkedAt) {
        const identity = identityMap.get(row.id)!;
        identity.externalIdentities.push({
          provider: row.provider,
          externalId: row.externalId,
          linkedAt: row.linkedAt,
          attributes: parseJsonAttributes(row.externalAttributes),
        });
      }
    }

    const firstRow = rows[0]!;
    const identity = identityMap.get(firstRow.id);
    if (!identity) return null;

    identity.externalIdentities = [
      ...new Map(
        identity.externalIdentities.map((ei) => [ei.provider + ":" + ei.externalId, ei])
      ).values(),
    ];

    return identity;
  }

  async create(identity: Identity): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO identities (id, tenant_id, email, display_name, status, created_at, updated_at, attributes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          identity.id,
          identity.tenantId,
          identity.email ?? null,
          identity.displayName ?? null,
          identity.status,
          identity.createdAt,
          identity.updatedAt,
          JSON.stringify(identity.attributes),
        ]
      );

      for (const ext of identity.externalIdentities) {
        await tx.query(
          `INSERT INTO external_identities (identity_id, provider, external_id, linked_at, attributes)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (identity_id, provider, external_id) DO NOTHING`,
          [
            identity.id,
            ext.provider,
            ext.externalId,
            ext.linkedAt,
            JSON.stringify(ext.attributes),
          ]
        );
      }
    });
  }

  async update(identity: Identity): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(
        `UPDATE identities
         SET tenant_id = $2, email = $3, display_name = $4, status = $5, updated_at = $6, attributes = $7
         WHERE id = $1`,
        [
          identity.id,
          identity.tenantId,
          identity.email ?? null,
          identity.displayName ?? null,
          identity.status,
          identity.updatedAt,
          JSON.stringify(identity.attributes),
        ]
      );

      await tx.query(
        `DELETE FROM external_identities WHERE identity_id = $1`,
        [identity.id]
      );
      for (const ext of identity.externalIdentities) {
        await tx.query(
          `INSERT INTO external_identities (identity_id, provider, external_id, linked_at, attributes)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (identity_id, provider, external_id) DO NOTHING`,
          [
            identity.id,
            ext.provider,
            ext.externalId,
            ext.linkedAt,
            JSON.stringify(ext.attributes),
          ]
        );
      }
    });
  }

  async linkExternalIdentity(
    input: LinkExternalIdentityInput,
  ): Promise<ExternalIdentity> {
    const { identityId, provider, externalId, attributes } = input;
    const linkedAt = new Date().toISOString();
    await this.db.query(
      `INSERT INTO external_identities (identity_id, provider, external_id, linked_at, attributes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (identity_id, provider, external_id) DO UPDATE SET
         linked_at = EXCLUDED.linked_at,
         attributes = EXCLUDED.attributes`,
      [
        identityId,
        provider,
        externalId,
        linkedAt,
        JSON.stringify(attributes),
      ]
    );
    return {
      provider,
      externalId,
      linkedAt,
      ...(attributes !== undefined ? { attributes } : {}),
    };
  }

  async unlinkExternalIdentity(
    identityId: string,
    provider: string,
    externalId: string,
  ): Promise<void> {
    await this.db.query(
      `DELETE FROM external_identities WHERE identity_id = $1 AND provider = $2 AND external_id = $3`,
      [identityId, provider, externalId]
    );
  }
}
