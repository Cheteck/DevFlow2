/**
 * @apps/booking — PostgreSQL repository adapter for Booking Service.
 * Implements durable persistence for slots and reservations.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { BookingSlot, Reservation } from "../domain/booking.model";

export class PostgresBookingRepository {
  constructor(private readonly db: DatabasePort) {}

  async saveSlot(slot: BookingSlot): Promise<void> {
    await this.db.query(
      `INSERT INTO booking_slots (id, "providerId", status, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         status = $3, data = $4`,
      [slot.id, slot.providerId, slot.status, JSON.stringify(slot)]
    );
  }

  async getSlot(id: string): Promise<BookingSlot | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM booking_slots WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return null;
    const data = rows[0]?.["data"];
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : (data as BookingSlot);
  }

  async listSlots(providerId?: string, status?: string): Promise<BookingSlot[]> {
    const params: unknown[] = [];
    const conditions: string[] = ["1=1"];

    if (providerId) {
      params.push(providerId);
      conditions.push(`"providerId" = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const query = `SELECT data FROM booking_slots WHERE ${conditions.join(" AND ")} ORDER BY data->>'startTime' ASC LIMIT 200`;

    const rows = await this.db.query<Record<string, unknown>>(query, params);
    return rows
      .map((r) => {
        const d = r["data"];
        if (!d) return null;
        return typeof d === "string" ? JSON.parse(d) : (d as BookingSlot);
      })
      .filter((s): s is BookingSlot => s !== null);
  }

  async saveReservation(reservation: Reservation): Promise<void> {
    await this.db.query(
      `INSERT INTO booking_reservations (id, "slotId", "customerId", status, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         status = $4, data = $5`,
      [reservation.id, reservation.slotId, reservation.customerId, reservation.status, JSON.stringify(reservation)]
    );
  }

  async getReservation(id: string): Promise<Reservation | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM booking_reservations WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return null;
    const data = rows[0]?.["data"];
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : (data as Reservation);
  }

  async listReservations(slotId?: string, customerId?: string): Promise<Reservation[]> {
    const params: unknown[] = [];
    const conditions: string[] = ["1=1"];

    if (slotId) {
      params.push(slotId);
      conditions.push(`"slotId" = $${params.length}`);
    }
    if (customerId) {
      params.push(customerId);
      conditions.push(`"customerId" = $${params.length}`);
    }

    const query = `SELECT data FROM booking_reservations WHERE ${conditions.join(" AND ")} ORDER BY data->>'createdAt' DESC LIMIT 200`;

    const rows = await this.db.query<Record<string, unknown>>(query, params);
    return rows
      .map((r) => {
        const d = r["data"];
        if (!d) return null;
        return typeof d === "string" ? JSON.parse(d) : (d as Reservation);
      })
      .filter((res): res is Reservation => res !== null);
  }
}
