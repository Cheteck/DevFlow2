/**
 * ClockPort — Decouples system time from the domain.
 */
export interface ClockPort {
  /** Returns the current system Date. */
  now(): Date;
  /** Returns the current system time as an ISO 8601 string. */
  nowISO(): string;
}
