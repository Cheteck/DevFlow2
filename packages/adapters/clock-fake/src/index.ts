import type { ClockPort } from "@mosaix/ports-clock";

export class FakeClockAdapter implements ClockPort {
  private currentTime: Date;

  constructor(initialTime: Date = new Date("2026-01-01T00:00:00.000Z")) {
    this.currentTime = initialTime;
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  nowISO(): string {
    return this.now().toISOString();
  }

  /** Advances the clock by a given number of milliseconds. */
  tick(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  /** Sets the clock to a specific Date. */
  setTime(time: Date): void {
    this.currentTime = new Date(time);
  }
}
