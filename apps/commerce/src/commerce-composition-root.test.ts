/**
 * Commerce composition-root tests: the public contract builds descriptors
 * without exposing internal layers to callers.
 */

import { describe, it, expect } from "vitest";
import type { DatabasePort } from "@mosaix/ports-database";
import {
  createCommerceFallbackDescriptor,
  createCommerceWiredDescriptor,
} from "./composition-root.js";

describe("commerce composition root", () => {
  it("builds the fallback descriptor (honest empty states, no database)", () => {
    const descriptor = createCommerceFallbackDescriptor();
    expect(descriptor.id).toBe("@apps/commerce");
    expect(descriptor.routePrefix).toBe("/commerce");
  });

  it("builds the wired descriptor from a DatabasePort (no I/O at wiring time)", () => {
    const db = {} as unknown as DatabasePort;
    const descriptor = createCommerceWiredDescriptor(db);
    expect(descriptor.id).toBe("@apps/commerce");
    expect(descriptor.routePrefix).toBe("/commerce");
  });
});
