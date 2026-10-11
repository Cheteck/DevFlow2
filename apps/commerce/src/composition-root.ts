/**
 * @apps/commerce — Composition Root (descriptor wiring).
 *
 * Public composition contract for the Commerce BAC: the ONLY module outside
 * this BAC allowed to know how its descriptor is assembled (domain services
 * + Postgres repositories + presentation). Server code (`src/server/…`)
 * must import this file — never `domain/…`, `infrastructure/…` or
 * `presentation/…` directly.
 *
 * Two factories:
 * - `createCommerceWiredDescriptor(db)` — production path (Postgres-backed).
 * - `createCommerceFallbackDescriptor()` — honest empty states (in-memory),
 *   used when the database wiring is unavailable. Never blocks boot.
 */

import type { BacDescriptor } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";
import { CommerceOfferService } from "./domain/commerce-offer.model.js";
import { OrderService } from "./domain/order.service.js";
import { SatimPaymentPort } from "./domain/satim-payment-port.js";
import { PostgresCommerceOfferRepository } from "./infrastructure/postgres-offer-repository.js";
import { PostgresOrderRepository } from "./infrastructure/postgres-order-repository.js";
import { createCommerceDescriptor } from "./presentation/commerce-view.js";

export function createCommerceWiredDescriptor(db: DatabasePort): BacDescriptor {
  const offerService = new CommerceOfferService(new PostgresCommerceOfferRepository(db));
  // Production path: real PSP adapter. No inventory adapter exists yet —
  // checkout fails closed with a clear error until BOUND-02 lands one
  // (never a silent no-op reservation).
  const orderService = new OrderService(new PostgresOrderRepository(db), new SatimPaymentPort());
  return createCommerceDescriptor({ offerService, orderService });
}

export function createCommerceFallbackDescriptor(): BacDescriptor {
  return createCommerceDescriptor();
}
