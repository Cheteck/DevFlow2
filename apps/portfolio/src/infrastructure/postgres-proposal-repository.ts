/**
 * @apps/portfolio — PostgreSQL adapter for ProposalRepository.
 * Implements the domain-owned ProposalRepository port with Postgres persistence
 * on the `portfolio_proposals` table (migration 20260924120000).
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { Proposal, ProposalStatus } from "../domain/proposal.js";
import type { ProposalRepository } from "../domain/proposal-repository.js";

const COLUMNS = [
  '"id"',
  '"spaceId"',
  '"proposerUserId"',
  '"suggestedReference"',
  '"type"',
  '"status"',
  '"content"',
  '"classification"',
  '"characteristics"',
  '"features"',
  '"variants"',
  '"media"',
  '"translations"',
  '"platformFeedback"',
  '"rejectionReason"',
  '"reviewedBy"',
  '"reviewStartedAt"',
  '"vendableId"',
  '"submittedAt"',
  '"reviewedAt"',
  '"createdAt"',
  '"updatedAt"',
].join(", ");

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export class PostgresProposalRepository implements ProposalRepository {
  constructor(private readonly db: DatabasePort) {}

  async save(proposal: Proposal): Promise<void> {
    const placeholders = Array.from({ length: 22 }, (_, i) => `$${i + 1}`).join(", ");
    await this.db.execute(
      `INSERT INTO "portfolio_proposals" (${COLUMNS}) VALUES (${placeholders})`,
      this.toRow(proposal),
    );
  }

  async update(proposal: Proposal): Promise<void> {
    const values = this.toRow(proposal);
    await this.db.execute(
      `UPDATE "portfolio_proposals" SET
        "spaceId" = $2, "proposerUserId" = $3, "suggestedReference" = $4, "type" = $5,
        "status" = $6, "content" = $7, "classification" = $8, "characteristics" = $9,
        "features" = $10, "variants" = $11, "media" = $12, "translations" = $13,
        "platformFeedback" = $14, "rejectionReason" = $15, "reviewedBy" = $16,
        "reviewStartedAt" = $17, "vendableId" = $18, "submittedAt" = $19,
        "reviewedAt" = $20, "createdAt" = $21, "updatedAt" = $22
       WHERE "id" = $1`,
      values,
    );
  }

  async findById(id: string): Promise<Proposal | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM "portfolio_proposals" WHERE "id" = $1`,
      [id],
    );
    const row = rows[0];
    return row ? this.hydrate(row) : null;
  }

  async findBySpace(spaceId: string): Promise<Proposal[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM "portfolio_proposals" WHERE "spaceId" = $1`,
      [spaceId],
    );
    return rows.map((row) => this.hydrate(row));
  }

  async findByStatus(status: ProposalStatus): Promise<Proposal[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM "portfolio_proposals" WHERE "status" = $1`,
      [status],
    );
    return rows.map((row) => this.hydrate(row));
  }

  async listAll(): Promise<Proposal[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM "portfolio_proposals"`,
    );
    return rows.map((row) => this.hydrate(row));
  }

  private toRow(proposal: Proposal): unknown[] {
    return [
      proposal.id,
      proposal.spaceId,
      proposal.proposerUserId,
      proposal.suggestedReference,
      proposal.type,
      proposal.status,
      JSON.stringify(proposal.content),
      JSON.stringify(proposal.classification),
      JSON.stringify(proposal.characteristics),
      JSON.stringify(proposal.features),
      JSON.stringify(proposal.variants),
      JSON.stringify(proposal.media),
      JSON.stringify(proposal.translations),
      proposal.platformFeedback ?? null,
      proposal.rejectionReason ?? null,
      proposal.reviewedBy ?? null,
      proposal.reviewStartedAt ?? null,
      proposal.vendableId ?? null,
      proposal.submittedAt ?? null,
      proposal.reviewedAt ?? null,
      proposal.createdAt,
      proposal.updatedAt,
    ];
  }

  private hydrate(row: Record<string, unknown>): Proposal {
    return {
      id: asString(row.id),
      spaceId: asString(row.spaceId),
      proposerUserId: asString(row.proposerUserId),
      suggestedReference: asString(row.suggestedReference),
      type: asString(row.type, "Product") as Proposal["type"],
      status: asString(row.status, "Draft") as ProposalStatus,
      content: asJson<Record<string, unknown>>(row.content, {}),
      classification: asJson<Record<string, unknown>>(row.classification, {}),
      characteristics: asJson<Record<string, unknown>>(row.characteristics, {}),
      features: asJson<Record<string, unknown>>(row.features, {}),
      variants: asJson<Record<string, unknown>>(row.variants, {}),
      media: asJson<Record<string, unknown>>(row.media, {}),
      translations: asJson<Record<string, unknown>>(row.translations, {}),
      platformFeedback: asNullableString(row.platformFeedback),
      rejectionReason: asNullableString(row.rejectionReason),
      reviewedBy: asNullableString(row.reviewedBy),
      reviewStartedAt: asNullableString(row.reviewStartedAt),
      vendableId: asNullableString(row.vendableId),
      submittedAt: asNullableString(row.submittedAt),
      reviewedAt: asNullableString(row.reviewedAt),
      createdAt: asString(row.createdAt),
      updatedAt: asString(row.updatedAt),
    };
  }
}
