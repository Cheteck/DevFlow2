import type { ClockPort } from "@mosaix/ports-clock";

export class SystemClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }

  nowISO(): string {
    return this.now().toISOString();
  }
}
