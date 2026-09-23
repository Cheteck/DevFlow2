/**
 * @mosaix/adapter-identity-store-sqlite — SQLite Identity Store Adapter with DatabasePort SQL queries
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

interface IdentityRow {
  id: string;
  tenantId: string;
  email: string | null;
  displayName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  attributes: string | Record<string, unknown>;
  provider: string | null;
  externalId: string | null;
  linkedAt: string | null;
  externalAttributes: string | Record<string, unknown>;
}

export class SQLiteIdentityStoreAdapter implements IdentityStore {
  private readonly db: DatabasePort;

  constructor(db: DatabasePort) {
    this.db = db;
  }

  async findById(id: string): Promise<Identity | null> {
    const rows = await this.db.query<
      IdentityRow
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
      WHERE i.id = ?`,
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
          ...(row.email !== undefined && row.email !== null ? { email: row.email } : {}),
          ...(row.displayName !== undefined && row.displayName !== null ? { displayName: row.displayName } : {}),
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
      IdentityRow
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
      WHERE e.provider = ? AND e.external_id = ?`,
      [provider, externalId]
    );

    if (rows.length === 0) return null;

    const identityMap = new Map<string, Identity & { externalIdentities: ExternalIdentity[] }>();

    for (const row of rows) {
      if (!identityMap.has(row.id)) {
        identityMap.set(row.id, {
          id: row.id,
          tenantId: row.tenantId,
          ...(row.email !== undefined && row.email !== null ? { email: row.email } : {}),
          ...(row.displayName !== undefined && row.displayName !== null ? { displayName: row.displayName } : {}),
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
      IdentityRow
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
      WHERE i.email = ?`,
      [email]
    );

    if (rows.length === 0) return null;

    const identityMap = new Map<string, Identity & { externalIdentities: ExternalIdentity[] }>();

    for (const row of rows) {
      if (!identityMap.has(row.id)) {
        identityMap.set(row.id, {
          id: row.id,
          tenantId: row.tenantId,
          ...(row.email !== undefined && row.email !== null ? { email: row.email } : {}),
          ...(row.displayName !== undefined && row.displayName !== null ? { displayName: row.displayName } : {}),
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
      await tx.execute(
        `INSERT INTO identities (id, tenant_id, email, display_name, status, created_at, updated_at, attributes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
        await tx.execute(
          `INSERT INTO external_identities (identity_id, provider, external_id, linked_at, attributes)
           VALUES (?, ?, ?, ?, ?)`,
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
      await tx.execute(
        `UPDATE identities
         SET tenant_id = ?, email = ?, display_name = ?, status = ?, updated_at = ?, attributes = ?
         WHERE id = ?`,
        [
          identity.tenantId,
          identity.email ?? null,
          identity.displayName ?? null,
          identity.status,
          identity.updatedAt,
          JSON.stringify(identity.attributes),
          identity.id,
        ]
      );

      await tx.execute(
        `DELETE FROM external_identities WHERE identity_id = ?`,
        [identity.id]
      );
      for (const ext of identity.externalIdentities) {
        await tx.execute(
          `INSERT INTO external_identities (identity_id, provider, external_id, linked_at, attributes)
           VALUES (?, ?, ?, ?, ?)`,
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
    await this.db.execute(
      `INSERT INTO external_identities (identity_id, provider, external_id, linked_at, attributes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (identity_id, provider, external_id) DO UPDATE SET
         linked_at = excluded.linked_at,
         attributes = excluded.attributes`,
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
    await this.db.execute(
      `DELETE FROM external_identities WHERE identity_id = ? AND provider = ? AND external_id = ?`,
      [identityId, provider, externalId]
    );
  }
}
