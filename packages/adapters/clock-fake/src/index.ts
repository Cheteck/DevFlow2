import type { ClockPort } from "@mosaix/ports-clock";

export class FakeClockAdapter implements ClockPort {
  private currentTime: Date;

  constructor(initialTime: Date | string = new Date()) {
    this.currentTime = typeof initialTime === "string" ? new Date(initialTime) : initialTime;
  }

  now(): Date {
    return this.currentTime;
  }

  set(time: Date | string): void {
    this.currentTime = typeof time === "string" ? new Date(time) : time;
  }

  advanceByMs(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }
}
