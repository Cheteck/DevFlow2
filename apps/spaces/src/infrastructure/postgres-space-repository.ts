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
        `INSERT INTO spaces_spaces (id, name, slug, category, template, "ownerId", "tenantId", "followersCount", "customDomain", "enabledCapabilities", "publicNavigation", "createdAt", team, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           name = $2, slug = $3, category = $4, "ownerId" = $6, "updatedAt" = $12,
           "followersCount" = $8, team = $13, data = $14`,
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
    }, domain);
  }

  /**
   * Read-modify-write inside a single transaction so concurrent writers
   * serialize on the row lock (SELECT ... FOR UPDATE is only meaningful
   * inside the transaction — previously each SELECT ran outside any tx).
   */
  private async mutateSpace(
    spaceId: string,
    mutate: (space: Space) => Space,
    customDomain?: string,
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
      if (customDomain !== undefined) {
        await tx.query(
          `UPDATE spaces_spaces SET data = $1::jsonb, "customDomain" = $2, "updatedAt" = $3 WHERE id = $4`,
          [JSON.stringify(space), customDomain, new Date().toISOString(), spaceId],
        );
      } else {
        await tx.query(
          `UPDATE spaces_spaces SET data = $1::jsonb, "updatedAt" = $2 WHERE id = $3`,
          [JSON.stringify(space), new Date().toISOString(), spaceId],
        );
      }
      result = space;
    });
    return result;
  }

  async followSpace(spaceId: string): Promise<number> {
    const result = await this.db.query<Record<string, unknown>>(
      `UPDATE spaces_spaces SET "followersCount" = "followersCount" + 1 WHERE id = $1 RETURNING "followersCount"`,
      [spaceId],
    );
    const count = result[0]?.["followersCount"];
    return typeof count === "number" ? count : 0;
  }

  private hydrate(data: Record<string, unknown> | string): Space {
    return (typeof data === "string" ? JSON.parse(data) : data) as Space;
  }
}
