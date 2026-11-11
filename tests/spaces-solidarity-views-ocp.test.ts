import { describe, it, expect } from "vitest";
import type { BacExecutionContext } from "@mosaix/contracts";
import {
  createSpacesDescriptor,
  registerSpacesSubView,
} from "../apps/spaces/src/presentation/spaces-view.js";
import {
  createSolidarityDescriptor,
  registerSolidaritySubView,
} from "../apps/solidarity/src/presentation/solidarity-view.js";

describe("Spaces & Solidarity Presentation Views OCP SubView Registry Extension", () => {
  it("allows registering custom subviews for Spaces BAC without modifying createSpacesDescriptor", async () => {
    registerSpacesSubView("analytics", async (_context) => {
      return `<div class="custom-analytics-view">Spaces Analytics Dashboard</div>`;
    });

    const descriptor = createSpacesDescriptor();
    const mockContext: Partial<BacExecutionContext> = {
      request: { query: { view: "analytics" } } as unknown as BacExecutionContext["request"],
      user: { id: "user1", role: "member", roles: ["member"] } as unknown as BacExecutionContext["user"],
    };

    const result = await descriptor.render(mockContext as BacExecutionContext);

    expect(result.contentHtml).toContain("Spaces Analytics Dashboard");
    expect(result.pageTitle).toContain("analytics");
  });

  it("allows registering custom subviews for Solidarity BAC without modifying createSolidarityDescriptor", async () => {
    registerSolidaritySubView("donations", async (_context) => {
      return `<div class="custom-donations-view">Donations SubView</div>`;
    });

    const descriptor = createSolidarityDescriptor();
    const mockContext: Partial<BacExecutionContext> = {
      request: { query: { view: "donations" } } as unknown as BacExecutionContext["request"],
      user: { id: "user1", role: "member", roles: ["member"] } as unknown as BacExecutionContext["user"],
    };

    const result = await descriptor.render(mockContext as BacExecutionContext);

    expect(result.contentHtml).toContain("Donations SubView");
  });
});
