/**
 * @apps/commerce — PostgreSQL adapter for CommerceOffer persistence.
 * Reads `commerce.offers` (schema-qualified, camelCase, $n placeholders)
 * with portfolio titles resolved via `portfolio.translations` (fr first).
 * Ships the in-memory fallback used when no DatabasePort is available.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { InMemoryGuard } from "@mosaix/support";
import type {
  CommerceOffer,
  CommerceOfferRepositoryPort,
  SellerEntityType,
} from "../domain/commerce-offer.model.js";

export interface CommerceOfferRow {
  offer: CommerceOffer;
  title: string;
  description?: string;
}

function toOffer(row: Record<string, unknown>): CommerceOffer {
  return {
    id: String(row["id"]),
    seller: {
      type: String(row["sellerType"] ?? "user"),
      id: String(row["sellerId"] ?? ""),
    },
    vendableId: String(row["vendableId"] ?? ""),
    title: String(row["translationName"] ?? row["vendableId"] ?? ""),
    description:
      row["translationDescription"] != null
        ? String(row["translationDescription"])
        : undefined,
    priceInCents: Number(row["priceInCents"] ?? 0),
    currency: String(row["currency"] ?? "EUR"),
    status: (row["status"] as CommerceOffer["status"]) ?? "DRAFT",
    stockAllocation:
      row["stockQuantity"] != null ? Number(row["stockQuantity"]) : undefined,
    commissionRateBps: Number(row["commissionRateBps"] ?? 500),
    createdAt: String(row["createdAt"] ?? new Date().toISOString()),
    updatedAt: String(row["updatedAt"] ?? new Date().toISOString()),
  };
}

const OFFER_SELECT = [
  'o."id"',
  'o."vendableId"',
  'o."sellerId"',
  'o."sellerType"',
  'o."priceInCents"',
  'o."currency"',
  'o."commissionRateBps"',
  'o."stockQuantity"',
  'o."status"',
  'o."createdAt"',
  'o."updatedAt"',
  't."name" AS "translationName"',
  't."description" AS "translationDescription"',
].join(", ");

const OFFER_FROM = `"commerce"."offers" o
  LEFT JOIN "portfolio"."translations" t
    ON t."vendableId" = o."vendableId" AND t."lang" = $1`;

export class PostgresCommerceOfferRepository implements CommerceOfferRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async saveOffer(offer: CommerceOffer): Promise<void> {
    await this.db.query(
      `INSERT INTO "commerce"."offers" (id, "vendableId", "sellerId", "sellerType", "priceInCents", currency, "commissionRateBps", "stockQuantity", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         "vendableId" = $2, "sellerId" = $3, "sellerType" = $4, "priceInCents" = $5,
         currency = $6, "commissionRateBps" = $7, "stockQuantity" = $8, status = $9, "updatedAt" = $11`,
      [
        offer.id,
        offer.vendableId,
        offer.seller.id,
        offer.seller.type,
        offer.priceInCents,
        offer.currency,
        offer.commissionRateBps,
        offer.stockAllocation ?? 1,
        offer.status,
        offer.createdAt,
        offer.updatedAt,
      ],
    );
  }

  async getOfferById(id: string): Promise<CommerceOffer | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${OFFER_SELECT} FROM ${OFFER_FROM} WHERE o."id" = $2 LIMIT 1`,
      ["fr", id],
    );
    return rows.length > 0 ? toOffer(rows[0] as Record<string, unknown>) : null;
  }

  async listOffersBySeller(
    sellerType: SellerEntityType,
    sellerId: string,
  ): Promise<CommerceOffer[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${OFFER_SELECT} FROM ${OFFER_FROM}
       WHERE o."sellerType" = $2 AND o."sellerId" = $3
       ORDER BY o."createdAt" DESC`,
      ["fr", sellerType, sellerId],
    );
    return rows.map((r) => toOffer(r as Record<string, unknown>));
  }

  async listOffersByVendable(vendableId: string): Promise<CommerceOffer[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${OFFER_SELECT} FROM ${OFFER_FROM} WHERE o."vendableId" = $2 ORDER BY o."createdAt" DESC`,
      ["fr", vendableId],
    );
    return rows.map((r) => toOffer(r as Record<string, unknown>));
  }

  async listActiveOffers(limit = 48): Promise<CommerceOffer[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${OFFER_SELECT} FROM ${OFFER_FROM}
       WHERE o."status" = 'ACTIVE' ORDER BY o."createdAt" DESC LIMIT $2`,
      ["fr", safeLimit],
    );
    return rows.map((r) => toOffer(r as Record<string, unknown>));
  }
}

export class InMemoryCommerceOfferRepository implements CommerceOfferRepositoryPort {
  private readonly offers = new Map<string, CommerceOffer>();

  constructor() {
    InMemoryGuard.reportFallback(
      "InMemoryCommerceOfferRepository",
      "no DatabasePort — vitrine reads stay empty until Postgres is wired",
    );
  }

  async saveOffer(offer: CommerceOffer): Promise<void> {
    this.offers.set(offer.id, offer);
  }

  async getOfferById(id: string): Promise<CommerceOffer | null> {
    return this.offers.get(id) ?? null;
  }

  async listOffersBySeller(
    sellerType: SellerEntityType,
    sellerId: string,
  ): Promise<CommerceOffer[]> {
    return Array.from(this.offers.values()).filter(
      (o) => o.seller.type === sellerType && o.seller.id === sellerId,
    );
  }

  async listOffersByVendable(vendableId: string): Promise<CommerceOffer[]> {
    return Array.from(this.offers.values()).filter((o) => o.vendableId === vendableId);
  }

  async listActiveOffers(limit = 48): Promise<CommerceOffer[]> {
    return Array.from(this.offers.values())
      .filter((o) => o.status === "ACTIVE")
      .slice(0, Math.min(Math.max(limit, 1), 200));
  }
}
