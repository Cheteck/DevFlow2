import * as crypto from "node:crypto";
export type BookingStatus = 
  | "draft"
  | "pending"
  | "held"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "rejected"
  | "no_show"
  | "expired";

export type BookingSlotStatus = "available" | "fully_booked" | "cancelled" | "held";

export type BookingDomainEventType =
  | "booking.slot.created"
  | "booking.slot.cancelled"
  | "booking.hold.acquired"
  | "booking.reservation.confirmed"
  | "booking.reservation.checked_in"
  | "booking.reservation.completed"
  | "booking.reservation.cancelled"
  | "booking.reservation.expired";

export interface BookingDomainEvent {
  id: string;
  type: BookingDomainEventType;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface BookingSlot {
  id: string;
  providerId: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  timezone: string;
  capacity: number;
  reservedCount: number;
  status: BookingSlotStatus;
  location?: string;
  price?: number;
  currency?: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  slotId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: BookingStatus;
  idempotencyKey?: string;
  holdExpiresAt?: string;
  checkedInAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlotInput {
  providerId: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  capacity?: number;
  location?: string;
  price?: number;
  currency?: string;
}

export interface CreateReservationInput {
  slotId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  requiresPayment?: boolean;
  holdDurationMinutes?: number;
  idempotencyKey?: string;
}

/**
 * Miroirs structurels (sans import runtime) de `WaitlistEntry`
 * (booking-calendar-sync.ts) et `BookingReminder` (booking-portal-resources.ts).
 * Évite un cycle runtime booking.model ↔ calendar-sync (qui importe déjà les
 * types du modèle) ; le repo mappe ces formes vers les colonnes typées.
 */
export interface WaitlistEntryLike {
  id: string;
  slotId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  joinedAt: Date | string;
  status: "waiting" | "promoted" | "expired";
}

export interface ReminderInputLike {
  id: string;
  slotId: string;
  userId: string;
  triggerTime: Date | string;
  type?: "T_MINUS_24H" | "T_MINUS_1H";
  reservationId?: string;
  status?: string;
}

export interface PersistedReminderLike {
  id: string;
  slotId: string;
  userId: string;
  triggerTime: string;
  type?: "T_MINUS_24H" | "T_MINUS_1H";
  reservationId: string;
  status: string;
}

export class BookingStateMachine {
  private static readonly VALID_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
    draft: ["pending", "held", "confirmed", "cancelled"],
    pending: ["held", "confirmed", "cancelled", "rejected", "expired"],
    held: ["confirmed", "cancelled", "expired"],
    confirmed: ["checked_in", "completed", "cancelled", "no_show"],
    checked_in: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
    rejected: [],
    no_show: [],
    expired: [],
  };

  static canTransition(from: BookingStatus, to: BookingStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  static transition(
    reservation: Reservation,
    targetStatus: BookingStatus,
    reason?: string
  ): { reservation: Reservation; event: BookingDomainEvent } {
    if (!this.canTransition(reservation.status, targetStatus)) {
      throw new Error(
        `Transition de statut invalide: impossible de passer de '${reservation.status}' à '${targetStatus}'.`
      );
    }

    const now = new Date().toISOString();
    const updated: Reservation = {
      ...reservation,
      status: targetStatus,
      updatedAt: now,
    };

    if (targetStatus === "checked_in") updated.checkedInAt = now;
    if (targetStatus === "completed") updated.completedAt = now;
    if (targetStatus === "cancelled") updated.cancelledAt = now;

    const eventTypeMap: Partial<Record<BookingStatus, BookingDomainEventType>> = {
      held: "booking.hold.acquired",
      confirmed: "booking.reservation.confirmed",
      checked_in: "booking.reservation.checked_in",
      completed: "booking.reservation.completed",
      cancelled: "booking.reservation.cancelled",
      expired: "booking.reservation.expired",
    };

    const eventType = eventTypeMap[targetStatus] || "booking.reservation.confirmed";
    const event: BookingDomainEvent = {
      id: `evt-${crypto.randomUUID()}`,
      type: eventType,
      aggregateId: reservation.id,
      payload: {
        reservationId: reservation.id,
        slotId: reservation.slotId,
        fromStatus: reservation.status,
        toStatus: targetStatus,
        reason,
      },
      occurredAt: now,
    };

    return { reservation: updated, event };
  }
}

export class BookingService {
  private slotLocks = new Map<string, Promise<void>>();
  private slots = new Map<string, BookingSlot>();
  private reservations = new Map<string, Reservation>();
  private idempotencyStore = new Map<string, string>();
  private domainEvents: BookingDomainEvent[] = [];
  private waitlistFallback = new Map<string, WaitlistEntryLike[]>();
  private reminderFallback = new Map<string, ReminderInputLike & { createdAt: string }>();

  private postgresRepo?: {
    saveSlot(slot: BookingSlot): Promise<void>;
    getSlot(id: string): Promise<BookingSlot | null>;
    listSlots(providerId?: string, status?: string): Promise<BookingSlot[]>;
    saveReservation(res: Reservation): Promise<void>;
    getReservation(id: string): Promise<Reservation | null>;
    listReservations(slotId?: string, customerId?: string): Promise<Reservation[]>;
    getReservationByIdempotencyKey?(key: string): Promise<Reservation | null>;
    saveWaitlistEntry?(entry: WaitlistEntryLike, position?: number): Promise<void>;
    listWaitlistBySlot?(slotId: string): Promise<WaitlistEntryLike[]>;
    saveReminder?(input: ReminderInputLike): Promise<void>;
    listPendingReminders?(now?: Date | string): Promise<PersistedReminderLike[]>;
  };

  constructor(postgresRepo?: NonNullable<BookingService["postgresRepo"]>) {
    this.postgresRepo = postgresRepo;
  }

  getRecordedEvents(): readonly BookingDomainEvent[] {
    return [...this.domainEvents];
  }

  private recordEvent(event: BookingDomainEvent): void {
    this.domainEvents.push(event);
  }

  async createSlot(input: CreateSlotInput): Promise<BookingSlot> {
    // Validation domaine startTime < endTime (tâche BAC booking #7).
    // Volontairement applicative : la grammaire ne compile pas les CHECK
    // natifs (PostgresGrammar n'émet des CHECK que pour les ENUM).
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error(
        "Créneau invalide : startTime et endTime doivent être des dates ISO valides."
      );
    }
    if (start.getTime() >= end.getTime()) {
      throw new Error(
        "Créneau invalide : startTime doit être strictement antérieur à endTime."
      );
    }
    const capacity = input.capacity && input.capacity > 0 ? input.capacity : 1;
    const now = new Date().toISOString();
    const slot: BookingSlot = {
      id: `slot-${crypto.randomUUID()}`,
      providerId: input.providerId,
      serviceName: input.serviceName,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone || "UTC",
      capacity,
      reservedCount: 0,
      status: "available",
      location: input.location || "En ligne / Standard",
      price: input.price ?? 0,
      currency: input.currency || "EUR",
      createdAt: now,
    };

    this.slots.set(slot.id, slot);
    if (this.postgresRepo) {
      await this.postgresRepo.saveSlot(slot);
    }

    this.recordEvent({
      id: `evt-${crypto.randomUUID()}`,
      type: "booking.slot.created",
      aggregateId: slot.id,
      payload: { slotId: slot.id, providerId: slot.providerId, capacity },
      occurredAt: now,
    });

    return slot;
  }

  async listSlots(filters?: { providerId?: string; status?: string }): Promise<BookingSlot[]> {
    if (this.postgresRepo) {
      const slots = await this.postgresRepo.listSlots(filters?.providerId, filters?.status);
      if (slots.length > 0) return slots;
    }
    let list = Array.from(this.slots.values());
    if (filters?.providerId) {
      list = list.filter((s) => s.providerId === filters.providerId);
    }
    if (filters?.status) {
      list = list.filter((s) => s.status === filters.status);
    }
    return list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async getSlot(slotId: string): Promise<BookingSlot | undefined> {
    if (this.postgresRepo) {
      const slot = await this.postgresRepo.getSlot(slotId);
      if (slot) return slot;
    }
    return this.slots.get(slotId);
  }

  async createReservation(input: CreateReservationInput): Promise<Reservation> {
    // Acquire slot lock to prevent race conditions & double bookings
    const currentLock = this.slotLocks.get(input.slotId) || Promise.resolve();
    let releaseLock!: () => void;
    const nextLock = new Promise<void>((resolve) => { releaseLock = resolve; });
    this.slotLocks.set(input.slotId, currentLock.then(() => nextLock));

    await currentLock;
    try {
      return await this.executeCreateReservation(input);
    } finally {
      releaseLock();
    }
  }

  private async executeCreateReservation(input: CreateReservationInput): Promise<Reservation> {
    // Idempotency check — mémoire d'abord, puis colonne persistée
    // (lookup avant create, tâche BAC booking #8 : la Map volatile ne
    // suffisait pas après redémarrage).
    if (input.idempotencyKey && this.idempotencyStore.has(input.idempotencyKey)) {
      const existingId = this.idempotencyStore.get(input.idempotencyKey)!;
      const existing = await this.getReservation(existingId);
      if (existing) return existing;
    }
    if (input.idempotencyKey && this.postgresRepo?.getReservationByIdempotencyKey) {
      const persisted = await this.postgresRepo.getReservationByIdempotencyKey(
        input.idempotencyKey
      );
      if (persisted) {
        this.idempotencyStore.set(input.idempotencyKey, persisted.id);
        return persisted;
      }
    }

    const slot = await this.getSlot(input.slotId);
    if (!slot) {
      throw new Error(`Créneau introuvable avec l'ID [${input.slotId}].`);
    }

    if (slot.status === "cancelled") {
      throw new Error(`Ce créneau [${input.slotId}] a été annulé.`);
    }

    if (slot.reservedCount >= slot.capacity) {
      slot.status = "fully_booked";
      throw new Error(`Ce créneau [${input.slotId}] est complet (capacité maximale atteinte).`);
    }

    const now = new Date();
    const initialStatus: BookingStatus = input.requiresPayment ? "held" : "confirmed";
    const holdExpiresAt = input.requiresPayment
      ? new Date(now.getTime() + (input.holdDurationMinutes || 15) * 60000).toISOString()
      : undefined;

    const reservation: Reservation = {
      id: `res-${crypto.randomUUID()}`,
      slotId: input.slotId,
      customerId: input.customerId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      status: initialStatus,
      idempotencyKey: input.idempotencyKey,
      holdExpiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (input.idempotencyKey) {
      this.idempotencyStore.set(input.idempotencyKey, reservation.id);
    }

    this.reservations.set(reservation.id, reservation);
    slot.reservedCount += 1;
    if (slot.reservedCount >= slot.capacity) {
      slot.status = "fully_booked";
    }

    this.slots.set(slot.id, slot);
    if (this.postgresRepo) {
      await this.postgresRepo.saveReservation(reservation);
      await this.postgresRepo.saveSlot(slot);
    }

    const eventType: BookingDomainEventType =
      initialStatus === "held" ? "booking.hold.acquired" : "booking.reservation.confirmed";

    this.recordEvent({
      id: `evt-${crypto.randomUUID()}`,
      type: eventType,
      aggregateId: reservation.id,
      payload: { reservationId: reservation.id, slotId: slot.id, status: initialStatus },
      occurredAt: now.toISOString(),
    });

    return reservation;
  }

  async getReservation(id: string): Promise<Reservation | undefined> {
    let res = this.reservations.get(id);
    if (!res && this.postgresRepo) {
      const found = await this.postgresRepo.getReservation(id);
      if (found) res = found;
    }
    return res;
  }

  async transitionStatus(
    reservationId: string,
    targetStatus: BookingStatus,
    reason?: string
  ): Promise<Reservation> {
    const res = await this.getReservation(reservationId);
    if (!res) {
      throw new Error(`Réservation introuvable avec l'ID [${reservationId}].`);
    }

    const { reservation: updated, event } = BookingStateMachine.transition(
      res,
      targetStatus,
      reason
    );

    this.reservations.set(updated.id, updated);

    // If cancelled or expired, free up slot capacity
    if (targetStatus === "cancelled" || targetStatus === "expired") {
      const slot = await this.getSlot(updated.slotId);
      if (slot) {
        slot.reservedCount = Math.max(0, slot.reservedCount - 1);
        if (slot.status === "fully_booked" && slot.reservedCount < slot.capacity) {
          slot.status = "available";
        }
        this.slots.set(slot.id, slot);
        if (this.postgresRepo) {
          await this.postgresRepo.saveSlot(slot);
        }
      }
    }

    if (this.postgresRepo) {
      await this.postgresRepo.saveReservation(updated);
    }

    this.recordEvent(event);
    return updated;
  }

  async cancelReservation(reservationId: string, reason?: string): Promise<Reservation> {
    return this.transitionStatus(reservationId, "cancelled", reason);
  }

  async checkInReservation(reservationId: string): Promise<Reservation> {
    return this.transitionStatus(reservationId, "checked_in");
  }

  async completeReservation(reservationId: string): Promise<Reservation> {
    return this.transitionStatus(reservationId, "completed");
  }

  async listReservations(filters?: { slotId?: string; customerId?: string }): Promise<Reservation[]> {
    if (this.postgresRepo) {
      const resList = await this.postgresRepo.listReservations(filters?.slotId, filters?.customerId);
      if (resList.length > 0) return resList;
    }
    let list = Array.from(this.reservations.values());
    if (filters?.slotId) {
      list = list.filter((r) => r.slotId === filters.slotId);
    }
    if (filters?.customerId) {
      list = list.filter((r) => r.customerId === filters.customerId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Waitlist — délégation repo (tables `booking_waitlists` branchées, tâche
   * BAC booking #2) avec fallback mémoire quand aucun repo n'est injecté.
   */
  async saveWaitlistEntry(entry: WaitlistEntryLike, position?: number): Promise<void> {
    if (this.postgresRepo?.saveWaitlistEntry) {
      await this.postgresRepo.saveWaitlistEntry(entry, position);
      return;
    }
    const list = this.waitlistFallback.get(entry.slotId) ?? [];
    const idx = list.findIndex((e) => e.id === entry.id);
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    this.waitlistFallback.set(entry.slotId, list);
  }

  async listWaitlistBySlot(slotId: string): Promise<WaitlistEntryLike[]> {
    if (this.postgresRepo?.listWaitlistBySlot) {
      return this.postgresRepo.listWaitlistBySlot(slotId);
    }
    return [...(this.waitlistFallback.get(slotId) ?? [])];
  }

  /**
   * Reminders — délégation repo (table `booking_reminders` branchée, tâche
   * BAC booking #2) avec fallback mémoire. Mapping domaine → colonnes dans
   * `PostgresBookingRepository.saveReminder`.
   */
  async saveReminder(input: ReminderInputLike): Promise<void> {
    if (this.postgresRepo?.saveReminder) {
      await this.postgresRepo.saveReminder(input);
      return;
    }
    this.reminderFallback.set(input.id, {
      ...input,
      createdAt: new Date().toISOString(),
    });
  }

  async listPendingReminders(now: Date | string = new Date()): Promise<PersistedReminderLike[]> {
    if (this.postgresRepo?.listPendingReminders) {
      return this.postgresRepo.listPendingReminders(now);
    }
    const cursor = (now instanceof Date ? now : new Date(now)).getTime();
    return Array.from(this.reminderFallback.values())
      .filter((r) => (r.status ?? "Scheduled") === "Scheduled")
      .filter((r) => new Date(r.triggerTime).getTime() <= cursor)
      .map((r) => ({
        id: r.id,
        slotId: r.slotId,
        userId: r.userId,
        triggerTime:
          r.triggerTime instanceof Date ? r.triggerTime.toISOString() : r.triggerTime,
        type: r.type ?? "T_MINUS_24H",
        reservationId: r.reservationId ?? r.slotId,
        status: r.status ?? "Scheduled",
      }))
      .sort((a, b) => new Date(a.triggerTime).getTime() - new Date(b.triggerTime).getTime());
  }
}

export async function seedDefaultSlots(service: BookingService): Promise<void> {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  await service.createSlot({
    title: "Session Démo 1",
    startTime: `${tomorrow}T10:00:00Z`,
    endTime: `${tomorrow}T11:00:00Z`,
    capacity: 5,
    hostId: "usr_host_1",
  });
  await service.createSlot({
    title: "Session Démo 2",
    startTime: `${tomorrow}T14:00:00Z`,
    endTime: `${tomorrow}T15:00:00Z`,
    capacity: 3,
    hostId: "usr_host_1",
  });
  await service.createSlot({
    title: "Session Démo 3",
    startTime: `${tomorrow}T16:00:00Z`,
    endTime: `${tomorrow}T17:00:00Z`,
    capacity: 10,
    hostId: "usr_host_2",
  });
}
