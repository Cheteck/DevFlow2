import { describe, it, expect } from "vitest";
import { BookingService, seedDefaultSlots } from "./domain/booking.model.js";
import { BookingServiceProvider, MANIFEST } from "./index.js";
import { RuntimeKernel, Container, Router } from "@mosaix/sdk";

describe("Booking Application Module", () => {
  it("should initialize default demo slots when explicitly seeded", async () => {
    const service = new BookingService();
    await seedDefaultSlots(service);
    const slots = await service.listSlots();
    expect(slots.length).toBeGreaterThanOrEqual(3);
  });

  it("should allow creating a new booking slot", async () => {
    const service = new BookingService();
    const slot = await service.createSlot({
      providerId: "provider-test",
      serviceName: "Séance Stratégie",
      startTime: new Date(Date.now() + 100000).toISOString(),
      endTime: new Date(Date.now() + 200000).toISOString(),
      capacity: 2,
    });

    expect(slot.id).toBeDefined();
    expect(slot.serviceName).toBe("Séance Stratégie");
    expect(slot.capacity).toBe(2);
    expect(slot.reservedCount).toBe(0);
    expect(slot.status).toBe("available");
  });

  it("should create reservations and update slot capacity", async () => {
    const service = new BookingService();
    const now = Date.now();
    const slot = await service.createSlot({
      providerId: "provider-single",
      serviceName: "Consultation Express",
      startTime: new Date(now + 100000).toISOString(),
      endTime: new Date(now + 200000).toISOString(),
      capacity: 1,
    });

    const res = await service.createReservation({
      slotId: slot.id,
      customerId: "cust-1",
      customerName: "Alice Dupont",
      customerEmail: "alice@example.com",
    });

    expect(res.id).toBeDefined();
    expect(res.status).toBe("confirmed");

    const updatedSlot = await service.getSlot(slot.id);
    expect(updatedSlot?.reservedCount).toBe(1);
    expect(updatedSlot?.status).toBe("fully_booked");

    // Overbooking should fail
    await expect(
      service.createReservation({
        slotId: slot.id,
        customerId: "cust-2",
        customerName: "Bob Martin",
        customerEmail: "bob@example.com",
      })
    ).rejects.toThrow(/complet/);
  });

  it("should allow cancelling a reservation and free up slot capacity", async () => {
    const service = new BookingService();
    const now = Date.now();
    const slot = await service.createSlot({
      providerId: "provider-cancel",
      serviceName: "Atelier",
      startTime: new Date(now + 100000).toISOString(),
      endTime: new Date(now + 200000).toISOString(),
      capacity: 1,
    });

    const res = await service.createReservation({
      slotId: slot.id,
      customerId: "cust-1",
      customerName: "Alice Dupont",
      customerEmail: "alice@example.com",
    });

    await service.cancelReservation(res.id);
    const updatedSlot = await service.getSlot(slot.id);
    expect(updatedSlot?.reservedCount).toBe(0);
    expect(updatedSlot?.status).toBe("available");
  });

  it("should register and boot with kernel and router", async () => {
    const kernel = new RuntimeKernel();
    const container = new Container();
    const router = new Router();

    container.bind("kernel", () => kernel);
    container.bind("tenant", () => ({ organizationId: "tenant-org-1" }));

    const provider = new BookingServiceProvider();
    provider.register(container);
    const app = await provider.boot(container, router);

    expect(app).toBeDefined();
    expect(app.manifest.id).toBe(MANIFEST.id);

    // Grant capability execution permission to caller app
    kernel.permissions.grant(
      "booking:slot.create:execute:tenant",
      { organizationId: "tenant-org-1" },
      "@apps/booking"
    );

    // Verify capability execution
    const now = Date.now();
    const slotResult = (await app.executeCapability("booking.slot.create", {
      providerId: "prov-kernel",
      serviceName: "Test Kernel Booking",
      startTime: new Date(now + 100000).toISOString(),
      endTime: new Date(now + 200000).toISOString(),
      capacity: 5,
    })) as { id: string; serviceName: string };

    expect(slotResult.id).toBeDefined();
    expect(slotResult.serviceName).toBe("Test Kernel Booking");
  });

  it("holds slot capacity atomically (v1.003, no overbooking)", async () => {
    const { PostgresBookingRepository } = await import("./infrastructure/postgres-booking-repository.js");
    const seen: string[] = [];
    const fakeDb = {
      capabilities: { dialect: "postgres", transactions: true, lock: {} },
      execute: async () => 1,
      query: async (sql: string) => {
        seen.push(sql);
        return sql.includes("RETURNING") ? [{ id: "slot-1" }] : [];
      },
      transaction: async (fn: (tx: never) => Promise<never>) => fn({} as never),
      acquireMigrationLock: async () => ({ release: async () => {} }),
    };
    const repo = new PostgresBookingRepository(fakeDb as never);
    expect(await repo.holdSlot("slot-1", 2)).toBe(true);
    expect(seen.some((s) => s.includes("bookedCount") && s.includes("capacity"))).toBe(true);

    const repoEmpty = new PostgresBookingRepository({
      ...fakeDb,
      query: async (sql: string) => {
        seen.push(sql);
        return [];
      },
    } as never);
    expect(await repoEmpty.holdSlot("slot-1", 99)).toBe(false);
  });

  it("claims due reminders with SKIP LOCKED (v1.003, no double-send)", async () => {
    const { PostgresBookingRepository } = await import("./infrastructure/postgres-booking-repository.js");
    const seen: string[] = [];
    const tx = {
      execute: async (sql: string) => {
        seen.push(sql);
        return 1;
      },
      query: async (sql: string) => {
        seen.push(sql);
        return sql.includes("FOR UPDATE") ? [{ id: "rem-1" }] : [];
      },
    };
    const fakeDb = {
      capabilities: { dialect: "postgres", transactions: true, lock: {} },
      execute: async () => 1,
      query: async () => [],
      transaction: async (fn: (t: never) => Promise<never>) => fn(tx as never),
      acquireMigrationLock: async () => ({ release: async () => {} }),
    };
    const repo = new PostgresBookingRepository(fakeDb as never);
    await repo.claimDueReminders(new Date(), 10);
    expect(seen.some((s) => s.includes("FOR UPDATE SKIP LOCKED"))).toBe(true);
    expect(seen.some((s) => s.includes("attempts = attempts + 1"))).toBe(true);
  });

  it("releases slot capacity floored at zero (v1.003)", async () => {
    const { PostgresBookingRepository } = await import("./infrastructure/postgres-booking-repository.js");
    const seen: string[] = [];
    const fakeDb = {
      capabilities: { dialect: "postgres", transactions: true, lock: {} },
      execute: async (sql: string) => {
        seen.push(sql);
        return 1;
      },
      query: async (sql: string) => {
        seen.push(sql);
        return [];
      },
      transaction: async (fn: (t: never) => Promise<never>) => fn({} as never),
      acquireMigrationLock: async () => ({ release: async () => {} }),
    };
    const repo = new PostgresBookingRepository(fakeDb as never);
    await repo.releaseSlot("slot-1", 3);
    expect(seen.some((s) => s.includes("GREATEST("))).toBe(true);
  });
});
