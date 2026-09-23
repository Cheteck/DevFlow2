import { WorkflowEngine } from "@mosaix/orchestration";
import { featureAsync } from "@mosaix/sdk";

export interface CheckoutOrderState {
  orderId: string;
  amount: number;
  /** Idempotence key — repeated executions with the same key must not double-charge. */
  idempotenceKey?: string;
  paymentAuthorized?: boolean;
  inventoryReserved?: boolean;
  compensated?: boolean;
}

export interface PaymentPort {
  authorize(orderId: string, amount: number, idempotenceKey: string): Promise<void>;
  void(orderId: string, idempotenceKey: string): Promise<void>;
}

export interface InventoryPort {
  reserve(orderId: string, idempotenceKey: string): Promise<void>;
  release(orderId: string, idempotenceKey: string): Promise<void>;
}

/** Explicit demo ports — replace with real PSP/IMS adapters in production. */
class DemoPaymentPort implements PaymentPort {
  async authorize(): Promise<void> {
    // Demo only: no external call. Production must inject a real PSP adapter.
  }
  async void(): Promise<void> {
    // Demo only.
  }
}

class DemoInventoryPort implements InventoryPort {
  async reserve(): Promise<void> {
    // Demo only.
  }
  async release(): Promise<void> {
    // Demo only.
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Checkout step ${step} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export class CheckoutOrderWorkflow {
  private engine: WorkflowEngine<CheckoutOrderState>;

  constructor(
    private readonly payment: PaymentPort = new DemoPaymentPort(),
    private readonly inventory: InventoryPort = new DemoInventoryPort(),
    private readonly stepTimeoutMs = 5000,
  ) {
    this.engine = new WorkflowEngine<CheckoutOrderState>();
    this.configureSaga();
  }

  private configureSaga(): void {
    this.engine.addStep({
      name: "AuthorizePayment",
      execute: async (context) => {
        const key = context.idempotenceKey ?? context.orderId;
        await withTimeout(this.payment.authorize(context.orderId, context.amount, key), this.stepTimeoutMs, "AuthorizePayment");
        context.paymentAuthorized = true;
      },
      compensate: async (context) => {
        const compensationEnabled = await featureAsync("commerce.checkout.saga_compensation", true);
        if (compensationEnabled && context.paymentAuthorized) {
          const key = context.idempotenceKey ?? context.orderId;
          await withTimeout(this.payment.void(context.orderId, key), this.stepTimeoutMs, "VoidPayment");
          context.paymentAuthorized = false;
          context.compensated = true;
        }
      },
    });

    this.engine.addStep({
      name: "ReserveInventory",
      execute: async (context) => {
        const key = context.idempotenceKey ?? context.orderId;
        await withTimeout(this.inventory.reserve(context.orderId, key), this.stepTimeoutMs, "ReserveInventory");
        context.inventoryReserved = true;
      },
      compensate: async (context) => {
        const compensationEnabled = await featureAsync("commerce.checkout.saga_compensation", true);
        if (compensationEnabled && context.inventoryReserved) {
          const key = context.idempotenceKey ?? context.orderId;
          await withTimeout(this.inventory.release(context.orderId, key), this.stepTimeoutMs, "ReleaseInventory");
          context.inventoryReserved = false;
          context.compensated = true;
        }
      },
    });
  }

  async execute(initialState: CheckoutOrderState) {
    if (!initialState.orderId || initialState.amount <= 0) {
      throw new Error("CheckoutOrderWorkflow requires orderId and a positive amount");
    }
    return this.engine.execute({ idempotenceKey: initialState.orderId, ...initialState });
  }
}
