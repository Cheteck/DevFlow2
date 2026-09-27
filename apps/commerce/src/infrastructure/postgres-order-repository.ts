/**
 * @apps/commerce — PostgreSQL adapter for OrderRepository.
 * Implements the OrderModel persistence with Postgres (15 columns, camelCase,
 * $n placeholders). Also ships the in-memory fallback used when no
 * DatabasePort is available (replaces the deleted snake_case `order.repository.ts`).
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { OrderModel } from "../domain/order.model.js";
import type { OrderRepositoryPort } from "../domain/order.service.js";

const ORDER_COLUMNS = [
  "id",
  "userId",
  "vendableId",
  "customerId",
  "status",
  "currency",
  "totalAmount",
  "taxAmount",
  "discountCode",
  "shippingAddress",
  "billingAddress",
  "lineItems",
  "createdAt",
  "updatedAt",
  "deletedAt",
] as const;

const ORDER_SELECT = ORDER_COLUMNS.map((c) => `"${c}"`).join(", ");

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    if (value.length === 0) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function toJsonParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

function toModel(row: Record<string, unknown>): OrderModel {
  const model = new OrderModel();
  const now = new Date();
  Object.assign(model, {
    id: String(row["id"]),
    userId: String(row["userId"] ?? ""),
    vendableId: String(row["vendableId"] ?? ""),
    status: String(row["status"] ?? "Pending"),
    currency: String(row["currency"] ?? "EUR"),
    totalAmount: Number(row["totalAmount"] ?? 0),
    taxAmount: Number(row["taxAmount"] ?? 0),
    discountCode: (row["discountCode"] as string | null) ?? undefined,
    shippingAddress: parseJson(row["shippingAddress"], undefined),
    billingAddress: parseJson(row["billingAddress"], undefined),
    lineItems: parseJson(row["lineItems"], []),
    createdAt: toDate(row["createdAt"], now),
    updatedAt: toDate(row["updatedAt"], now),
    deletedAt: row["deletedAt"] == null ? null : toDate(row["deletedAt"], now),
  });
  // customerId has no domain pendant yet (nullable extension column):
  // re-attach it when present so round-trips don't lose data.
  if (row["customerId"] != null) {
    (model as unknown as Record<string, unknown>)["customerId"] = String(
      row["customerId"],
    );
  }
  return model;
}

export class PostgresOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async save(order: OrderModel): Promise<OrderModel> {
    order.touch();
    const extras = order as unknown as Record<string, unknown>;
    await this.db.query(
      `INSERT INTO commerce_orders (${ORDER_SELECT})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         "userId" = $2, "vendableId" = $3, "customerId" = $4, status = $5,
         currency = $6, "totalAmount" = $7, "taxAmount" = $8, "discountCode" = $9,
         "shippingAddress" = $10, "billingAddress" = $11, "lineItems" = $12,
         "updatedAt" = $14, "deletedAt" = $15`,
      [
        order.id as string,
        order.userId,
        order.vendableId,
        extras["customerId"] ?? null,
        order.status,
        order.currency ?? "EUR",
        order.totalAmount ?? 0,
        order.taxAmount ?? 0,
        order.discountCode ?? null,
        toJsonParam(order.shippingAddress),
        toJsonParam(order.billingAddress),
        toJsonParam(order.lineItems ?? []),
        order.createdAt ?? new Date(),
        order.updatedAt ?? new Date(),
        extras["deletedAt"] ?? null,
      ],
    );
    return order;
  }

  async findById(id: string): Promise<OrderModel | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${ORDER_SELECT}
       FROM commerce_orders WHERE id = $1 AND "deletedAt" IS NULL`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return toModel(row);
  }

  async findAll(): Promise<OrderModel[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${ORDER_SELECT}
       FROM commerce_orders WHERE "deletedAt" IS NULL`,
    );
    return rows.map((r: Record<string, unknown>) => toModel(r));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.execute(
      `UPDATE commerce_orders SET "deletedAt" = $1 WHERE id = $2 AND "deletedAt" IS NULL`,
      [new Date().toISOString(), id],
    );
    return result > 0;
  }

  async clear(): Promise<void> {
    await this.db.execute(`DELETE FROM commerce_orders`);
  }
}

/**
 * In-memory OrderRepositoryPort fallback (no DatabasePort).
 * Replaces the deleted `order.repository.ts` (snake_case + `?` placeholders,
 * incompatible Postgres) — same Map semantics, camelCase field mapping.
 */
export class InMemoryOrderRepository implements OrderRepositoryPort {
  private orders = new Map<string, OrderModel>();

  async save(order: OrderModel): Promise<OrderModel> {
    order.touch();
    this.orders.set(order.id as string, order);
    return order;
  }

  async findById(id: string): Promise<OrderModel | null> {
    return this.orders.get(id) ?? null;
  }

  async findAll(): Promise<OrderModel[]> {
    return Array.from(this.orders.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  async clear(): Promise<void> {
    this.orders.clear();
  }
}
