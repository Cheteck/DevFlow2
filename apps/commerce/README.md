# MosaiX Commerce Bounded Application Context (`@apps/commerce`)

The `@apps/commerce` application handles e-commerce checkout, order processing, and payment workflows in MosaiX.

## Architecture
- **Domain:** OrderModel, OrderService, CommerceDomainError
- **Workflows:** CheckoutOrderWorkflow (Saga pattern with compensation)
- **Infrastructure:** OrderRepository (Per-app database strategy)
- **HTTP Layer:** CommerceController, Router (`POST /orders`, `GET /orders`, `GET /orders/:id`)
- **Composition Root:** `createCommerceComposition()` in `src/composition-root.ts`
