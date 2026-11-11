/**
 * Spaces composition-root tests: the public contract builds descriptors
 * without exposing internal layers to callers.
 */

import { describe, it, expect } from "vitest";
import type { DatabasePort } from "@mosaix/ports-database";
import {
  createSpacesFallbackDescriptor,
  createSpacesWiredDescriptor,
} from "./composition-root.js";

describe("spaces composition root", () => {
  it("builds the fallback descriptor (honest empty states, no database)", () => {
    const descriptor = createSpacesFallbackDescriptor();
    expect(descriptor.id).toBe("@apps/spaces");
    expect(descriptor.routePrefix).toBe("/spaces");
  });

  it("builds the wired descriptor from a DatabasePort (no I/O at wiring time)", () => {
    const db = {} as unknown as DatabasePort;
    const descriptor = createSpacesWiredDescriptor(db);
    expect(descriptor.id).toBe("@apps/spaces");
    expect(descriptor.routePrefix).toBe("/spaces");
  });
});
