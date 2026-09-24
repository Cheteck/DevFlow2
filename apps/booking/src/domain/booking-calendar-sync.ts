import type { BookingSlot, Reservation } from "./booking.model.js";

export interface IcsEventOptions {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organizerEmail?: string;
  organizerName?: string;
  attendeeEmail?: string;
  rrule?: string; // e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10"
}

/**
 * RFC 5545 Compliant iCalendar (.ics) Generator
 * Compatible with Google Calendar, Apple Calendar, Outlook
 */
export class IcsCalendarGenerator {
  private static formatIcsDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  static generateEvent(options: IcsEventOptions): string {
    const dtStart = this.formatIcsDate(options.startTime);
    const dtEnd = this.formatIcsDate(options.endTime);
    const dtStamp = this.formatIcsDate(new Date());

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MosaiX Platform//Booking Engine//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${options.uid}@mosaix.platform`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${options.summary.replace(/[\r\n]/g, " ")}`,
    ];

    if (options.description) {
      lines.push(`DESCRIPTION:${options.description.replace(/[\r\n]/g, "\\n")}`);
    }

    if (options.location) {
      lines.push(`LOCATION:${options.location.replace(/[\r\n]/g, " ")}`);
    }

    if (options.organizerEmail) {
      const orgName = options.organizerName ? `CN=${options.organizerName}:` : "";
      lines.push(`ORGANIZER;${orgName}mailto:${options.organizerEmail}`);
    }

    if (options.attendeeEmail) {
      lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${options.attendeeEmail}`);
    }

    if (options.rrule) {
      lines.push(`RRULE:${options.rrule}`);
    }

    lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

    return lines.join("\r\n");
  }

  static fromSlotAndReservation(slot: BookingSlot, reservation: Reservation): string {
    return this.generateEvent({
      uid: reservation.id,
      summary: `Réservation MosaiX: ${slot.serviceName}`,
      description: `Réservation confirmée pour ${reservation.customerName}. Créneau ID: ${slot.id}`,
      location: slot.location || "En ligne / Sur place",
      startTime: new Date(slot.startTime),
      endTime: new Date(slot.endTime),
      attendeeEmail: reservation.customerEmail,
      organizerName: slot.serviceName,
    });
  }
}

/**
 * Waitlist Customer Entry
 */
export interface WaitlistEntry {
  id: string;
  slotId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  joinedAt: Date;
  status: "waiting" | "promoted" | "expired";
}

/**
 * Automated Waitlist Manager with FIFO Promotion
 */
export class BookingWaitlistManager {
  private waitlists = new Map<string, WaitlistEntry[]>();

  addToWaitlist(slotId: string, customerId: string, customerName: string, customerEmail: string): WaitlistEntry {
    const list = this.waitlists.get(slotId) ?? [];
    const entry: WaitlistEntry = {
      id: `wtl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      slotId,
      customerId,
      customerName,
      customerEmail,
      joinedAt: new Date(),
      status: "waiting",
    };
    list.push(entry);
    this.waitlists.set(slotId, list);
    return entry;
  }

  getWaitlist(slotId: string): WaitlistEntry[] {
    return (this.waitlists.get(slotId) ?? []).filter((e) => e.status === "waiting");
  }

  promoteNextInQueue(slotId: string): WaitlistEntry | null {
    const list = this.waitlists.get(slotId);
    if (!list) return null;

    const next = list.find((e) => e.status === "waiting");
    if (!next) return null;

    next.status = "promoted";
    return next;
  }
}
