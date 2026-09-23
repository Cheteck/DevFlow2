import { describe, expect, it } from "vitest";
import { UuidGeneratorAdapter } from "./index";

describe("UuidGeneratorAdapter", () => {
  it("generates valid UUID v4 strings", () => {
    const generator = new UuidGeneratorAdapter();
    const id1 = generator.generate();
    const id2 = generator.generate();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
