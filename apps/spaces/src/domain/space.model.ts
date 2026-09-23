import * as crypto from "node:crypto";
import { Model } from "@mosaix/sdk";
import { SpaceTemplateRegistry, type SpaceTemplateType } from "./space-template";

export class SpaceModel extends Model {
  static override tableName = "spaces";

  name!: string;
  slug!: string;
  category!: "business" | "organization" | "brand" | "personality" | "venue";
  template!: SpaceTemplateType;
  ownerId!: string;
  tenantId!: string;
  followersCount!: number;
  customDomain?: string;
  enabledCapabilities!: string[];
}

export interface SpaceTeamMember {
  userId: string;
  role: "owner" | "administrator" | "editor" | "moderator" | "analyst" | string;
  permissions: string[];
  actingAsAllowedScopes: Array<"social" | "messaging" | "commerce" | "booking" | "events">;
}

export interface Space {
  id: string;
  name: string;
  slug: string;
  category: string;
  template: SpaceTemplateType;
  ownerId: string;
  tenantId: string;
  subscriptionPlan: "free" | "pro" | "enterprise";
  followersCount: number;
  customDomain?: string;
  team: SpaceTeamMember[];
  enabledCapabilities: string[];
  publicNavigation: string[];
  createdAt: Date;
}

export interface SpaceRepositoryPort {
  createSpace(space: Space): Promise<void>;
  getSpace(id: string): Promise<Space | undefined>;
  getSpaceByDomainOrSlug(identifier: string): Promise<Space | undefined>;
  listSpaces(tenantId?: string, limit?: number, offset?: number): Promise<Space[]>;
  addCapability(spaceId: string, capabilityName: string): Promise<Space | null>;
  addTeamMember(spaceId: string, member: SpaceTeamMember): Promise<Space | null>;
  setCustomDomain(spaceId: string, domain: string): Promise<Space | null>;
  followSpace(spaceId: string): Promise<number>;
}

export class SpaceService {
  private spaces = new Map<string, Space>();
  private templateRegistry = new SpaceTemplateRegistry();

  constructor(private readonly repository?: SpaceRepositoryPort) {}

  async createSpaceFromTemplate(
    name: string,
    templateType: SpaceTemplateType,
    ownerId: string,
    tenantId: string,
    customDomain?: string,
    subscriptionPlan: "free" | "pro" | "enterprise" = "free"
  ): Promise<Space> {
    const template = this.templateRegistry.getTemplate(templateType);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `space-${crypto.randomUUID()}`;

    const space: Space = {
      id,
      name,
      slug,
      category: template.recommendedCategory,
      template: templateType,
      ownerId,
      tenantId,
      subscriptionPlan,
      followersCount: 0,
      ...(customDomain ? { customDomain } : {}),
      team: [
        {
          userId: ownerId,
          role: "owner",
          permissions: ["*"],
          actingAsAllowedScopes: ["social", "messaging", "commerce", "booking", "events"],
        },
      ],
      enabledCapabilities: [...template.recommendedCapabilities],
      publicNavigation: [...template.initialNavigation],
      createdAt: new Date(),
    };

    this.spaces.set(id, space);
    if (this.repository) {
      await this.repository.createSpace(space);
    }
    return space;
  }

  getSpace(id: string): Space | undefined {
    return this.spaces.get(id);
  }

  async getSpaceAsync(id: string): Promise<Space | undefined> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.getSpace(id);
        if (fromDb) {
          this.spaces.set(fromDb.id, fromDb);
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("Failed to fetch space from repository:", err);
      }
    }
    return this.getSpace(id);
  }

  getSpaceByDomainOrSlug(identifier: string): Space | undefined {
    return Array.from(this.spaces.values()).find(
      (s) => s.slug === identifier || s.customDomain === identifier || `${s.slug}.mosaix.com` === identifier
    );
  }

  listSpaces(tenantId?: string): Space[] {
    const list = Array.from(this.spaces.values());
    if (tenantId) {
      return list.filter((s) => s.tenantId === tenantId);
    }
    return list;
  }

  async listSpacesAsync(tenantId?: string): Promise<Space[]> {
    if (this.repository) {
      try {
        const fromDb = await this.repository.listSpaces(tenantId);
        if (fromDb.length > 0) {
          for (const s of fromDb) {
            this.spaces.set(s.id, s);
          }
          return fromDb;
        }
      } catch (err: unknown) {
        console.error("Failed to list spaces from repository:", err);
      }
    }
    return this.listSpaces(tenantId);
  }

  async addCapability(spaceId: string, capabilityName: string): Promise<Space> {
    const space = await this.getSpaceAsync(spaceId);
    if (!space) throw new Error(`Space [${spaceId}] non trouvé.`);

    if (!space.enabledCapabilities.includes(capabilityName)) {
      space.enabledCapabilities.push(capabilityName);
      if (this.repository) {
        await this.repository.addCapability(spaceId, capabilityName);
      }
    }
    return space;
  }

  async addTeamMember(spaceId: string, member: SpaceTeamMember): Promise<Space> {
    const space = await this.getSpaceAsync(spaceId);
    if (!space) throw new Error(`Space [${spaceId}] non trouvé.`);

    const existingIdx = space.team.findIndex((m) => m.userId === member.userId);
    if (existingIdx >= 0) {
      space.team[existingIdx] = member;
    } else {
      space.team.push(member);
    }
    if (this.repository) {
      await this.repository.addTeamMember(spaceId, member);
    }
    return space;
  }

  setSubscriptionPlan(spaceId: string, plan: "free" | "pro" | "enterprise"): Space {
    const space = this.getSpace(spaceId);
    if (!space) throw new Error(`Space [${spaceId}] non trouvé.`);
    space.subscriptionPlan = plan;
    return space;
  }

  isUserAdmin(spaceId: string, userId: string): boolean {
    const space = this.getSpace(spaceId);
    if (!space) return false;
    if (space.ownerId === userId) return true;
    const member = space.team.find((m) => m.userId === userId);
    return !!member && (member.role === "owner" || member.role === "administrator" || member.role === "admin");
  }

  async setCustomDomain(spaceId: string, domain: string): Promise<Space> {
    const space = this.getSpace(spaceId);
    if (!space) throw new Error(`Space [${spaceId}] non trouvé.`);

    space.customDomain = domain;
    if (this.repository) {
      await this.repository.setCustomDomain(spaceId, domain);
    }
    return space;
  }

  async followSpace(spaceId: string): Promise<number> {
    const space = this.getSpace(spaceId);
    if (!space) throw new Error(`Space [${spaceId}] non trouvé.`);
    space.followersCount++;
    if (this.repository) {
      await this.repository.followSpace(spaceId);
    }
    return space.followersCount;
  }
}
