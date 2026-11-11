import { describe, expect, it } from "vitest";
import { createCitadelleDescriptor } from "./citadelle-view.js";
import type { BacExecutionContext } from "@mosaix/contracts";

describe("Citadelle View Descriptor", () => {
  const descriptor = createCitadelleDescriptor();

  const createMockContext = (
    tab = "profile",
    isAuthenticated = false,
    roles: string[] = ["member"],
  ): BacExecutionContext => ({
    tenantId: "tenant-test",
    spaceId: null,
    user: {
      id: "u-123",
      email: "citoyen@mosaix.dz",
      roles,
      permissions: ["identity:user:read"],
      isAuthenticated,
    },
    theme: { mode: "dark" },
    request: {
      path: "/citadelle",
      query: { tab },
      headers: {},
    },
  });

  it("renders profile tab with masked information and ARIA role", async () => {
    const ctx = createMockContext("profile", true, ["citizen"]);
    const res = await descriptor.render(ctx);

    expect(res.pageTitle).toContain("Citadelle");
    expect(res.contentHtml).toContain("Citadelle IAM");
    expect(res.contentHtml).toContain('role="tablist"');
    expect(res.contentHtml).toContain('data-action="anonymize-account"');
    expect(res.contentHtml).toContain("/api/user/gdpr-anonymize");
  });

  it("renders security tab without fake Paris IP outside demo mode", async () => {
    const ctx = createMockContext("security", true, ["citizen"]);
    const res = await descriptor.render(ctx);

    expect(res.contentHtml).toContain("Double Authentification");
    expect(res.contentHtml).not.toContain("Paris, France");
    expect(res.contentHtml).toContain('data-action="regenerate-mfa"');
  });

  it("renders users tab with localized roles for admin users", async () => {
    const ctx = createMockContext("users", true, ["admin"]);
    const res = await descriptor.render(ctx);

    expect(res.contentHtml).toContain("Registre des Citoyens");
    expect(res.contentHtml).toContain('data-action="manage-user"');
  });

  it("consumes theme CSS variables and dark-mode selectors instead of hardcoded colors", async () => {
    const ctx = createMockContext("profile", true, ["citizen"]);
    const res = await descriptor.render(ctx);

    // Explicit theme-variable consumption in the view root style block.
    expect(res.contentHtml).toContain("var(--color-primary");
    expect(res.contentHtml).toContain("var(--mx-color-primary");
    expect(res.contentHtml).toContain("var(--color-surface");
    expect(res.contentHtml).toContain("var(--mx-color-surface");
    expect(res.contentHtml).toContain("var(--color-on-surface");
    expect(res.contentHtml).toContain("var(--mx-color-text");

    // Dark-mode hot-switching scope injected by the shell runtime.
    expect(res.contentHtml).toContain('[data-theme-mode="dark"]');
    expect(res.contentHtml).toContain('[data-resolved-mode="dark"]');
  });
});
