import { describe, expect, it } from "vitest";
import { FakeClockAdapter } from "./index";

describe("FakeClockAdapter", () => {
  it("initializes with initial date and responds to tick", () => {
    const initial = new Date("2026-08-05T12:00:00.000Z");
    const clock = new FakeClockAdapter(initial);

    expect(clock.nowISO()).toBe("2026-08-05T12:00:00.000Z");

    clock.tick(5000); // Advance 5 seconds
    expect(clock.nowISO()).toBe("2026-08-05T12:00:05.000Z");

    clock.setTime(new Date("2027-01-01T00:00:00.000Z"));
    expect(clock.nowISO()).toBe("2027-01-01T00:00:00.000Z");
  });
});
