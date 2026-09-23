import { OrderModel } from '../domain/order.model.js';

export class OrderRepository {
  private orders = new Map<string, OrderModel>();

  async save(order: OrderModel): Promise<OrderModel> {
    order.touch();
    this.orders.set(order.id as string, order);
    return order;
  }

  async findById(id: string): Promise<OrderModel | null> {
    const order = this.orders.get(id);
    return order ? order : null;
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
