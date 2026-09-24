/**
 * @apps/booking — Canonical Application Entry Point
 * See: .project/architecture/canonical-app-schema.md
 */

import { Container, Router, createBoundedAppBootstrap, MosaixApp, RuntimeKernel, type TenantIdentity } from "@mosaix/sdk";
import type { ApplicationManifest } from "@mosaix/contracts";
import type { DatabasePort } from "@mosaix/ports-database";

import { BookingAppServiceProvider } from "./infrastructure/booking-service-provider.js";
import { BookingService, type CreateSlotInput, type CreateReservationInput } from "./domain/booking.model.js";

// =============================================================
// SECTION 1 — MANIFEST
// =============================================================
export const MANIFEST = {
  type: "application",
  id: "@apps/booking",
  name: "Booking",
  version: "0.1.0",
  domain: { name: "booking" },
  runtime: { entrypoint: "./src/index.ts", isolation: "trusted" },
  database: { strategy: "per-app" },
  requires: [
    { id: "@apps/citadelle", version: "^1.0.0" },
  ],
  capabilities: [
    { id: "booking.slot.create", version: "1.0.0" },
    { id: "booking.slot.list", version: "1.0.0" },
    { id: "booking.reservation.create", version: "1.0.0" },
  ],
  permissions: [
    "booking:slot:create:tenant",
    "booking:slot:read:tenant",
    "booking:reservation:create:tenant",
  ],
  events: {
    publishes: ["booking.slot.created", "booking.reservation.created"],
    subscribes: ["identity.user.created"],
  },
  routes: {
    prefix: "/booking",
  },
} as const;

// =============================================================
// SECTION 2 — ADAPTERS
// =============================================================
export type BookingAdapters = {
  databasePort?: DatabasePort;
};

// =============================================================
// SECTION 3 — SERVICE PROVIDER
// =============================================================
export class BookingServiceProvider {
  private innerProvider: BookingAppServiceProvider;

  constructor(_adapters: BookingAdapters = {}) {
    this.innerProvider = new BookingAppServiceProvider();
  }

  register(container: Container): void {
    this.innerProvider.register(container);
  }

  async boot(container: Container, router: Router): Promise<MosaixApp> {
    this.innerProvider.boot(container, router);

    const bookingService = container.resolve<BookingService>("bookingService");
    const kernel = container.resolve<RuntimeKernel>("kernel");
    const tenant = container.resolve<TenantIdentity>("tenant");
    const app = MosaixApp.register(
      { manifest: MANIFEST as unknown as ApplicationManifest, tenant },
      kernel
    );

    // Register Capabilities
    app.provideCapability("booking.slot.create", async (input) => {
      const inp = input as CreateSlotInput;
      return bookingService.createSlot(inp);
    });

    app.provideCapability("booking.slot.list", async (input) => {
      const filters = input as { providerId?: string; status?: string } | undefined;
      return bookingService.listSlots(filters);
    });

    app.provideCapability("booking.reservation.create", async (input) => {
      const inp = input as CreateReservationInput;
      return bookingService.createReservation(inp);
    });

    return app;
  }
}

// =============================================================
// SECTION 4 — FACTORY
// =============================================================
export async function createBookingApp(
  kernel: RuntimeKernel,
  tenant: TenantIdentity,
  adapters?: BookingAdapters
): Promise<{ container: Container; router: Router; app: MosaixApp }> {
  return createBoundedAppBootstrap({
    manifest: MANIFEST as unknown as ApplicationManifest,
    tenant,
    kernel,
    provider: new BookingServiceProvider(adapters),
  });
}

// =============================================================
// SECTION 5 — DOMAIN EXPORTS
// =============================================================
export * from "./domain/booking.model.js";
export * from "./domain/booking-calendar-sync.js";
export * from "./domain/booking-portal-resources.js";


