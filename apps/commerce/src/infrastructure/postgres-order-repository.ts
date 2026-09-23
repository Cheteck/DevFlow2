/**
 * @apps/commerce — PostgreSQL adapter for OrderRepository.
 * Implements the OrderModel persistence with Postgres.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import { OrderModel } from "../domain/order.model.js";

export class PostgresOrderRepository {
  constructor(private readonly db: DatabasePort) {}

  async save(order: OrderModel): Promise<OrderModel> {
    order.touch();
    await this.db.query(
      `INSERT INTO commerce_orders (id, "userId", "vendableId", status, "createdAt", "updatedAt", "deletedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         "userId" = $2, "vendableId" = $3, status = $4, "updatedAt" = $6, "deletedAt" = $7`,
      [
        order.id as string,
        order.userId,
        order.vendableId,
        order.status,
        order.createdAt ?? new Date(),
        order.updatedAt ?? new Date(),
        (order as unknown as Record<string, unknown>).deletedAt ?? null,
      ],
    );
    return order;
  }

  async findById(id: string): Promise<OrderModel | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "userId", "vendableId", status, "createdAt", "updatedAt", "deletedAt"
       FROM commerce_orders WHERE id = $1 AND "deletedAt" IS NULL`,
      [id],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    if (!row) return null;
    return OrderModel.hydrate<OrderModel>(row);
  }

  async findAll(): Promise<OrderModel[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "userId", "vendableId", status, "createdAt", "updatedAt", "deletedAt"
       FROM commerce_orders WHERE "deletedAt" IS NULL`,
    );
    return rows.map((r: Record<string, unknown>) => OrderModel.hydrate<OrderModel>(r));
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
