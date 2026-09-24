import { describe, it, expect, beforeEach } from "vitest";
import { SpaceService } from "./domain/space.model.js";
import { SpaceCustomDomainEngine } from "./domain/domain-state-machine.js";
import { SpaceRolePolicyEngine } from "./domain/space-roles.js";
import { SpaceAudienceEngine } from "./domain/space-audience.js";
import { ActingAsSpaceEngine } from "./domain/acting-as-space.js";
import { createSpacesApp, MANIFEST } from "./index.js";
import { RuntimeKernel } from "@mosaix/sdk";

describe("MosaiX Spaces BAC — Core Capabilities & Closed Gaps", () => {
  let service: SpaceService;
  let roleEngine: SpaceRolePolicyEngine;
  let audienceEngine: SpaceAudienceEngine;
  let actingEngine: ActingAsSpaceEngine;

  beforeEach(() => {
    service = new SpaceService();
    roleEngine = new SpaceRolePolicyEngine();
    audienceEngine = new SpaceAudienceEngine();
    actingEngine = new ActingAsSpaceEngine();
  });

  it("exports valid MANIFEST and creates app via factory", async () => {
    expect(MANIFEST.id).toBe("@apps/spaces");
    const kernel = new RuntimeKernel();
    const tenant = { id: "test-tenant", organizationId: "test-org" };

    const { container, router, app } = await createSpacesApp(kernel, tenant);
    expect(container).toBeDefined();
    expect(router).toBeDefined();
    expect(app.manifest.id).toBe("@apps/spaces");
  });

  it("creates a space with template and maps domain (PRD-Spaces)", async () => {
    const space = await service.createSpaceFromTemplate(
      "Bijoux Amel",
      "shop",
      "usr-amel",
      "tenant-default",
    );

    expect(space.id).toBeDefined();
    expect(space.template).toBe("shop");
    expect(space.slug).toBe("bijoux-amel");
  });


  it("evaluates custom domain DNS and SSL state transitions (GAP-01)", () => {
    let domainRecord = SpaceCustomDomainEngine.initiateDomainVerification("bijoux-amel.com");
    expect(domainRecord.dnsStatus).toBe("PENDING_DNS");
    expect(domainRecord.sslStatus).toBe("NONE");

    domainRecord = SpaceCustomDomainEngine.verifyDNS(domainRecord, true);
    expect(domainRecord.dnsStatus).toBe("VERIFIED");
    expect(domainRecord.sslStatus).toBe("PROVISIONING");

    domainRecord = SpaceCustomDomainEngine.activateSSL(domainRecord, true);
    expect(domainRecord.sslStatus).toBe("ACTIVE");
    expect(domainRecord.sslExpiresAt).toBeDefined();
  });

  it("evaluates custom roles and ABAC capability policies (GAP-02)", () => {
    roleEngine.createRole({
      roleId: "inventory-manager",
      roleName: "Inventory Manager",
      allowedCapabilities: ["portfolio.vendables.create"],
    });

    expect(roleEngine.evaluateCapabilityAccess("inventory-manager", "portfolio.vendables.create")).toBe(true);
    expect(roleEngine.evaluateCapabilityAccess("inventory-manager", "solara.post.create")).toBe(false);
  });

  it("manages public followers and community membership requests (GAP-03)", () => {
    audienceEngine.followSpace("space-1", "usr-100");
    audienceEngine.followSpace("space-1", "usr-101");
    expect(audienceEngine.getFollowersCount("space-1")).toBe(2);

    const req = audienceEngine.requestCommunityMembership("space-1", "usr-102");
    expect(req.status).toBe("PENDING");

    const reviewed = audienceEngine.reviewMembershipRequest(req.id, true);
    expect(reviewed.status).toBe("APPROVED");
  });

  it("records acting-as-space audit events for outbox persistence (GAP-04)", async () => {
    const evt = await actingEngine.executeActionAsSpace("usr-amel", "space-bijoux", "owner", "commerce.order.checkout");
    expect(evt.eventType).toBe("spaces.acting_as.executed");
    expect(evt.context.realUserId).toBe("usr-amel");
    expect(evt.context.activeSpaceId).toBe("space-bijoux");
    expect(actingEngine.getAuditTrail().length).toBe(1);
  });
});
