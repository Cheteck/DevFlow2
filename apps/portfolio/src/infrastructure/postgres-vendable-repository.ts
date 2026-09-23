/**
 * @apps/portfolio — PostgreSQL adapter for VendableRepository.
 * Implements the domain-owned VendableRepository port with Postgres persistence.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { VendableRepository } from "../domain/vendable-repository.js";
import type {
  Vendable,
  VendableCharacteristics,
  VendableClassification,
  VendableContent,
  VendableMedia,
  VendableRelations,
  VendableType,
  VendableVariants,
  WorkflowStatus,
} from "../domain/vendable";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export class PostgresVendableRepository implements VendableRepository {
  constructor(private readonly db: DatabasePort) {}

  async save(vendable: Vendable): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO portfolio_vendables (id, reference, type, status, content, characteristics, classification, media, variants, relations, quality, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           reference = $2, type = $3, status = $4, content = $5, characteristics = $6,
           classification = $7, media = $8, variants = $9, relations = $10, quality = $11,
           "updatedAt" = $13`,
        [
          vendable.identity.id,
          vendable.identity.reference,
          vendable.identity.type,
          vendable.identity.status,
          JSON.stringify(vendable.content),
          JSON.stringify(vendable.characteristics),
          JSON.stringify(vendable.classification),
          JSON.stringify(vendable.media),
          JSON.stringify(vendable.variants),
          JSON.stringify(vendable.relations),
          vendable.quality ? JSON.stringify(vendable.quality) : null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
    });
  }

  async findById(id: string): Promise<Vendable | undefined> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, reference, type, status, content, characteristics, classification, media, variants, relations, quality, "createdAt", "updatedAt"
       FROM portfolio_vendables WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return undefined;
    const row = rows[0];
    if (!row) return undefined;
    return this.hydrate(row);
  }

  async findByReference(reference: string): Promise<Vendable | undefined> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, reference, type, status, content, characteristics, classification, media, variants, relations, quality, "createdAt", "updatedAt"
       FROM portfolio_vendables WHERE reference = $1`,
      [reference],
    );
    if (rows.length === 0) return undefined;
    const row = rows[0];
    if (!row) return undefined;
    return this.hydrate(row);
  }

  async findAll(): Promise<Vendable[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, reference, type, status, content, characteristics, classification, media, variants, relations, quality, "createdAt", "updatedAt"
       FROM portfolio_vendables`,
    );
    return rows.map((r: Record<string, unknown>) => this.hydrate(r));
  }

  async delete(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM portfolio_vendables WHERE id = $1`, [id]);
  }

  private hydrate(row: Record<string, unknown>): Vendable {
    const vendable: Vendable = {
      identity: {
        id: asString(row.id),
        reference: asString(row.reference),
        type: asString(row.type) as VendableType,
        status: asString(row.status, "Draft") as WorkflowStatus,
      },
      content: asJson<VendableContent>(row.content, {}),
      characteristics: asJson<VendableCharacteristics>(row.characteristics, { attributes: {}, specifications: {} }),
      classification: asJson<VendableClassification>(row.classification, {}),
      media: asJson<VendableMedia>(row.media, []),
      variants: asJson<VendableVariants>(row.variants, []),
      relations: asJson<VendableRelations>(row.relations, []),
    };
    if (row.quality !== null && row.quality !== undefined) {
      const quality = asJson<Vendable["quality"]>(row.quality, undefined);
      if (quality !== undefined) {
        vendable.quality = quality;
      }
    }
    return vendable;
  }
}
