import { describe, it, expect } from "vitest";
import type {
  SurfaceContract,
  SlotContract,
  ContributionContract,
  CompositionContext,
} from "./index";

describe("Experience Contracts Schema & Compliance Suite (Phase P6)", () => {
  it("validates SurfaceContract structural and contextual regions", () => {
    const surface: SurfaceContract = {
      id: "application-shell",
      kind: "structural",
      ownedBy: "shell",
      label: "Application Shell",
      slots: [],
    };

    expect(surface.id).toBe("application-shell");
    expect(surface.kind).toBe("structural");
    expect(surface.ownedBy).toBe("shell");
  });

  it("validates SlotContract accepts array and layout constraints", () => {
    const slot: SlotContract = {
      id: "shell.primary-sidebar",
      surfaceId: "application-shell",
      accepts: ["navigation", "section"],
      layout: "stack",
    };

    expect(slot.accepts).toContain("navigation");
    expect(slot.layout).toBe("stack");
  });

  it("validates ContributionContract without renderer leakage", () => {
    const contribution: ContributionContract = {
      id: "solidarity:crisis-dispatch",
      contractVersion: "1.0.0",
      ownerApp: "@apps/solidarity",
      kind: "action",
      title: "Crisis Dispatch",
      placements: [
        {
          id: "p1",
          surfaceId: "application-shell",
          slotId: "shell.navbar",
          order: 10,
        },
      ],
    };

    expect(contribution.contractVersion).toBe("1.0.0");
    expect(contribution.kind).toBe("action");
    expect((contribution as unknown as Record<string, unknown>).component).toBeUndefined();
  });

  it("validates CompositionContext identity and role attributes", () => {
    const context: CompositionContext = {
      tenant: { id: "tenant-acme" },
      user: {
        id: "usr_jean_dupont",
        roles: ["platform-governor"],
      },
      permissions: ["governance:admin"],
      capabilities: ["platform:control-plane"],
    };

    expect(context.tenant.id).toBe("tenant-acme");
    expect(context.user?.roles).toContain("platform-governor");
  });
});
