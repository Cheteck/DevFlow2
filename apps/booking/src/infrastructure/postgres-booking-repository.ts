/**
 * @apps/booking — PostgreSQL repository adapter for Booking Service.
 * Implements durable persistence for slots and reservations.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { BookingSlot, Reservation } from "../domain/booking.model";
import type { WaitlistEntry } from "../domain/booking-calendar-sync";
import type { BookingReminder } from "../domain/booking-portal-resources";

/**
 * Input de persistance d'un reminder.
 *
 * MAPPING explicite domaine → table (tâche BAC booking #2) :
 * - `BookingReminder.slotId` (rappel programmé au niveau du créneau, avant
 *   toute réservation) → colonne `"reservationId"` ; si `reservationId` est
 *   fourni explicitement (rappel rattaché à une réservation existante), il
 *   prime sur `slotId` ;
 * - `BookingReminder.userId` → colonne `"customerId"` ;
 * - `BookingReminder.triggerTime` (Date) → colonne `"sendAt"` (ISO) ;
 * - statut fixe `"Scheduled"` par défaut → colonne `status` ;
 * - `BookingReminder.type` (T_MINUS_24H | T_MINUS_1H) + payload complet →
 *   colonne `data` (JSONB, nullable).
 */
export interface PersistReminderInput {
  id: string;
  slotId: string;
  userId: string;
  triggerTime: Date | string;
  type?: BookingReminder["type"];
  reservationId?: string;
  status?: string;
}

export interface PersistedReminder {
  id: string;
  slotId: string;
  userId: string;
  triggerTime: string;
  type?: BookingReminder["type"];
  reservationId: string;
  status: string;
}

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
      `INSERT INTO booking_reservations (id, "slotId", "customerId", status, "idempotencyKey", data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         status = $4, "idempotencyKey" = $5, data = $6`,
      [
        reservation.id,
        reservation.slotId,
        reservation.customerId,
        reservation.status,
        reservation.idempotencyKey ?? null,
        JSON.stringify(reservation),
      ]
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

  /**
   * Lookup d'idempotence AVANT create (tâche BAC booking #8) : une clé déjà
   * persistée rejoue la réservation existante au lieu d'en créer une double.
   * La colonne est NULLABLE + UNIQUE : les réservations sans clé coexistent
   * (NULL multiples), les doublons de clé sont rejetés par Postgres.
   */
  async getReservationByIdempotencyKey(key: string): Promise<Reservation | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM booking_reservations WHERE "idempotencyKey" = $1 LIMIT 1`,
      [key]
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

  /**
   * Waitlist — save minimal (tâche BAC booking #2). `position` = rang FIFO
   * (COUNT existant + 1) sauf valeur explicite ; `createdAt` renseigné côté
   * applicatif (colonne NULLABLE, pas de DEFAULT now() — voir migrations).
   */
  async saveWaitlistEntry(entry: WaitlistEntry, position?: number): Promise<void> {
    const rank =
      position ??
      (await this.countWaitlistBySlot(entry.slotId)) + 1;
    const createdAt = new Date().toISOString();
    await this.db.query(
      `INSERT INTO booking_waitlists (id, "slotId", "customerId", "customerEmail", position, status, "createdAt", data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         position = $5, status = $6, data = $8`,
      [
        entry.id,
        entry.slotId,
        entry.customerId,
        entry.customerEmail,
        rank,
        entry.status,
        createdAt,
        JSON.stringify(entry),
      ]
    );
  }

  private async countWaitlistBySlot(slotId: string): Promise<number> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT COUNT(*) AS count FROM booking_waitlists WHERE "slotId" = $1`,
      [slotId]
    );
    const raw = rows[0]?.["count"];
    return typeof raw === "number" ? raw : Number(raw ?? 0);
  }

  /** Waitlist — listBySlot minimal, ordre FIFO (position, createdAt). */
  async listWaitlistBySlot(slotId: string): Promise<WaitlistEntry[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM booking_waitlists WHERE "slotId" = $1 ORDER BY position ASC, "createdAt" ASC LIMIT 200`,
      [slotId]
    );
    return rows
      .map((r) => {
        const d = r["data"];
        if (!d) return null;
        const parsed = typeof d === "string" ? JSON.parse(d) : d;
        return {
          ...parsed,
          joinedAt:
            parsed.joinedAt instanceof Date
              ? parsed.joinedAt
              : new Date(parsed.joinedAt),
        } as WaitlistEntry;
      })
      .filter((e): e is WaitlistEntry => e !== null);
  }

  /**
   * Reminders — save minimal (voir MAPPING sur `PersistReminderInput`).
   * `createdAt` renseigné côté applicatif (colonne NULLABLE).
   */
  async saveReminder(input: PersistReminderInput): Promise<void> {
    const reservationId = input.reservationId ?? input.slotId;
    const sendAt =
      input.triggerTime instanceof Date
        ? input.triggerTime.toISOString()
        : input.triggerTime;
    const status = input.status ?? "Scheduled";
    const createdAt = new Date().toISOString();
    const payload: BookingReminder & { id: string; reservationId: string } = {
      id: input.id,
      slotId: input.slotId,
      userId: input.userId,
      triggerTime: new Date(sendAt),
      type: input.type ?? "T_MINUS_24H",
      reservationId,
    };
    await this.db.query(
      `INSERT INTO booking_reminders (id, "reservationId", "customerId", "sendAt", status, "createdAt", data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         "sendAt" = $4, status = $5, data = $7`,
      [
        input.id,
        reservationId,
        input.userId,
        sendAt,
        status,
        createdAt,
        JSON.stringify(payload),
      ]
    );
  }

  /** Reminders — listPending minimal : Scheduled dus (sendAt <= now). */
  async listPendingReminders(now: Date | string = new Date()): Promise<PersistedReminder[]> {
    const cursor = now instanceof Date ? now.toISOString() : now;
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT id, "reservationId", "customerId", "sendAt", status, data FROM booking_reminders WHERE status = 'Scheduled' AND "sendAt" <= $1 ORDER BY "sendAt" ASC LIMIT 200`,
      [cursor]
    );
    return rows.map((r) => {
      const d = r["data"];
      const parsed =
        typeof d === "string" ? JSON.parse(d) : ((d ?? {}) as Record<string, unknown>);
      const sendAt = String(r["sendAt"] ?? parsed["sendAt"] ?? "");
      return {
        id: String(r["id"] ?? parsed["id"] ?? ""),
        slotId: String(parsed["slotId"] ?? r["reservationId"] ?? ""),
        userId: String(r["customerId"] ?? parsed["userId"] ?? ""),
        triggerTime: sendAt,
        type: (parsed["type"] as PersistedReminder["type"]) ?? "T_MINUS_24H",
        reservationId: String(r["reservationId"] ?? ""),
        status: String(r["status"] ?? "Scheduled"),
      };
    });
  }
}
