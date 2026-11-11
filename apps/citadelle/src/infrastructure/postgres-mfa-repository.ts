/**
 * @apps/citadelle — PostgreSQL MFA repository
 *
 * Implements MfaRepositoryPort using the DatabasePort abstraction.
 * MFA state is stored in public.mfa_secrets table.
 */

import { DatabasePort } from "@mosaix/ports-database";
import type { MfaRepositoryPort } from "../domain/mfa-repository-port.js";
import type { MfaState } from "../domain/mfa-service.js";
import type { RecoveryCode } from "../domain/mfa-service.js";

export class PostgresMfaRepository implements MfaRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async save(state: MfaState): Promise<void> {
    await this.db.execute(
      `INSERT INTO public.mfa_secrets (user_id, tenant_id, encrypted_secret, encryption_iv, encryption_tag, enabled, enrolled_at, last_verified_at, recovery_codes, failed_attempts, lock_until, key_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (user_id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         encrypted_secret = EXCLUDED.encrypted_secret,
         encryption_iv = EXCLUDED.encryption_iv,
         encryption_tag = EXCLUDED.encryption_tag,
         enabled = EXCLUDED.enabled,
         enrolled_at = EXCLUDED.enrolled_at,
         last_verified_at = EXCLUDED.last_verified_at,
         recovery_codes = EXCLUDED.recovery_codes,
         failed_attempts = EXCLUDED.failed_attempts,
         lock_until = EXCLUDED.lock_until,
         key_version = EXCLUDED.key_version`,
      [
        state.userId,
        state.tenantId,
        state.encryptedTotpSecret ?? "",
        state.encryptionIv ?? "",
        state.encryptionTag ? Buffer.from(state.encryptionTag).toString("base64") : "",
        state.enabled,
        state.enrolledAt ?? null,
        state.lastVerifiedAt ?? null,
        JSON.stringify(
          state.recoveryCodes.map((rc) => ({
            id: rc.id,
            codeHash: rc.codeHash,
            used: rc.used,
            usedAt: rc.usedAt,
            createdAt: rc.createdAt,
          }))
        ),
        state.failedAttempts ?? 0,
        state.lockUntil ?? null,
        state.keyVersion ?? "v1",
      ],
    );
  }

  async findByUserId(userId: string, tenantId?: string): Promise<MfaState | null> {
    if (tenantId) {
      const rows = await this.db.query(
        `SELECT * FROM public.mfa_secrets WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );
      if (rows.length === 0) return null;
      const row = rows[0] as Record<string, unknown>;
      return this.rowToMfaState(row);
    }

    const rows = await this.db.query(
      `SELECT * FROM public.mfa_secrets WHERE user_id = $1`,
      [userId]
    );
    if (rows.length === 0) return null;
    const row = rows[0] as Record<string, unknown>;
    return this.rowToMfaState(row);
  }

  private rowToMfaState(row: Record<string, unknown>): MfaState {
    return {
      userId: row.user_id as string,
      tenantId: row.tenant_id as string,
      enabled: row.enabled as boolean,
      factors: ["totp"],
      encryptedTotpSecret: row.encrypted_secret as string,
      encryptionIv: row.encryption_iv as string,
      encryptionTag: row.encryption_tag
        ? Buffer.from(row.encryption_tag as string, "base64")
        : undefined,
      recoveryCodes: (row.recovery_codes as unknown[]).map((rc: any) => ({
        id: rc.id,
        codeHash: rc.codeHash,
        used: rc.used,
        usedAt: rc.usedAt,
        createdAt: rc.createdAt,
      })),
      enrolledAt: row.enrolled_at ? new Date(row.enrolled_at as string).getTime() : undefined,
      lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at as string).getTime() : undefined,
      failedAttempts: row.failed_attempts as number,
      lockUntil: row.lock_until ? new Date(row.lock_until as string).getTime() : undefined,
      keyVersion: row.key_version as string,
    };
  }

  async delete(userId: string): Promise<void> {
    await this.db.execute(`DELETE FROM public.mfa_secrets WHERE user_id = $1`, [
      userId,
    ]);
    await this.db.execute(`DELETE FROM public.mfa_used_totp_steps WHERE user_id = $1`, [
      userId,
    ]);
  }

  async recordTotpStepUsed(tenantId: string, userId: string, step: number): Promise<boolean> {
    // Atomic INSERT ON CONFLICT DO NOTHING.
    // Returns true if the step was already used (0 rows inserted = replay).
    // Returns false and records the step if it was not used (1 row inserted).
    const result = await this.db.query(
      `INSERT INTO public.mfa_used_totp_steps (tenant_id, user_id, totp_step, used_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, user_id, totp_step) DO NOTHING
       RETURNING 1`,
      [tenantId, userId, step]
    );
    // If 0 rows returned, the step already existed (replay detected)
    return result.length === 0;
  }

  async incrementFailedAttempts(tenantId: string, userId: string): Promise<{ count: number; locked: boolean }> {
    // Atomic increment: only increment if not currently locked
    const result = await this.db.query(
      `UPDATE public.mfa_secrets
       SET failed_attempts = failed_attempts + 1,
           lock_until = CASE
             WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes'
             ELSE lock_until
           END
       WHERE user_id = $1 AND tenant_id = $2 AND (lock_until IS NULL OR lock_until < NOW())
       RETURNING failed_attempts, lock_until`,
      [userId, tenantId]
    );

    if (result.length === 0) {
      // Account is currently locked (lock_until >= NOW())
      const lockRow = await this.db.query(
        `SELECT lock_until FROM public.mfa_secrets WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );
      return { count: 0, locked: lockRow.length > 0 && lockRow[0].lock_until !== null };
    }

    const row = result[0] as Record<string, unknown>;
    const count = row.failed_attempts as number;
    const locked = row.lock_until !== null;
    return { count, locked };
  }

  async resetFailedAttempts(tenantId: string, userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE public.mfa_secrets
       SET failed_attempts = 0, lock_until = NULL
       WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );
  }

  async countByKeyVersion(keyVersion: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) FROM public.mfa_secrets WHERE key_version = $1`,
      [keyVersion]
    );
    return Number(result[0].count) || 0;
  }

  async runInTransaction<T>(fn: (repo: MfaRepositoryPort) => Promise<T>): Promise<T> {
    await this.db.execute(`BEGIN`);
    try {
      const result = await fn(this);
      await this.db.execute(`COMMIT`);
      return result;
    } catch (err) {
      await this.db.execute(`ROLLBACK`);
      throw err;
    }
  }
}
