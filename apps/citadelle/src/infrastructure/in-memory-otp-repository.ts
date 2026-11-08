/**
 * @apps/citadelle — In-Memory OtpRepositoryPort
 *
 * Temporary in-memory implementation of OtpRepositoryPort.
 * Production should use @mosaix/adapter-otp-database (PostgreSQL).
 * Kept in citadelle infrastructure to avoid creating new packages
 * (per DB-BAC-OWNERSHIP decision).
 */

import type {
  OtpRecord,
  OtpLookupKey,
  ConsumeResult,
  IncrementAttemptsResult,
  OtpRepositoryPort,
} from "@mosaix/otp";

export class InMemoryOtpRepository implements OtpRepositoryPort {
  private store = new Map<string, OtpRecord>();

  async save(record: OtpRecord): Promise<void> {
    this.store.set(record.id, { ...record });
  }

  async findById(id: string): Promise<OtpRecord | null> {
    return this.store.get(id) ?? null;
  }

  async invalidateActive(key: OtpLookupKey): Promise<number> {
    let affected = 0;
    const now = Date.now();
    for (const [id, record] of this.store.entries()) {
      if (
        record.tenantId === key.tenantId &&
        record.destination === key.destination &&
        record.purpose === key.purpose &&
        (key.userId ? record.userId === key.userId : true) &&
        !record.consumedAt &&
        record.expiresAt > now
      ) {
        this.store.set(id, { ...record, consumedAt: now });
        affected++;
      }
    }
    return affected;
  }

  async invalidateById(id: string): Promise<void> {
    const record = this.store.get(id);
    if (record) {
      this.store.set(id, { ...record, consumedAt: Date.now() });
    }
  }

  async consumeAtomically(
    id: string,
    expectedCodeHash: string,
    now: number,
  ): Promise<ConsumeResult> {
    const record = this.store.get(id);
    if (
      !record ||
      record.codeHash !== expectedCodeHash ||
      record.consumedAt !== undefined ||
      record.expiresAt <= now ||
      record.attempts >= record.maxAttempts
    ) {
      return { consumed: false, reason: "not_found" };
    }
    this.store.set(id, { ...record, consumedAt: now });
    return { consumed: true };
  }

  async incrementAttemptsAtomically(id: string, now: number): Promise<IncrementAttemptsResult> {
    const record = this.store.get(id);
    if (!record) {
      return { attempts: 0, expired: true, consumed: false, maxReached: true };
    }
    const updated = { ...record, attempts: record.attempts + 1 };
    this.store.set(id, updated);
    return {
      attempts: updated.attempts,
      expired: updated.expiresAt < now,
      consumed: updated.consumedAt !== undefined,
      maxReached: updated.attempts >= updated.maxAttempts,
    };
  }

  async deleteExpired(now: number): Promise<number> {
    let count = 0;
    for (const [id, record] of this.store.entries()) {
      if (record.expiresAt < now) {
        this.store.delete(id);
        count++;
      }
    }
    return count;
  }

  async runInTransaction<T>(fn: (repo: OtpRepositoryPort) => Promise<T>): Promise<T> {
    return fn(this);
  }
}
