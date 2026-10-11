import * as crypto from "node:crypto";
import { OrderModel, type OrderStatus } from './order.model.js';
import { OrderStateMachine } from './order-state-machine.js';
import { OrderValidationError, OrderNotFoundError } from './commerce.errors.js';
import { CheckoutOrderWorkflow, type PaymentPort, type InventoryPort } from '../workflows/checkout-order.workflow.js';

export interface OrderRepositoryPort {
  save(order: OrderModel): Promise<OrderModel>;
  findById(id: string): Promise<OrderModel | null>;
  findByIdempotencyKey(key: string): Promise<OrderModel | null>;
  findAll(): Promise<OrderModel[]>;
  /** Scoped read: only the buyer's own orders (never expose all). */
  findByUserId(userId: string): Promise<OrderModel[]>;
  delete(id: string): Promise<boolean>;
  clear?(): Promise<void>;
}

export interface CreateOrderParams {
  userId: string;
  vendableId: string;
  amount?: number | undefined;
  idempotenceKey?: string;
}

export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly paymentPort?: PaymentPort,
    private readonly inventoryPort?: InventoryPort,
  ) {}

  async createOrder(params: CreateOrderParams): Promise<{ order: OrderModel; sagaState: unknown }> {
    if (!params.userId || typeof params.userId !== 'string' || params.userId.trim() === '') {
      throw new OrderValidationError('Field "userId" is required and must be a non-empty string.');
    }
    if (!params.vendableId || typeof params.vendableId !== 'string' || params.vendableId.trim() === '') {
      throw new OrderValidationError('Field "vendableId" is required and must be a non-empty string.');
    }
    if (params.amount !== undefined && (typeof params.amount !== 'number' || params.amount <= 0 || isNaN(params.amount))) {
      throw new OrderValidationError('Field "amount", if provided, must be a positive number.');
    }

    const order = new OrderModel();
    order.id = `ord-${crypto.randomUUID()}`;
    order.userId = params.userId;
    order.vendableId = params.vendableId;
    order.status = 'Pending';

    const orderAmount = params.amount ?? 50;
    const idempotenceKey = params.idempotenceKey || `idemp-${order.id}`;
    order.totalAmount = orderAmount;

    // Double-submit protection: an explicit idempotence key replays the
    // original order instead of creating (and charging) a second one.
    // The DB partial UNIQUE on idempotencyKey is the last line of defense.
    if (params.idempotenceKey) {
      const existing = await this.orderRepository.findByIdempotencyKey(params.idempotenceKey);
      if (existing) {
        return { order: existing, sagaState: { replayed: true, orderId: existing.id } };
      }
    }
    order.idempotencyKey = idempotenceKey;

    const initialState = {
      orderId: order.id,
      amount: orderAmount,
      idempotenceKey,
    };

    const workflow = new CheckoutOrderWorkflow(this.paymentPort, this.inventoryPort);
    const sagaState = await workflow.execute(initialState);

    if (sagaState.success && sagaState.context.paymentAuthorized && sagaState.context.inventoryReserved) {
      order.status = 'Paid';
    } else {
      order.status = 'Cancelled';
    }

    await this.orderRepository.save(order);

    return { order, sagaState };
  }

  async getOrderById(id: string): Promise<OrderModel> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new OrderNotFoundError(id);
    }
    return order;
  }

  async listOrders(): Promise<OrderModel[]> {
    return this.orderRepository.findAll();
  }

  /** Buyer-scoped listing for the orders view (no cross-user leak). */
  async listOrdersByUser(userId: string): Promise<OrderModel[]> {
    return this.orderRepository.findByUserId(userId);
  }

  /** Persisted status transition (e.g. webhook payment confirmation). */
  async setOrderStatus(id: string, status: OrderStatus): Promise<OrderModel> {
    const order = await this.getOrderById(id);
    if (!OrderStateMachine.allowsTransition(order.status, status)) {
      throw new OrderValidationError(
        `Transition interdite: impossible de passer de '${order.status}' à '${status}'.`,
      );
    }
    order.status = status;
    await this.orderRepository.save(order);
    return order;
  }
}
