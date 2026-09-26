import * as crypto from "node:crypto";
import { OrderModel } from './order.model.js';
import { OrderValidationError, OrderNotFoundError } from './commerce.errors.js';
import { CheckoutOrderWorkflow, type PaymentPort, type InventoryPort } from '../workflows/checkout-order.workflow.js';

export interface OrderRepositoryPort {
  save(order: OrderModel): Promise<OrderModel>;
  findById(id: string): Promise<OrderModel | null>;
  findAll(): Promise<OrderModel[]>;
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
}
