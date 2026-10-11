import type { Container, ServiceProvider, Router } from "@mosaix/sdk";
import { PostgresOrderRepository } from "./postgres-order-repository.js";
import { OrderService, type OrderRepositoryPort } from "../domain/order.service.js";
import { SatimPaymentPort } from "../domain/satim-payment-port.js";
import { CommerceController } from "./commerce-controller.js";
import type { DatabasePort } from "@mosaix/ports-database";

export class CommerceAppServiceProvider implements ServiceProvider {
  constructor(
    private readonly orderRepository?: OrderRepositoryPort,
    private readonly databasePort?: DatabasePort,
  ) {}

  register(container: Container): void {
    let repository: OrderRepositoryPort;
    if (this.orderRepository) {
      repository = this.orderRepository;
    } else if (this.databasePort) {
      repository = new PostgresOrderRepository(this.databasePort);
    } else {
      // Pas de stockage en memoire hors tests : exiger un DatabasePort
      // (Postgres) ou un repository explicite (tests uniquement).
      throw new Error(
        "[CommerceAppServiceProvider] DatabasePort requis : passez databasePort (Postgres) ou orderRepository (tests uniquement).",
      );
    }
    // Production runtime: real PSP adapter (BOUND-02). Inventory reservation
    // has no persistent adapter yet — checkout fails closed loudly until
    // one is wired, never a silent no-op.
    const orderService = new OrderService(repository, new SatimPaymentPort());
    const controller = new CommerceController(orderService);

    container.instance("orderRepository", repository);
    container.instance(OrderService, orderService);
    container.instance(CommerceController, controller);
  }

  boot(container: Container, router?: Router): void {
    if (!router) return;
    const controller = container.resolve(CommerceController);

    router.post("/orders", (req) => controller.createOrder(req));
    router.get("/orders", (req) => controller.listOrders(req));
    router.get("/orders/:id", (req) => controller.getOrder(req));
    router.post("/commerce/checkout/webhook", (req) => controller.handleWebhook(req));
  }
}
