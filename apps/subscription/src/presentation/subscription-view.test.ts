import { describe, it, expect } from "vitest";
import { createSubscriptionDescriptor } from "./subscription-view.js";
import { SubscriptionService } from "../domain/subscription.service.js";

function ctx(query: Record<string, string> = {}, userId = "user-1") {
  return {
    tenantId: "default",
    spaceId: null,
    user: { id: userId, roles: ["member"], permissions: [], isAuthenticated: true },
    theme: { mode: "dark" },
    request: { path: "/subscription", query, headers: {} },
  } as never;
}

describe("createSubscriptionDescriptor", () => {
  it("renders domain subscription plans dynamically without alert() callbacks", async () => {
    const service = new SubscriptionService();
    const descriptor = createSubscriptionDescriptor(service);
    const result = await descriptor.render!(ctx());

    expect(result.contentHtml).toContain("Community Starter");
    expect(result.contentHtml).toContain("Pro Créateur");
    expect(result.contentHtml).toContain("Entreprise &amp; Collectivités");
    expect(result.contentHtml).not.toContain("alert(");
  });

  it("subscribes user and displays active plan banner when plan query parameter is provided", async () => {
    const service = new SubscriptionService();
    const descriptor = createSubscriptionDescriptor(service);

    const result = await descriptor.render!(ctx({ plan: "plan-pro-creator" }, "user-test-sub"));

    expect(result.contentHtml).toContain("Votre souscription au forfait <strong>plan-pro-creator</strong> a été activée avec succès !");
    expect(result.contentHtml).toContain("Abonnement Actif :");
    expect(result.contentHtml).toContain("plan-pro-creator");

    const sub = service.getUserSubscription("user-test-sub");
    expect(sub).toBeDefined();
    expect(sub?.planId).toBe("plan-pro-creator");
  });
});
