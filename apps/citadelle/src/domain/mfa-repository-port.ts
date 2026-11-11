/**
 * @apps/citadelle — MfaRepositoryPort
 *
 * Persistence port for MFA state. Implementations store/retrieve
 * multi-factor authentication state keyed by userId.
 */

import type { MfaState } from "./mfa-service.js";

export interface MfaRepositoryPort {
  /** Save or update MFA state for a user. */
  save(state: MfaState): Promise<void>;

  /** Load MFA state for a user, scoped by tenant. tenantId is mandatory for isolation. */
  findByUserId(userId: string, tenantId: string): Promise<MfaState | null>;

  /** Delete MFA state for a user (e.g. when MFA is disabled). */
  delete(userId: string): Promise<void>;

  /** Atomically check if a TOTP time step has already been used.
   * Returns true if the step was already used (replay detected).
   * Returns false and records the step as used if it was not.
   */
  recordTotpStepUsed(tenantId: string, userId: string, step: number): Promise<boolean>;

  /** Atomically increment failed attempts and return new count.
   * Returns { count, locked } where locked is true if lockout threshold reached.
   */
  incrementFailedAttempts(tenantId: string, userId: string): Promise<{ count: number; locked: boolean }>;

  /** Atomically reset failed attempts and clear lockout on successful verification. */
  resetFailedAttempts(tenantId: string, userId: string): Promise<void>;

  /** Count MFA states by key version (for key rotation safety). */
  countByKeyVersion(keyVersion: string): Promise<number>;

  /** Execute multiple operations atomically within a database transaction. */
  runInTransaction<T>(fn: (repo: MfaRepositoryPort) => Promise<T>): Promise<T>;
}
