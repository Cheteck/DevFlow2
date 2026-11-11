import type { OtpRecord } from "../domain/otp-record.js";

export interface OtpLookupKey {
  readonly tenantId: string;
  readonly destination: string;
  readonly purpose: OtpRecord["purpose"];
  readonly userId?: string;
}

export interface ConsumeResult {
  readonly consumed: boolean;
  readonly reason?: "not_found" | "already_consumed" | "expired" | "max_attempts_reached";
}

export interface IncrementAttemptsResult {
  readonly attempts: number;
  readonly expired: boolean;
  readonly consumed: boolean;
  readonly maxReached: boolean;
}

/**
 * OtpRepositoryPort — Persistance des OTP avec consommation atomique.
 *
 * L'implémentation doit garantir que `consumeAtomically` et
 * `incrementAttemptsAtomically` sont des opérations transactionnelles
 * (une seule concurrence gagne).
 */
export interface OtpRepositoryPort {
  save(record: OtpRecord): Promise<void>;
  findById(id: string): Promise<OtpRecord | null>;
  /** Invalide tous les OTP actifs pour la même clé (transaction d'invalidation). */
  invalidateActive(key: OtpLookupKey): Promise<number>;
  /** Invalidate a specific OTP by its identifier atomically. */
  invalidateById(id: string): Promise<void>;
  /** Run arbitrary operations within a single DB transaction. */
  runInTransaction<T>(fn: (repo: OtpRepositoryPort) => Promise<T>): Promise<T>;
  /**
   * Consume un OTP de façon atomique : UPDATE ... WHERE id = ? AND code_hash = ?
   * AND consumed_at IS NULL AND expires_at > ? AND attempts < ?.
   */
  consumeAtomically(
    id: string,
    expectedCodeHash: string,
    now: number,
  ): Promise<ConsumeResult>;
  /** Incrémente les tentatives de façon atomique, conditionné par expiration/consommation. */
  incrementAttemptsAtomically(id: string, now: number): Promise<IncrementAttemptsResult>;
  deleteExpired(now: number): Promise<number>;
}