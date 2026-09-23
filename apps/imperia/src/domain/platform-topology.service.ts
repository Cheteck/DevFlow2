import { AppConformanceValidator } from "@mosaix/conformance";

export interface BoundedContextTopology {
  id: string;
  name: string;
  version: string;
  capabilitiesCount: number;
  permissionsCount: number;
  eventsCount: number;
  status: "active" | "maintenance" | "degraded";
  conformanceScore: number;
  isValidManifest: boolean;
  validationErrors?: string[];
}

export interface PlatformHealthIndicators {
  dlqCount?: number;
  trippedCircuitBreakers?: number;
  databaseConnected?: boolean;
}

export class PlatformTopologyService {
  private registeredManifests = new Map<string, Record<string, unknown>>();

  constructor() {
    this.seedDefaultManifests();
  }

  private seedDefaultManifests(): void {
    const defaultApps = [
      {
        id: "@apps/citadelle",
        name: "Citadelle Identité",
        version: "1.0.0",
        domain: { name: "citadelle" },
        capabilities: [{ id: "identity.user.create" }, { id: "identity.user.lookup" }],
        permissions: ["citadelle:user:create", "citadelle:user:read"],
        events: ["identity.user.created", "identity.user.updated"],
      },
      {
        id: "@apps/solara",
        name: "MosaiX Solara Social Engine",
        version: "1.0.0",
        domain: { name: "social" },
        capabilities: [{ id: "solara.post.create" }, { id: "solara.comment.add" }],
        permissions: ["solara:post:create", "solara:comment:add"],
        events: ["solara.post.published"],
      },
      {
        id: "@apps/solidarity",
        name: "MosaiX Solidarity",
        version: "1.0.0",
        domain: { name: "solidarity" },
        capabilities: [{ id: "solidarity.incident.create" }, { id: "solidarity.need.declare" }],
        permissions: ["solidarity:incident:create", "solidarity:need:declare"],
        events: ["solidarity.incident.created"],
      },
      {
        id: "@apps/imperia",
        name: "MosaiX Imperia Governance",
        version: "1.0.0",
        domain: { name: "imperia" },
        capabilities: [{ id: "imperia.governance.inspect" }, { id: "imperia.topology.query" }],
        permissions: ["imperia:governance:inspect", "imperia:governance:audit"],
        events: ["imperia.policy.updated"],
      },
      {
        id: "@apps/spaces",
        name: "MosaiX Spaces",
        version: "1.0.0",
        domain: { name: "spaces" },
        capabilities: [{ id: "spaces.space.create" }, { id: "spaces.module.toggle" }],
        permissions: ["spaces:space:create", "spaces:space:manage"],
        events: ["spaces.space.created"],
      },
      {
        id: "@apps/commerce",
        name: "Commerce & Orders",
        version: "1.0.0",
        domain: { name: "commerce" },
        capabilities: [{ id: "commerce.order.create" }, { id: "commerce.order.read" }],
        permissions: ["commerce:order:create", "commerce:order:read"],
        events: ["commerce.order.created"],
      },
      {
        id: "@apps/beam",
        name: "MosaiX Beam Instant Messenger",
        version: "1.0.0",
        domain: { name: "messaging" },
        capabilities: [{ id: "beam.message.send" }, { id: "beam.conversation.create" }],
        permissions: ["beam:message:send", "beam:conversation:read"],
        events: ["beam.message.sent"],
      },
      {
        id: "@apps/portfolio",
        name: "Portfolio & Product Information",
        version: "1.0.0",
        domain: { name: "portfolio" },
        capabilities: [{ id: "portfolio.vendable.create" }, { id: "portfolio.vendable.publish" }],
        permissions: ["portfolio:vendable:create", "portfolio:vendable:read"],
        events: ["portfolio.vendable.created"],
      },
      {
        id: "@apps/booking",
        name: "Booking",
        version: "1.0.0",
        domain: { name: "booking" },
        capabilities: [{ id: "booking.slot.create" }, { id: "booking.reservation.create" }],
        permissions: ["booking:slot:create", "booking:slot:read"],
        events: ["booking.slot.created"],
      },
    ];

    for (const app of defaultApps) {
      this.registeredManifests.set(app.id, app);
    }
  }

  registerManifest(manifest: Record<string, unknown>): void {
    const id = (manifest.id as string) || `app-${Date.now()}`;
    this.registeredManifests.set(id, manifest);
  }

  getTopologyOverview(health?: PlatformHealthIndicators): {
    totalContexts: number;
    averageConformanceScore: number;
    contexts: BoundedContextTopology[];
  } {
    const contexts: BoundedContextTopology[] = [];

    for (const [id, manifest] of this.registeredManifests.entries()) {
      const validation = AppConformanceValidator.validate(manifest);
      const caps = Array.isArray(manifest.capabilities) ? manifest.capabilities.length : 0;
      const perms = Array.isArray(manifest.permissions) ? manifest.permissions.length : 0;
      const events = Array.isArray(manifest.events) ? manifest.events.length : 0;

      // Realistic score calculation based on conformance + contract richness
      let score = validation.valid ? 90 : 50;
      if (caps > 0) score += 4;
      if (perms > 0) score += 3;
      if (events > 0) score += 3;
      if (!validation.valid) {
        score -= validation.errors.length * 10;
      }
      score = Math.max(20, Math.min(100, score));

      let status: "active" | "maintenance" | "degraded" = "active";
      if (!validation.valid) {
        status = "degraded";
      } else if (health?.trippedCircuitBreakers && health.trippedCircuitBreakers > 0 && id.includes("commerce")) {
        status = "degraded";
        score -= 15;
      }

      const cleanId = id.replace(/^@apps\//, "");
      contexts.push({
        id: cleanId,
        name: (manifest.name as string) || cleanId,
        version: (manifest.version as string) || "1.0.0",
        capabilitiesCount: caps,
        permissionsCount: perms,
        eventsCount: events,
        status,
        conformanceScore: score,
        isValidManifest: validation.valid,
        validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
      });
    }

    const totalScore = contexts.reduce((acc, c) => acc + c.conformanceScore, 0);
    const averageConformanceScore = contexts.length > 0 ? Math.round(totalScore / contexts.length) : 100;

    return {
      totalContexts: contexts.length,
      averageConformanceScore,
      contexts,
    };
  }

  validateContextConformance(manifest: Record<string, unknown>): { isValid: boolean; errors: string[] } {
    const result = AppConformanceValidator.validate(manifest);
    return {
      isValid: result.valid,
      errors: result.errors,
    };
  }
}
