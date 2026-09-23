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
});
