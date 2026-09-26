import type { DatabasePort } from '@mosaix/ports-database';
import { OrderModel } from '../domain/order.model.js';

export class OrderRepository {
  private orders = new Map<string, OrderModel>();

  constructor(private readonly db?: DatabasePort) {}

  async save(order: OrderModel): Promise<OrderModel> {
    order.touch();
    this.orders.set(order.id as string, order);

    if (this.db) {
      // Column list mirrors `shell.core.v1.001` (`commerce_orders`) — the
      // per-app migration owns the full schema long-term (DB-BAC-OWNERSHIP).
      await this.db.query(
        `INSERT INTO commerce_orders (id, user_id, items, total_amount, currency, status, shipping_address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           user_id = excluded.user_id,
           items = excluded.items,
           total_amount = excluded.total_amount,
           currency = excluded.currency,
           status = excluded.status,
           shipping_address = excluded.shipping_address,
           updated_at = excluded.updated_at`,
        [
          order.id,
          order.userId,
          JSON.stringify(order.lineItems ?? []),
          order.totalAmount,
          order.currency,
          order.status,
          order.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
          order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
          order.updatedAt ? new Date(order.updatedAt).toISOString() : new Date().toISOString(),
        ]
      ).catch((err) => {
        console.error('[Commerce] Failed to persist order to database:', err);
      });
    }

    return order;
  }

  private hydrate(r: Record<string, unknown>): OrderModel {
    const model = new OrderModel();
    const parseJson = <T>(value: unknown, fallback: T): T => {
      if (typeof value !== "string" || value.length === 0) return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };
    Object.assign(model, {
      id: String(r["id"]),
      userId: String(r["user_id"] || ""),
      vendableId: String(r["vendable_id"] || ""),
      status: String(r["status"] || "Pending"),
      totalAmount: Number(r["total_amount"] ?? 0),
      currency: String(r["currency"] || "EUR"),
      lineItems: parseJson(r["items"], []),
      shippingAddress: parseJson(r["shipping_address"], undefined),
      createdAt: new Date(String(r["created_at"] || Date.now())),
      updatedAt: new Date(String(r["updated_at"] || Date.now())),
    });
    return model;
  }

  async findById(id: string): Promise<OrderModel | null> {
    if (this.db) {
      let rows: Record<string, unknown>[] = [];
      try {
        rows = await this.db.query<Record<string, unknown>>(`SELECT * FROM commerce_orders WHERE id = ?`, [id]);
      } catch (err) {
        console.warn("[Commerce] Find order error:", err);
      }
      if (rows.length > 0) {
        const model = this.hydrate(rows[0] as Record<string, unknown>);
        this.orders.set(model.id as string, model);
        return model;
      }
    }
    return this.orders.get(id) ?? null;
  }

  async findAll(): Promise<OrderModel[]> {
    if (this.db) {
      let rows: Record<string, unknown>[] = [];
      try {
        rows = await this.db.query<Record<string, unknown>>(`SELECT * FROM commerce_orders`);
      } catch (err) {
        console.warn("[Commerce] Find all orders error:", err);
      }
      if (rows.length > 0) {
        const list: OrderModel[] = [];
        for (const r of rows) {
          const model = this.hydrate(r);
          this.orders.set(model.id as string, model);
          list.push(model);
        }
        return list;
      }
    }
    return Array.from(this.orders.values());
  }

  async delete(id: string): Promise<boolean> {
    this.orders.delete(id);
    if (this.db) {
      try {
        await this.db.execute(`DELETE FROM commerce_orders WHERE id = ?`, [id]);
      } catch (err) {
        console.warn("[Commerce] Delete order error:", err);
      }
    }
    return true;
  }

  async clear(): Promise<void> {
    this.orders.clear();
    if (this.db) {
      try {
        await this.db.execute(`DELETE FROM commerce_orders`);
      } catch (err) {
        console.warn("[Commerce] Clear orders error:", err);
      }
    }
  }
}
