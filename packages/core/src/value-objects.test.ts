import { describe, it, expect } from "vitest";
import { Money, Timestamp } from "./value-objects";

describe("Money & Timestamp Value Objects", () => {
  it("formats and manipulates money amounts in cents safely", () => {
    const price1 = Money.fromCents(2900, "EUR");
    const price2 = Money.fromCents(1000, "EUR");

    expect(price1.amountInCents).toBe(2900);
    expect(price1.amount).toBe(29);
    expect(price1.toJSON().formatted).toBe("29.00 EUR");

    const total = price1.add(price2);
    expect(total.amountInCents).toBe(3900);

    const diff = price1.subtract(price2);
    expect(diff.amountInCents).toBe(1900);
  });

  it("throws on negative resulting monetary amounts or invalid currency", () => {
    expect(() => new Money(-100)).toThrow();
    expect(() => new Money(100, "INVALID")).toThrow();

    const m1 = Money.fromCents(500, "EUR");
    const m2 = Money.fromCents(1000, "EUR");
    expect(() => m1.subtract(m2)).toThrow();
  });

  it("formats and handles Timestamps cleanly", () => {
    const ts = new Timestamp("2026-09-24T12:00:00.000Z");
    expect(ts.toIso()).toBe("2026-09-24T12:00:00.000Z");
    expect(ts.toEpochMs()).toBe(new Date("2026-09-24T12:00:00.000Z").getTime());
  });
});
