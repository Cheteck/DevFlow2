import type { DatabasePort } from '@mosaix/ports-database';
import { OrderModel } from '../domain/order.model.js';

export class OrderRepository {
  private orders = new Map<string, OrderModel>();

  constructor(private readonly db?: DatabasePort) {
    if (this.db) {
      void this.initDatabaseTable();
    }
  }

  private async initDatabaseTable(): Promise<void> {
    if (!this.db) return;
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS commerce_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        vendable_id TEXT,
        status TEXT,
        amount INTEGER,
        currency TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `).catch((err) => { console.warn("[Commerce] Table init warning:", err); });
  }

  async save(order: OrderModel): Promise<OrderModel> {
    order.touch();
    this.orders.set(order.id as string, order);

    if (this.db) {
      await this.initDatabaseTable();
      await this.db.query(
        `INSERT INTO commerce_orders (id, user_id, vendable_id, status, amount, currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           user_id = excluded.user_id,
           vendable_id = excluded.vendable_id,
           status = excluded.status,
           amount = excluded.amount,
           currency = excluded.currency,
           updated_at = excluded.updated_at`,
        [
          order.id,
          order.userId,
          order.vendableId,
          order.status,
          order.amount,
          order.currency,
          order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
          order.updatedAt ? new Date(order.updatedAt).toISOString() : new Date().toISOString(),
        ]
      ).catch((err) => {
        console.error('[Commerce] Failed to persist order to database:', err);
      });
    }

    return order;
  }

  async findById(id: string): Promise<OrderModel | null> {
    if (this.db) {
      let rows: Record<string, unknown>[] = []; try { rows = await this.db.query<Record<string, unknown>>(`SELECT * FROM commerce_orders WHERE id = ?`, [id]); } catch (err) { console.warn("[Commerce] Find order error:", err); }
      if (rows.length > 0) {
        const r = rows[0];
        const model = new OrderModel({
          id: String(r["id"]),
          userId: String(r["user_id"] || ""),
          vendableId: String(r["vendable_id"] || ""),
          status: (String(r["status"] || "Pending") as OrderModel["status"]),
          amount: Number(r["amount"] || 0),
          currency: String(r["currency"] || "EUR"),
          createdAt: new Date(String(r["created_at"] || Date.now())),
          updatedAt: new Date(String(r["updated_at"] || Date.now())),
        });
        this.orders.set(model.id as string, model);
        return model;
      }
    }
    return this.orders.get(id) ?? null;
  }

  async findAll(): Promise<OrderModel[]> {
    if (this.db) {
      let rows: Record<string, unknown>[] = []; try { rows = await this.db.query<Record<string, unknown>>(`SELECT * FROM commerce_orders`); } catch (err) { console.warn("[Commerce] Find all orders error:", err); }
      if (rows.length > 0) {
        const list: OrderModel[] = [];
        for (const r of rows) {
          const model = new OrderModel({
            id: String(r["id"]),
            userId: String(r["user_id"] || ""),
            vendableId: String(r["vendable_id"] || ""),
            status: (String(r["status"] || "Pending") as OrderModel["status"]),
            amount: Number(r["amount"] || 0),
            currency: String(r["currency"] || "EUR"),
            createdAt: new Date(String(r["created_at"] || Date.now())),
            updatedAt: new Date(String(r["updated_at"] || Date.now())),
          });
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
      try { await this.db.execute(`DELETE FROM commerce_orders WHERE id = ?`, [id]); } catch (err) { console.warn("[Commerce] Delete order error:", err); }
    }
    return true;
  }

  async clear(): Promise<void> {
    this.orders.clear();
    if (this.db) {
      try { await this.db.execute(`DELETE FROM commerce_orders`); } catch (err) { console.warn("[Commerce] Clear orders error:", err); }
    }
  }
}
