import { describe, expect, it } from "vitest";
import { SystemClockAdapter } from "./index";

describe("SystemClockAdapter", () => {
  it("returns a valid current Date and ISO string", () => {
    const clock = new SystemClockAdapter();
    const date = clock.now();
    const iso = clock.nowISO();

    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(false);

    expect(typeof iso).toBe("string");
    expect(new Date(iso).getTime()).not.toBeNaN();
    expect(Math.abs(date.getTime() - new Date(iso).getTime())).toBeLessThan(
      1000,
    );
  });
});
