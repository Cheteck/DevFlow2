import type { DatabasePort } from "@mosaix/ports-database";
import type { Coupon } from "../domain/subscription-billing-engine.js";

/**
 * Writer/reader minimal pour la table BAC `coupons`.
 * Volontairement restreint à INSERT + SELECT par code : pas de repo
 * complet (backlog si le besoin s'étend aux invoices/metering).
 */
export class CouponRepository {
  constructor(private readonly db: DatabasePort) {}

  private formatQuery(sql: string): string {
    if (this.db.capabilities.dialect === "postgres") {
      let idx = 1;
      return sql.replace(/\?/g, () => `$${idx++}`);
    }
    return sql;
  }

  async insert(coupon: Coupon): Promise<void> {
    const query = this.formatQuery(
      `INSERT INTO coupons (id, code, discountPercent, discountAmountInCents, maxRedemptions, redemptionsCount, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    await this.db.execute(query, [
      coupon.id,
      coupon.code,
      coupon.discountPercent ?? null,
      coupon.discountAmountInCents ?? null,
      coupon.maxRedemptions ?? 100,
      coupon.redemptionsCount,
      coupon.expiresAt ?? null,
      coupon.createdAt,
    ]);
  }

  async findByCode(code: string): Promise<Coupon | null> {
    const query = this.formatQuery(`SELECT * FROM coupons WHERE code = ? LIMIT 1`);
    const rows = await this.db.query<Record<string, unknown>>(query, [code]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row["id"]),
      code: String(row["code"] ?? ""),
      discountPercent:
        row["discountPercent"] === null || row["discountPercent"] === undefined
          ? null
          : Number(row["discountPercent"]),
      discountAmountInCents:
        row["discountAmountInCents"] === null || row["discountAmountInCents"] === undefined
          ? null
          : Number(row["discountAmountInCents"]),
      maxRedemptions:
        row["maxRedemptions"] === null || row["maxRedemptions"] === undefined
          ? undefined
          : Number(row["maxRedemptions"]),
      redemptionsCount: Number(row["redemptionsCount"] ?? 0),
      expiresAt:
        row["expiresAt"] === null || row["expiresAt"] === undefined
          ? null
          : String(row["expiresAt"]),
      createdAt: String(row["createdAt"] ?? ""),
    };
  }
}
