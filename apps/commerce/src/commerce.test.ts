import { describe, it, expect } from 'vitest';
import type { HttpRequest } from '@mosaix/sdk';
import { createCommerceComposition, createCommerceApp, MANIFEST } from './index.js';
import { OrderModel } from './domain/order.model.js';
import { RuntimeKernel } from '@mosaix/core';

describe('CommerceBAC End-to-End & Unit Tests', () => {
  it('exports valid MANIFEST and creates app via factory', async () => {
    expect(MANIFEST.id).toBe('@apps/commerce');
    const kernel = new RuntimeKernel();
    const tenant = { id: 'test-tenant', organizationId: 'test-org' };

    const { container, router, app } = await createCommerceApp(kernel, tenant);
    expect(container).toBeDefined();
    expect(router).toBeDefined();
    expect(app.manifest.id).toBe('@apps/commerce');
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
    const { controller, orderRepository } = createCommerceComposition();

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
    expect(response.body.status).toBe('Paid');

    const saved = await orderRepository.findById(response.body.id);
    expect(saved).toBeDefined();
    expect(saved?.status).toBe('Paid');
  });

  it('should return 400 Bad Request if userId is missing', async () => {
    const { controller } = createCommerceComposition();

    const response = await controller.createOrder({
      body: {
        vendableId: 'vend-888'
      }
    } as unknown as HttpRequest);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('userId');
  });

  it('should retrieve created orders via getOrder and listOrders', async () => {
    const { controller } = createCommerceComposition();

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
    const { controller } = createCommerceComposition();

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
});

