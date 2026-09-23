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

  private postgresRepo?: {
    saveSlot(slot: BookingSlot): Promise<void>;
    getSlot(id: string): Promise<BookingSlot | null>;
    listSlots(providerId?: string, status?: string): Promise<BookingSlot[]>;
    saveReservation(res: Reservation): Promise<void>;
    getReservation(id: string): Promise<Reservation | null>;
    listReservations(slotId?: string, customerId?: string): Promise<Reservation[]>;
  };

  constructor(postgresRepo?: NonNullable<BookingService["postgresRepo"]>) {
    this.postgresRepo = postgresRepo;
    this.seedDefaultSlots();
  }

  getRecordedEvents(): readonly BookingDomainEvent[] {
    return [...this.domainEvents];
  }

  private recordEvent(event: BookingDomainEvent): void {
    this.domainEvents.push(event);
  }

  async seedDefaultSlots(): Promise<void> {
    const defaultSlots: BookingSlot[] = [
      {
        id: "slot-001",
        providerId: "provider-amel",
        serviceName: "Consultation Joaillerie & Sur-mesure",
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        timezone: "Europe/Paris",
        capacity: 1,
        reservedCount: 0,
        status: "available",
        location: "Showroom Bijoux Amel, Paris",
        price: 85,
        currency: "EUR",
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-002",
        providerId: "provider-solara",
        serviceName: "Atelier Collaboratif — Économie Circulaire",
        startTime: new Date(Date.now() + 172800000).toISOString(),
        endTime: new Date(Date.now() + 180000000).toISOString(),
        timezone: "Europe/Paris",
        capacity: 10,
        reservedCount: 3,
        status: "available",
        location: "Espace Solara Lab, Lyon",
        price: 0,
        currency: "EUR",
        createdAt: new Date().toISOString(),
      },
      {
        id: "slot-003",
        providerId: "provider-imperia",
        serviceName: "Audition de Conformité & Audit Gouvernance",
        startTime: new Date(Date.now() + 259200000).toISOString(),
        endTime: new Date(Date.now() + 266400000).toISOString(),
        timezone: "Europe/Paris",
        capacity: 4,
        reservedCount: 4,
        status: "fully_booked",
        location: "Chambre MosaiX Imperia (Visio)",
        price: 250,
        currency: "EUR",
        createdAt: new Date().toISOString(),
      },
    ];

    for (const slot of defaultSlots) {
      this.slots.set(slot.id, slot);
      if (this.postgresRepo) {
        await this.postgresRepo.saveSlot(slot);
      }
    }
  }

  async createSlot(input: CreateSlotInput): Promise<BookingSlot> {
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
    // Idempotency check
    if (input.idempotencyKey && this.idempotencyStore.has(input.idempotencyKey)) {
      const existingId = this.idempotencyStore.get(input.idempotencyKey)!;
      const existing = await this.getReservation(existingId);
      if (existing) return existing;
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
}
