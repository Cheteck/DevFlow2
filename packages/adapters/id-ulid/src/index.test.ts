import { describe, expect, it } from "vitest";
import { UlidGeneratorAdapter } from "./index";

describe("UlidGeneratorAdapter", () => {
  it("generates valid ULID-like strings", () => {
    const generator = new UlidGeneratorAdapter();
    const id1 = generator.generate();
    const id2 = generator.generate();

    expect(id1).toHaveLength(26);
    expect(id1).not.toBe(id2);

    // Crockford's Base32 regex: only contains 0-9, A-H, J-K, M-N, P-T, V-Z (no I, L, O, U)
    expect(id1).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
