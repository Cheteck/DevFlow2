/**
 * @apps/citadelle — MFA Domain Service
 *
 * Multi-Factor Authentication orchestration for Citadelle.
 * Builds on @mosaix/otp (OtpService + TOTP) and MosaiX ports (CryptoPort,
 * SecretsPort, ClockPort) without knowing concrete delivery adapters.
 *
 * Security invariants (per Martin Fowler / ChatGPT validation):
 * - MFA secret (TOTP base32) is encrypted at rest, never plain text
 * - TOTP is the primary factor; SMS/email are secondary
 * - TOTP is only enabled after validating the first code
 * - Recovery codes are stored as hashes, single-use
 * - Replay protection via used-time-step tracking (in OtpService)
 * - MFA enforcement is server-side (guards), never UI-only
 */

import type { User } from "./user.js";
import type { UserRepository } from "./user-service.js";
import type {
  TotpConfig,
  TotpProvisioningUri,
  TotpVerifyResult,
} from "@mosaix/otp";
import type { CryptoPort } from "@mosaix/ports-crypto";
import type { ClockPort } from "@mosaix/ports-clock";
import type { SecretsPort } from "@mosaix/ports-secrets";
import type { LoggingPort } from "@mosaix/ports-logging";
import { OtpService } from "@mosaix/otp";

/**
 * MFA factor types supported by Citadelle
 */
export type MfaFactor = "totp" | "sms" | "email";

/**
 * MFA enrollment state
 */
export type MfaEnrollmentStatus =
  | "not_enrolled"
  | "pending_verification"  // Secret generated, awaiting first code validation
  | "enabled";              // Fully enabled, required for login

/**
 * Recovery code entry (hashed, single-use)
 */
export interface RecoveryCode {
  id: string;
  /** SHA-256 hash of the plaintext code */
  codeHash: string;
  used: boolean;
  usedAt?: number;
  createdAt: number;
}

/**
 * MFA state attached to a user (extended via user.mfaSecret/mfaEnabled)
 */
export interface MfaState {
  userId: string;
  enabled: boolean;
  factors: MfaFactor[];
  /** Encrypted TOTP secret (base32, encrypted at rest) */
  encryptedTotpSecret?: string;
  /** IV for decryption */
  encryptionIv?: string;
  /** Auth tag for encrypted secret */
  encryptionTag?: Buffer;
  /** Recovery codes (hashed) */
  recoveryCodes: RecoveryCode[];
  enrolledAt?: number;
  lastVerifiedAt?: number;
}

/**
 * Error types for MFA operations
 */
export class MfaError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MfaError";
  }
}

/**
 * MFA Service — orchestrates TOTP enrollment, verification, and recovery codes.
 *
 * Depends on OtpService (@mosaix/otp) for TOTP code generation/verification
 * and CryptoPort for secret encryption at rest.
 */
export class MfaService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly otpService: OtpService,
    private readonly userRepository: UserRepository,
    private readonly crypto: CryptoPort,
    private readonly clock: ClockPort,
    private readonly secrets: SecretsPort,
    private readonly logger: LoggingPort,
    /** In-memory MFA state (production should persist via user.mfaSecret + recovery codes table) */
    private readonly mfaStates = new Map<string, MfaState>(),
    encryptionKey?: Buffer,
  ) {
    this.encryptionKey = encryptionKey ?? crypto.randomBytes(32);
  }

  // =========================================================================
  // TOTP Enrollment
  // =========================================================================

  /**
   * Start MFA enrollment: generate TOTP secret + provisioning URI.
   * Returns the QR code URI and encrypted secret (stored but not yet enabled).
   * User must verify the first code before MFA is enabled.
   */
  async enrollTotp(params: {
    userId: string;
    tenantId: string;
    accountName: string;
    issuer: string;
    config?: Partial<TotpConfig>;
  }): Promise<{
    provisioningUri: TotpProvisioningUri;
    secret: string; // base32 secret (returned once for QR display)
  }> {
    const user = await this.userRepository.findById(params.userId);
    if (!user) {
      throw new MfaError("USER_NOT_FOUND", "Utilisateur introuvable");
    }

    if (user.mfaEnabled) {
      throw new MfaError("MFA_ALREADY_ENABLED", "L'authentification multifactorielle est déjà activée");
    }

    // Generate TOTP secret via OtpService
    const enrollment = await this.otpService.generateTotpEnrollment({
      tenantId: params.tenantId,
      userId: params.userId,
      accountName: params.accountName,
      issuer: params.issuer,
      config: params.config,
    });

    // Encrypt the secret at rest (never store plain text)
    const encryptionResult = await this.crypto.encrypt(
      Buffer.from(enrollment.secret),
      this.encryptionKey,
    );

    // Extract provisioning URI from enrollment
    const provisioningUri = enrollment.provisioningUri || enrollment;

    // Store pending enrollment state (not yet enabled)
    const state: MfaState = {
      userId: params.userId,
      enabled: false,
      factors: ["totp"],
      encryptedTotpSecret: encryptionResult.ciphertext.toString("latin1"),
      encryptionIv: encryptionResult.iv.toString("latin1"),
      encryptionTag: encryptionResult.tag,
      recoveryCodes: [],
      enrolledAt: this.clock.now().getTime(),
    };
    this.mfaStates.set(params.userId, state);

    this.logger.info(`TOTP enrollment initiated for user ${params.userId}`, {
      tenantId: params.tenantId,
      userId: params.userId,
    });

    return {
      provisioningUri: enrollment.provisioningUri,
      secret: enrollment.secret, // Returned once for QR code display
    };
  }

  /**
   * Complete TOTP enrollment: verify the first code, then enable MFA.
   * Must be called after enrollTotp and after the user has scanned the QR code.
   */
  async completeTotpEnrollment(params: {
    userId: string;
    tenantId: string;
    code: string;
    secret: string; // base32 secret from enrollTotp
  }): Promise<{ recoveryCodes: string[] }> {
    const state = this.mfaStates.get(params.userId);
    if (!state || !state.enabled === false && !state.encryptedTotpSecret) {
      throw new MfaError("NO_PENDING_ENROLLMENT", "Aucune inscription TOTP en cours");
    }

    // Verify the first TOTP code
    const verifyResult = await this.otpService.verifyTotp({
      tenantId: params.tenantId,
      userId: params.userId,
      code: params.code,
      secret: params.secret,
    });

    if (!verifyResult.valid) {
      throw new MfaError(
        "TOTP_VERIFICATION_FAILED",
        `Code TOTP invalide: ${verifyResult.reason ?? "inconnu"}`,
      );
    }

    // Generate recovery codes (single-use, hashed)
    const recoveryCodes = this.generateRecoveryCodes();
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map((code) => this.hashRecoveryCode(code)),
    );

    // Update state: enable MFA, store recovery codes
    state.enabled = true;
    state.recoveryCodes = recoveryCodeHashes.map((hash, i) => ({
      id: `recovery_${i}`,
      codeHash: hash,
      used: false,
      createdAt: this.clock.now().getTime(),
    }));
    state.lastVerifiedAt = this.clock.now().getTime();
    this.mfaStates.set(params.userId, state);

    // Persist to user record
    const user = await this.userRepository.findById(params.userId);
    if (!user) {
      throw new MfaError("USER_NOT_FOUND", "Utilisateur introuvable");
    }
    user.mfaEnabled = true;
    // Store encrypted secret reference (the actual encrypted bytes are in state)
    // The mfaSecret field on User is kept for backward compatibility but
    // the real encrypted secret is in MfaState.encryptedTotpSecret
    user.mfaSecret = state.encryptedTotpSecret; // encrypted value
    user.mfaEnabled = true;
    user.updatedAt = this.clock.now().toISOString();
    await this.userRepository.save(user);

    this.logger.info(`MFA enabled for user ${params.userId}`, {
      tenantId: params.tenantId,
      userId: params.userId,
      factors: state.factors,
    });

    return { recoveryCodes };
  }

  // =========================================================================
  // TOTP Verification (during login challenge)
  // =========================================================================

  /**
   * Verify a TOTP code during MFA challenge.
   * Returns true if valid, throws MfaError otherwise.
   * Used after password validation in the login flow.
   */
  async verifyTotpLogin(params: {
    userId: string;
    tenantId: string;
    code: string;
  }): Promise<void> {
    const state = this.mfaStates.get(params.userId);
    if (!state || !state.enabled) {
      throw new MfaError("MFA_NOT_ENABLED", "L'authentification multifactorielle n'est pas activée");
    }

    if (!state.encryptedTotpSecret) {
      throw new MfaError("MFA_NO_SECRET", "Aucun secret TOTP configuré");
    }

    // Decrypt the TOTP secret
    const secret = await this.decryptTotpSecret(state);

    // Verify via OtpService (with replay protection)
    const verifyResult = await this.otpService.verifyTotp({
      tenantId: params.tenantId,
      userId: params.userId,
      code: params.code,
      secret,
    });

    if (!verifyResult.valid) {
      throw new MfaError(
        "TOTP_INVALID",
        `Code TOTP invalide: ${verifyResult.reason ?? "inconnu"}`,
      );
    }

    state.lastVerifiedAt = this.clock.now().getTime();
    this.mfaStates.set(params.userId, state);

    this.logger.info(`TOTP login verified for user ${params.userId}`, {
      tenantId: params.tenantId,
      userId: params.userId,
    });
  }

  // =========================================================================
  // Recovery Codes
  // =========================================================================

  /**
   * Verify and consume a recovery code.
   * Used when the user cannot access their TOTP device.
   * Recovery codes are single-use: consumed on successful verification.
   */
  async verifyRecoveryCode(params: {
    userId: string;
    tenantId: string;
    code: string;
  }): Promise<void> {
    const state = this.mfaStates.get(params.userId);
    if (!state || !state.enabled) {
      throw new MfaError("MFA_NOT_ENABLED", "L'authentification multifactorielle n'est pas activée");
    }

    // Find an unused recovery code matching the hash
    const codeHash = await this.hashRecoveryCode(params.code);
    const matchingCode = state.recoveryCodes.find(
      (rc) => !rc.used && rc.codeHash === codeHash,
    );

    if (!matchingCode) {
      throw new MfaError("RECOVERY_CODE_INVALID", "Code de récupération invalide ou déjà utilisé");
    }

    // Mark as used (single-use)
    matchingCode.used = true;
    matchingCode.usedAt = this.clock.now().getTime();
    state.lastVerifiedAt = this.clock.now().getTime();
    this.mfaStates.set(params.userId, state);

    this.logger.info(`Recovery code used for user ${params.userId}`, {
      tenantId: params.tenantId,
      userId: params.userId,
      recoveryCodeId: matchingCode.id,
    });
  }

  /**
   * Regenerate recovery codes (invalidates all previous ones).
   * Requires TOTP verification first (security: only the account owner can do this).
   */
  async regenerateRecoveryCodes(params: {
    userId: string;
    tenantId: string;
    totpCode: string;
  }): Promise<{ recoveryCodes: string[] }> {
    // First verify TOTP (security: only account owner can regenerate)
    await this.verifyTotpLogin({
      userId: params.userId,
      tenantId: params.tenantId,
      code: params.totpCode,
    });

    const state = this.mfaStates.get(params.userId);
    if (!state) {
      throw new MfaError("MFA_NOT_ENABLED", "MFA non configuré");
    }

    // Invalidate all existing recovery codes
    state.recoveryCodes = state.recoveryCodes.map((rc) => ({
      ...rc,
      used: true,
      usedAt: this.clock.now().getTime(),
    }));

    // Generate new ones
    const recoveryCodes = this.generateRecoveryCodes();
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map((code) => this.hashRecoveryCode(code)),
    );
    state.recoveryCodes = recoveryCodeHashes.map((hash, i) => ({
      id: `recovery_${i}`,
      codeHash: hash,
      used: false,
      createdAt: this.clock.now().getTime(),
    }));
    this.mfaStates.set(params.userId, state);

    return { recoveryCodes };
  }

  // =========================================================================
  // MFA Status & Disable
  // =========================================================================

  /** Get MFA state for a user */
  async getMfaState(userId: string): Promise<MfaState | null> {
    return this.mfaStates.get(userId) ?? null;
  }

  /** Check if MFA is enabled for a user */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const state = this.mfaStates.get(userId);
    return state?.enabled ?? false;
  }

  /**
   * Disable MFA for a user.
   * Requires TOTP verification (security: only account owner can disable).
   * Removes all recovery codes and clears the encrypted secret.
   */
  async disableMfa(params: {
    userId: string;
    tenantId: string;
    totpCode: string;
  }): Promise<void> {
    // Verify TOTP first
    await this.verifyTotpLogin({
      userId: params.userId,
      tenantId: params.tenantId,
      code: params.totpCode,
    });

    const state = this.mfaStates.get(params.userId);
    if (!state) {
      throw new MfaError("MFA_NOT_ENABLED", "MFA non configuré");
    }

    // Clear MFA state
    state.enabled = false;
    state.encryptedTotpSecret = undefined;
    state.encryptionIv = undefined;
    state.encryptionTag = undefined;
    state.recoveryCodes = [];
    state.lastVerifiedAt = undefined;
    this.mfaStates.set(params.userId, state);

    // Persist to user record
    const user = await this.userRepository.findById(params.userId);
    if (!user) {
      throw new MfaError("USER_NOT_FOUND", "Utilisateur introuvable");
    }
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.updatedAt = this.clock.now().toISOString();
    await this.userRepository.save(user);

    this.logger.info(`MFA disabled for user ${params.userId}`, {
      tenantId: params.tenantId,
      userId: params.userId,
    });
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /** Decrypt the stored TOTP secret */
  private async decryptTotpSecret(state: MfaState): Promise<string> {
    if (!state.encryptedTotpSecret || !state.encryptionIv || !state.encryptionTag) {
      throw new MfaError("MFA_NO_SECRET", "Secret TOTP non configuré");
    }

    const decrypted = await this.crypto.decrypt(
      Buffer.from(state.encryptedTotpSecret, "latin1"),
      this.encryptionKey,
      Buffer.from(state.encryptionIv, "latin1"),
      state.encryptionTag,
    );

    return decrypted.toString("utf8");
  }

  /** Generate 8 single-use recovery codes */
  private generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      // 8-character alphanumeric code (uppercase, no ambiguous chars)
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let j = 0; j < 8; j++) {
        const randomIndex = this.crypto.randomBytes(1)[0] % chars.length;
        code += chars[randomIndex];
      }
      codes.push(code);
    }
    return codes;
  }

  /** Hash a recovery code for storage (SHA-256 via CryptoPort) */
  private async hashRecoveryCode(code: string): Promise<string> {
    return this.crypto.hash(code, "sha256");
  }
}
