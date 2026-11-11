/**
 * @apps/portfolio — PostgreSQL adapter for ProposalRepository.
 * Implements the domain-owned ProposalRepository port with Postgres persistence
 * on the `portfolio.proposals` table (migrations 20260924120000 + v1.003 schema isolation).
 */

import type { DatabasePort } from "@mosaix/ports-database";
import type { Proposal, ProposalAuditEntry, ProposalStatus } from "../domain/proposal.js";
import type { ProposalRepository } from "../domain/proposal-repository.js";

/** Canonical table since portfolio.catalog.v1.003 (schema isolation, no prefix). */
const PROPOSALS_TABLE = `"portfolio"."proposals"`;

const COLUMNS = [
  '"id"',
  '"spaceId"',
  '"tenant_id"',
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
  '"approvedTerms"',
  '"approvedOfferId"',
  '"idempotencyKey"',
  '"auditTrail"',
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

  async save(proposal: Proposal, tenantId: string): Promise<void> {
    const placeholders = Array.from({ length: 27 }, (_, i) => `$${i + 1}`).join(", ");
    await this.db.execute(
      `INSERT INTO ${PROPOSALS_TABLE} (${COLUMNS}) VALUES (${placeholders})`,
      this.toRow(proposal, tenantId),
    );
  }

  async update(proposal: Proposal, tenantId: string): Promise<void> {
    const values = this.toRow(proposal, tenantId);
    await this.db.execute(
      `UPDATE ${PROPOSALS_TABLE} SET
        "spaceId" = $2, "tenant_id" = $3, "proposerUserId" = $4, "suggestedReference" = $5, "type" = $6,
        "status" = $7, "content" = $8, "classification" = $9, "characteristics" = $10,
        "features" = $11, "variants" = $12, "media" = $13, "translations" = $14,
        "platformFeedback" = $15, "rejectionReason" = $16, "reviewedBy" = $17,
        "reviewStartedAt" = $18, "vendableId" = $19, "submittedAt" = $20,
        "reviewedAt" = $21, "createdAt" = $22, "updatedAt" = $23,
        "approvedTerms" = $24, "approvedOfferId" = $25, "idempotencyKey" = $26,
        "auditTrail" = $27
       WHERE "id" = $1 AND "tenant_id" = $3`,
      values,
    );
  }

  async updateWithVersionCheck(
    proposal: Proposal,
    versionField: { name: string; expectedValue: string },
    tenantId: string,
  ): Promise<boolean> {
    const values = this.toRow(proposal, tenantId);
    const versionCol = `"${versionField.name}"`;
    const res = await this.db.execute(
      `UPDATE ${PROPOSALS_TABLE} SET
        "spaceId" = $2, "tenant_id" = $3, "proposerUserId" = $4, "suggestedReference" = $5, "type" = $6,
        "status" = $7, "content" = $8, "classification" = $9, "characteristics" = $10,
        "features" = $11, "variants" = $12, "media" = $13, "translations" = $14,
        "platformFeedback" = $15, "rejectionReason" = $16, "reviewedBy" = $17,
        "reviewStartedAt" = $18, "vendableId" = $19, "submittedAt" = $20,
        "reviewedAt" = $21, "createdAt" = $22, "updatedAt" = $23,
        "approvedTerms" = $24, "approvedOfferId" = $25, "idempotencyKey" = $26,
        "auditTrail" = $27
       WHERE "id" = $1 AND "tenant_id" = $3 AND ${versionCol} = $28 RETURNING "id"`,
      [...values, versionField.expectedValue],
    );
    return res > 0;
  }

  async findById(id: string, tenantId: string): Promise<Proposal | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM ${PROPOSALS_TABLE} WHERE "id" = $1 AND "tenant_id" = $2`,
      [id, tenantId],
    );
    const row = rows[0];
    return row ? this.hydrate(row) : null;
  }

  async findBySpace(spaceId: string, tenantId: string): Promise<Proposal[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM ${PROPOSALS_TABLE} WHERE "spaceId" = $1 AND "tenant_id" = $2`,
      [spaceId, tenantId],
    );
    return rows.map((row) => this.hydrate(row));
  }

  async findByStatus(status: ProposalStatus, tenantId: string): Promise<Proposal[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM ${PROPOSALS_TABLE} WHERE "status" = $1 AND "tenant_id" = $2`,
      [status, tenantId],
    );
    return rows.map((row) => this.hydrate(row));
  }

  async listAll(tenantId: string): Promise<Proposal[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM ${PROPOSALS_TABLE} WHERE "tenant_id" = $1`,
      [tenantId],
    );
    return rows.map((row) => this.hydrate(row));
  }

  private toRow(proposal: Proposal, tenantId: string): unknown[] {
    return [
      proposal.id,
      proposal.spaceId,
      tenantId,
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
      JSON.stringify(proposal.approvedTerms ?? null),
      proposal.approvedOfferId ?? null,
      proposal.idempotencyKey ?? null,
      JSON.stringify(proposal.auditTrail ?? []),
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
      approvedTerms: asJson<Record<string, unknown> | null>(row.approvedTerms, null),
      approvedOfferId: asNullableString(row.approvedOfferId),
      idempotencyKey: asNullableString(row.idempotencyKey),
      auditTrail: asJson<ProposalAuditEntry[]>(row.auditTrail, []),
    };
  }
}
