import { describe, it, expect } from 'vitest';
import type { HttpRequest } from '@mosaix/sdk';
import { createCommerceComposition, createCommerceApp, MANIFEST } from './index.js';
import { InMemoryOrderRepository } from './infrastructure/postgres-order-repository.js';
import { OrderModel } from './domain/order.model.js';
import { RuntimeKernel } from '@mosaix/core';
import { CommerceOfferService, resolveEffectivePrice } from './domain/commerce-offer.model.js';

// Tests uniquement : repository en memoire explicite (fail-fast hors tests).
const testRepository = () => new InMemoryOrderRepository();

describe('CommerceBAC End-to-End & Unit Tests', () => {
  it('exports valid MANIFEST and creates app via factory', async () => {
    expect(MANIFEST.id).toBe('@apps/commerce');
    const kernel = new RuntimeKernel();
    const tenant = { id: 'test-tenant', organizationId: 'test-org' };

    const { container, router, app } = await createCommerceApp(kernel, tenant, { orderRepository: testRepository });
    expect(container).toBeDefined();
    expect(router).toBeDefined();
    expect(app.manifest.id).toBe('@apps/commerce');
  });

  it('maintains append-only price history and resolves effective price (PRICE-01, ADR-0021)', async () => {
    const offerService = new CommerceOfferService();
    const offer = await offerService.createOffer({
      seller: { type: "space", id: "space-jijel" },
      vendableId: "vnd-ceramics-01",
      title: "Poudre de Céramique CAJ",
      priceInCents: 5000,
      currency: "EUR",
      actorId: "usr-merchant-1",
      initialReason: "Publication initiale",
    });

    expect(offer.priceInCents).toBe(5000);
    expect(offer.priceHistory).toHaveLength(1);
    expect(offer.priceHistory?.[0].priceInCents).toBe(5000);
    expect(offer.priceHistory?.[0].reason).toBe("Publication initiale");

    // Update price and verify append-only journal
    const updated = await offerService.updatePrice(
      offer.id,
      4500,
      "usr-merchant-1",
      "Promotion d'ouverture"
    );

    expect(updated.priceInCents).toBe(4500);
    expect(updated.priceHistory).toHaveLength(2);
    expect(updated.priceHistory?.[1].priceInCents).toBe(4500);
    expect(updated.priceHistory?.[1].reason).toBe("Promotion d'ouverture");

    const effectiveMoney = resolveEffectivePrice(updated);
    expect(effectiveMoney.amountInCents).toBe(4500);
    expect(effectiveMoney.currency).toBe("EUR");
  });

  it('freezes commercial line item snapshot on created orders (PRICE-02)', async () => {
    const { OrderService } = await import('./domain/order.service.js');
    const { DemoPaymentPort, DemoInventoryPort } = await import('./workflows/checkout-order.workflow.js');
    const service = new OrderService(
      new InMemoryOrderRepository(),
      new DemoPaymentPort(),
      new DemoInventoryPort(),
    );

    const { order } = await service.createOrder({
      userId: 'usr-snap-1',
      vendableId: 'vnd-ceramics-01',
      amount: 45,
      commercialSnapshot: {
        vendableId: 'vnd-ceramics-01',
        unitPriceInCents: 5000,
        discountInCents: 500,
        currency: 'EUR',
        appliedPromotionId: 'promo_summer_500',
        appliedCouponCode: 'SUMMER5',
      },
    });

    expect(order.lineItems).toBeDefined();
    expect(order.lineItems?.length).toBe(1);
    const snap = (order.lineItems as Array<Record<string, unknown>>)[0];
    expect(snap['unitPriceInCents']).toBe(5000);
    expect(snap['discountInCents']).toBe(500);
    expect(snap['appliedCouponCode']).toBe('SUMMER5');
  });

  it('should instantiate OrderModel with default traits', () => {
    const order = new OrderModel();
    order.id = 'ord-test-1';
    order.userId = 'usr-123';
    order.vendableId = 'vend-456';
    order.status = 'Pending';
    order.touch();

    expect(order.id).toBe('ord-test-1');
    expect(order.userId).toBe('usr-123');
    expect(order.vendableId).toBe('vend-456');
    expect(order.status).toBe('Pending');
    expect(order.createdAt).toBeDefined();
    expect(order.updatedAt).toBeDefined();
  });

  it('should create an order via CommerceController and run checkout saga', async () => {
    const { controller, orderRepository } = createCommerceComposition(undefined, testRepository());

    const response = await controller.createOrder({
      body: {
        userId: 'usr-999',
        vendableId: 'vend-888',
        amount: 250
      }
    } as unknown as HttpRequest);

    expect(response.statusCode).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.userId).toBe('usr-999');
    expect(response.body.vendableId).toBe('vend-888');
    expect(response.body.status).toBe('PendingPayment');

    const saved = await orderRepository.findById(response.body.id);
    expect(saved).toBeDefined();
    expect(saved?.status).toBe('PendingPayment');
  });

  it('should return 400 Bad Request if userId is missing', async () => {
    const { controller } = createCommerceComposition(undefined, testRepository());

    const response = await controller.createOrder({
      body: {
        vendableId: 'vend-888'
      }
    } as unknown as HttpRequest);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('userId');
  });

  it('should retrieve created orders via getOrder and listOrders', async () => {
    const { controller } = createCommerceComposition(undefined, testRepository());

    const createRes = await controller.createOrder({
      body: {
        userId: 'usr-abc',
        vendableId: 'vend-xyz'
      }
    } as unknown as HttpRequest);

    const getRes = await controller.getOrder({
      params: { id: createRes.body.id }
    } as unknown as HttpRequest);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);

    const listRes = await controller.listOrders();
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should return 404 Not Found for non-existent order ID', async () => {
    const { controller } = createCommerceComposition(undefined, testRepository());

    const getRes = await controller.getOrder({
      params: { id: 'non-existent-id' }
    } as unknown as HttpRequest);

    expect(getRes.statusCode).toBe(404);
    expect(getRes.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('should process SATIM CIB/Edahabia authorization hold and void correctly', async () => {
    const { SatimPaymentPort } = await import('./domain/satim-payment-port.js');
    const port = new SatimPaymentPort();
    await expect(port.authorize('ord-1', 5000, 'idemp-1')).resolves.not.toThrow();
    await expect(port.void('ord-1', 'idemp-1')).resolves.not.toThrow();
  });

  it('should process escrow holds, releases and calculate commissions in the wallet system', async () => {
    const { WalletEscrowManager } = await import('./domain/satim-payment-port.js');
    const { Money } = await import('@mosaix/core');
    const manager = new WalletEscrowManager();

    const dzdMoney = Money.fromCents(10000, 'DZD'); // 100.00 DZD
    manager.rechargeWallet('buyer-1', 'user', dzdMoney);

    const buyerWallet = manager.getWallet('buyer-1', 'user');
    expect(buyerWallet.balanceInCents).toBe(10000);

    // Hold escrow
    manager.holdEscrow('buyer-1', 'ord-99', dzdMoney);
    expect(buyerWallet.balanceInCents).toBe(0);

    // Release escrow to space with 5% commission
    manager.releaseEscrow('space-seller-1', 'space', 'ord-99', dzdMoney, 500);
    const sellerWallet = manager.getWallet('space-seller-1', 'space');
    expect(sellerWallet.balanceInCents).toBe(9500); // 10000 - 500 (5% of 10000)

    const txs = manager.listTransactions();
    expect(txs.length).toBe(4); // recharge, escrow_hold, escrow_release, payout
  });

  it('should replay instead of duplicating on explicit idempotence key', async () => {
    const { OrderService } = await import('./domain/order.service.js');
    const { DemoPaymentPort, DemoInventoryPort } = await import('./workflows/checkout-order.workflow.js');
    const { InMemoryOrderRepository } = await import('./infrastructure/postgres-order-repository.js');
    const service = new OrderService(
      new InMemoryOrderRepository(),
      new DemoPaymentPort(),
      new DemoInventoryPort(),
    );

    const first = await service.createOrder({
      userId: 'usr-dup',
      vendableId: 'vend-dup',
      amount: 100,
      idempotenceKey: 'idem-key-1',
    });
    const second = await service.createOrder({
      userId: 'usr-dup',
      vendableId: 'vend-dup',
      amount: 100,
      idempotenceKey: 'idem-key-1',
    });

    expect(second.order.id).toBe(first.order.id);
    expect((second.sagaState as { replayed?: boolean }).replayed).toBe(true);
    expect(await service.listOrders()).toHaveLength(1);
  });

  it('should settle to PendingPayment then confirm to Paid via webhook semantics', async () => {
    const { OrderService } = await import('./domain/order.service.js');
    const { DemoPaymentPort, DemoInventoryPort } = await import('./workflows/checkout-order.workflow.js');
    const { InMemoryOrderRepository } = await import('./infrastructure/postgres-order-repository.js');
    const service = new OrderService(
      new InMemoryOrderRepository(),
      new DemoPaymentPort(),
      new DemoInventoryPort(),
    );

    const { order } = await service.createOrder({ userId: 'usr-tr', vendableId: 'vend-tr', amount: 10 });
    // Saga authorizes the hold: order waits for capture confirmation, never Paid directly.
    expect((await service.getOrderById(order.id)).status).toBe('PendingPayment');

    await expect(service.setOrderStatus(order.id, 'Delivered')).rejects.toThrow('Transition interdite');
    const paid = await service.setOrderStatus(order.id, 'Paid');
    expect(paid.status).toBe('Paid');
    const processed = await service.setOrderStatus(order.id, 'Processing');
    expect(processed.status).toBe('Processing');
    await expect(service.setOrderStatus(order.id, 'Paid')).rejects.toThrow('Transition interdite');
  });

  it('should drive the PendingPayment state machine edges (incl. legacy Pending→Paid webhook)', async () => {
    const { OrderStateMachine } = await import('./domain/order-state-machine.js');

    expect(OrderStateMachine.can('Pending', 'PAY')).toBe(true);
    expect(OrderStateMachine.transition('Pending', 'PAY')).toMatchObject({ success: true, to: 'PendingPayment' });
    expect(OrderStateMachine.can('PendingPayment', 'CONFIRM')).toBe(true);
    expect(OrderStateMachine.transition('PendingPayment', 'CONFIRM')).toMatchObject({ success: true, to: 'Paid' });
    expect(OrderStateMachine.can('PendingPayment', 'CANCEL')).toBe(true);
    expect(OrderStateMachine.can('PendingPayment', 'DELIVER')).toBe(false);
    expect(OrderStateMachine.transition('PendingPayment', 'DELIVER').success).toBe(false);
    // Legacy orders settled straight to Paid: webhook confirmation must keep working.
    expect(OrderStateMachine.allowsTransition('Pending', 'Paid')).toBe(true);
    expect(OrderStateMachine.allowsTransition('PendingPayment', 'Paid')).toBe(true);
    expect(OrderStateMachine.allowsTransition('Processing', 'Paid')).toBe(false);
  });
});
