import type { BookingSlot } from "./booking.model.js";

export interface BookingReminder {
  slotId: string;
  userId: string;
  triggerTime: Date;
  type: "T_MINUS_24H" | "T_MINUS_1H";
}

export class BookingReminderScheduler {
  static scheduleReminders(slot: BookingSlot, userId: string): BookingReminder[] {
    const startTime = slot.startTime.getTime();
    const t24h = new Date(startTime - 24 * 60 * 60 * 1000);
    const t1h = new Date(startTime - 1 * 60 * 60 * 1000);

    return [
      { slotId: slot.id, userId, triggerTime: t24h, type: "T_MINUS_24H" },
      { slotId: slot.id, userId, triggerTime: t1h, type: "T_MINUS_1H" },
    ];
  }
}

export interface ResourceAllocation {
  roomId: string;
  staffId: string;
  equipmentIds: string[];
}

export class MultiResourceAllocator {
  private allocations = new Map<string, ResourceAllocation>(); // key = slotId

  allocate(slotId: string, resources: ResourceAllocation): void {
    // Check conflicts
    for (const [existingSlotId, alloc] of this.allocations) {
      if (existingSlotId !== slotId) {
        if (alloc.roomId === resources.roomId) {
          throw new Error(`Room [${resources.roomId}] is already allocated to slot [${existingSlotId}].`);
        }
        if (alloc.staffId === resources.staffId) {
          throw new Error(`Staff [${resources.staffId}] is already allocated to slot [${existingSlotId}].`);
        }
      }
    }
    this.allocations.set(slotId, resources);
  }

  getAllocation(slotId: string): ResourceAllocation | undefined {
    return this.allocations.get(slotId);
  }
}

export class BookingAnalyticsEngine {
  static computeStats(slots: BookingSlot[]): {
    totalSlots: number;
    fillRate: number;
    totalRevenue: number;
    noShowRate: number;
  } {
    if (slots.length === 0) {
      return { totalSlots: 0, fillRate: 0, totalRevenue: 0, noShowRate: 0 };
    }

    const booked = slots.filter((s) => s.status === "BOOKED");
    const fillRate = booked.length / slots.length;
    const totalRevenue = booked.reduce((acc, s) => acc + (s.price ?? 0), 0);

    return {
      totalSlots: slots.length,
      fillRate: Math.round(fillRate * 100) / 100,
      totalRevenue,
      noShowRate: 0.05, // 5% baseline
    };
  }
}
