/**
 * @apps/spaces — PostgreSQL adapter for SpaceService.
 * Implements persistence for spaces, team members, and capabilities.
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { Space, SpaceTeamMember } from "../domain/space.model.js";

export class PostgresSpaceRepository {
  constructor(private readonly db: DatabasePort) {}

  async createSpace(space: Space): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO spaces_spaces (id, name, slug, category, template, "ownerId", "tenantId", "followersCount", "customDomain", "enabledCapabilities", "publicNavigation", "createdAt", team, data, "subscriptionPlan")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, slug = EXCLUDED.slug, category = EXCLUDED.category,
           template = EXCLUDED.template, "ownerId" = EXCLUDED."ownerId", "tenantId" = EXCLUDED."tenantId",
           "followersCount" = EXCLUDED."followersCount", "customDomain" = EXCLUDED."customDomain",
           "enabledCapabilities" = EXCLUDED."enabledCapabilities", "publicNavigation" = EXCLUDED."publicNavigation",
           team = EXCLUDED.team, data = EXCLUDED.data, "subscriptionPlan" = EXCLUDED."subscriptionPlan",
           "updatedAt" = $16`,
        [
          space.id,
          space.name,
          space.slug,
          space.category,
          space.template,
          space.ownerId,
          space.tenantId,
          space.followersCount,
          space.customDomain ?? null,
          JSON.stringify(space.enabledCapabilities),
          JSON.stringify(space.publicNavigation),
          new Date().toISOString(),
          JSON.stringify(space.team),
          JSON.stringify(space),
          space.subscriptionPlan,
          new Date().toISOString(),
        ],
      );
    });
  }

  async getSpace(id: string): Promise<Space | undefined> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM spaces_spaces WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return undefined;
    const data = rows[0]?.["data"];
    if (data === undefined) return undefined;
    return this.hydrate(data as Record<string, unknown> | string);
  }

  async getSpaceByDomainOrSlug(identifier: string): Promise<Space | undefined> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT data FROM spaces_spaces WHERE slug = $1 OR "customDomain" = $1 OR CONCAT(slug, '.mosaix.com') = $1`,
      [identifier],
    );
    if (rows.length === 0) return undefined;
    const data = rows[0]?.["data"];
    if (data === undefined) return undefined;
    return this.hydrate(data as Record<string, unknown> | string);
  }

  async listSpaces(tenantId?: string, limit = 100, offset = 0): Promise<Space[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const safeOffset = Math.max(offset, 0);
    const rows = tenantId
      ? await this.db.query<Record<string, unknown>>(`SELECT data FROM spaces_spaces WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`, [tenantId, safeLimit, safeOffset])
      : await this.db.query<Record<string, unknown>>(`SELECT data FROM spaces_spaces ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`, [safeLimit, safeOffset]);
    return rows.map((r: Record<string, unknown>) => this.hydrate(r["data"] as Record<string, unknown> | string));
  }

  async addCapability(spaceId: string, capabilityName: string): Promise<Space | null> {
    return this.mutateSpace(spaceId, (space) => {
      if (!space.enabledCapabilities.includes(capabilityName)) {
        space.enabledCapabilities.push(capabilityName);
      }
      return space;
    });
  }

  async addTeamMember(spaceId: string, member: SpaceTeamMember): Promise<Space | null> {
    return this.mutateSpace(spaceId, (space) => {
      const existingIdx = space.team.findIndex((m) => m.userId === member.userId);
      if (existingIdx >= 0) {
        space.team[existingIdx] = member;
      } else {
        space.team.push(member);
      }
      return space;
    });
  }

  async setCustomDomain(spaceId: string, domain: string): Promise<Space | null> {
    return this.mutateSpace(spaceId, (space) => {
      space.customDomain = domain;
      return space;
    });
  }

  /**
   * Read-modify-write inside a single transaction so concurrent writers
   * serialize on the row lock (SELECT ... FOR UPDATE is only meaningful
   * inside the transaction — previously each SELECT ran outside any tx).
   *
   * The UPDATE re-synchronises every mutable derived column from the mutated
   * aggregate (`customDomain`, `enabledCapabilities`, `team`,
   * `publicNavigation`, `subscriptionPlan`, `followersCount`) together with
   * the `data` JSON blob and `updatedAt` — no column is left stale.
   */
  private async mutateSpace(
    spaceId: string,
    mutate: (space: Space) => Space,
  ): Promise<Space | null> {
    let result: Space | null = null;
    await this.db.transaction(async (tx) => {
      const rows = await tx.query<Record<string, unknown>>(
        `SELECT data FROM spaces_spaces WHERE id = $1 FOR UPDATE`,
        [spaceId],
      );
      if (rows.length === 0) {
        result = null;
        return;
      }
      const raw = rows[0]?.["data"];
      if (raw === undefined) {
        result = null;
        return;
      }
      const space = mutate(this.hydrate(raw as Record<string, unknown> | string));
      await tx.query(
        `UPDATE spaces_spaces SET data = $1::jsonb, "customDomain" = $2, "enabledCapabilities" = $3, team = $4, "publicNavigation" = $5, "subscriptionPlan" = $6, "followersCount" = $7, "updatedAt" = $8 WHERE id = $9`,
        [
          JSON.stringify(space),
          space.customDomain ?? null,
          JSON.stringify(space.enabledCapabilities),
          JSON.stringify(space.team),
          JSON.stringify(space.publicNavigation),
          space.subscriptionPlan,
          space.followersCount,
          new Date().toISOString(),
        ].concat([spaceId]),
      );
      result = space;
    });
    return result;
  }

  async followSpace(spaceId: string): Promise<number> {
    const space = await this.mutateSpace(spaceId, (current) => {
      current.followersCount += 1;
      return current;
    });
    return space?.followersCount ?? 0;
  }

  private hydrate(data: Record<string, unknown> | string): Space {
    const raw = (typeof data === "string" ? JSON.parse(data) : data) as Record<string, unknown>;
    const asStringArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    const asTeam = (value: unknown): SpaceTeamMember[] =>
      Array.isArray(value) ? (value as SpaceTeamMember[]) : [];
    const asDate = (value: unknown, fallback: Date): Date => {
      if (value instanceof Date) return value;
      if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      return fallback;
    };
    const plan = raw["subscriptionPlan"];
    const now = new Date();
    return {
      id: String(raw["id"] ?? ""),
      name: String(raw["name"] ?? ""),
      slug: String(raw["slug"] ?? ""),
      category: String(raw["category"] ?? ""),
      template: (raw["template"] ?? "business") as Space["template"],
      ownerId: String(raw["ownerId"] ?? ""),
      tenantId: String(raw["tenantId"] ?? ""),
      subscriptionPlan:
        plan === "free" || plan === "pro" || plan === "enterprise" ? plan : "free",
      followersCount: typeof raw["followersCount"] === "number" ? raw["followersCount"] : 0,
      ...(raw["customDomain"] !== undefined && raw["customDomain"] !== null
        ? { customDomain: String(raw["customDomain"]) }
        : {}),
      team: asTeam(raw["team"]),
      enabledCapabilities: asStringArray(raw["enabledCapabilities"]),
      publicNavigation: asStringArray(raw["publicNavigation"]),
      createdAt: asDate(raw["createdAt"], now),
      ...(raw["updatedAt"] !== undefined && raw["updatedAt"] !== null
        ? { updatedAt: asDate(raw["updatedAt"], now) }
        : {}),
    };
  }
}
