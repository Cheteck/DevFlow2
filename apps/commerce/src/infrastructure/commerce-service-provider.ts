import type { Container, ServiceProvider, Router } from "@mosaix/sdk";
import { InMemoryGuard } from "@mosaix/support";
import { OrderRepository } from "./order.repository.js";
import { PostgresOrderRepository } from "./postgres-order-repository.js";
import { OrderService, type OrderRepositoryPort } from "../domain/order.service.js";
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
      InMemoryGuard.reportFallback("InMemoryOrderRepository", "missing DatabasePort in CommerceAppServiceProvider");
      repository = new OrderRepository();
    }
    const orderService = new OrderService(repository);
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
