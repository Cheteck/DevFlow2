/**
 * @mosaix/contracts — version contract test.
 */

import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION } from "./index";

describe("contract versioning", () => {
  it("declares a canonical contract version", () => {
    expect(CONTRACT_VERSION).toMatch(/^\d+\.\d+$/);
  });
});
