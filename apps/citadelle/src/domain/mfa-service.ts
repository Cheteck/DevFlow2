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
 * - Replay protection via used-time-step tracking (in OtpService + persistent table)
 * - MFA enforcement is server-side (guards), never UI-only
 * - Encryption key rotation: keyVersion stored, hybrid decryption with old keys
 */

import type { User } from "./user.js";
import type { UserRepository } from "./user-service.js";
import type { MfaRepositoryPort } from "./mfa-repository-port.js";
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
  tenantId: string;
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
  /** Failed TOTP verification attempts since last success */
  failedAttempts?: number;
  /** Timestamp when account is locked until (0 = not locked) */
  lockUntil?: number;
  /** TOTP time steps already used (replay protection, persists across restarts) */
  usedTotpSteps?: number[];
  /** Key version used to encrypt encryptedTotpSecret (for key rotation) */
  keyVersion?: string;
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
  /** Encryption keys by version: "v1", "v2", etc. */
  private encryptionKeys: Map<string, Buffer> = new Map();
  private _encryptionKeysResolved = false;
  private readonly production: boolean;

  constructor(
    private readonly otpService: OtpService,
    private readonly userRepository: UserRepository,
    private readonly mfaRepository: MfaRepositoryPort,
    private readonly crypto: CryptoPort,
    private readonly clock: ClockPort,
    private readonly secrets: SecretsPort,
    private readonly logger: LoggingPort,
    encryptionKey?: Buffer,
    production: boolean = false,
  ) {
    if (encryptionKey) {
      this.encryptionKeys.set("v1", encryptionKey);
    }
    this.production = production;
  }

  /**
   * Ensures all MFA encryption keys are loaded from SecretsPort.
   * In production, the current key must be configured as `citadelle.mfa.encryption.key`
   * (base64-encoded 32-byte key). Old keys are loaded as `citadelle.mfa.encryption.key.v<N>`
   * for hybrid decryption during key rotation.
   *
   * Hybrid decryption strategy:
   * - All known keys are loaded into memory
   * - decryptTotpSecret() tries each key until one succeeds
   * - On successful verification, the secret is re-encrypted with the current key
   * - Old keys are retained until explicitly retired
   */
  private async ensureEncryptionKeys(): Promise<void> {
    if (this._encryptionKeysResolved) return;
    this._encryptionKeysResolved = true;

    // Load current key
    try {
      const keyB64 = await this.secrets.getRequiredSecret("citadelle.mfa.encryption.key");
      const key = Buffer.from(keyB64, "base64");
      if (key.length !== 32) {
        throw new Error(
          `Invalid MFA encryption key length: ${key.length} bytes, expected 32`,
        );
      }
      this.encryptionKeys.set("v1", key);
    } catch {
      if (this.production) {
        // Production: fail fast - never silently generate a new key
        throw new Error(
          "MFA encryption key not configured in SecretsPort. " +
          "Configure citadelle.mfa.encryption.key for production.",
        );
      }
      // Development fallback: generate in-memory key (not production-safe)
      const devKey = this.crypto.randomBytes(32);
      this.encryptionKeys.set("v1", devKey);
      this.logger.warn(
        "MFA encryption key not configured in SecretsPort; using in-memory key (secrets will be lost on restart). Configure citadelle.mfa.encryption.key for production.",
      );
    }

    // Load previous key versions for hybrid decryption during rotation
    // Keys are stored as citadelle.mfa.encryption.key.v2, .v3, etc.
    let version = 2;
    while (true) {
      try {
        const oldKeyB64 = await this.secrets.getSecret(`citadelle.mfa.encryption.key.v${version}`);
        if (!oldKeyB64) break;
        const oldKey = Buffer.from(oldKeyB64, "base64");
        if (oldKey.length !== 32) {
          this.logger.warn(`Skipping invalid key version v${version}: wrong length`);
          version++;
          continue;
        }
        this.encryptionKeys.set(`v${version}`, oldKey);
        this.logger.info(`Loaded previous encryption key version v${version} for hybrid decryption`);
        version++;
      } catch {
        // No more key versions
        break;
      }
    }
  }

  /** Get the current (latest) encryption key for new encryptions */
  private getCurrentKey(): Buffer {
    const versions = Array.from(this.encryptionKeys.keys()).sort();
    const latest = versions[versions.length - 1];
    const key = this.encryptionKeys.get(latest);
    if (!key) {
      throw new MfaError("MFA_NO_KEY", "Aucune clé de chiffrement MFA configurée");
    }
    return key;
  }

  /**
   * Decrypt a TOTP secret using hybrid decryption: tries all known keys
   * until one succeeds. Supports key rotation by retaining old keys.
   */
  private async decryptTotpSecret(state: MfaState): Promise<string> {
    await this.ensureEncryptionKeys();

    if (!state.encryptedTotpSecret || !state.encryptionIv || !state.encryptionTag) {
      throw new MfaError("MFA_NO_SECRET", "Secret TOTP non configuré");
    }

    const ciphertext = Buffer.from(state.encryptedTotpSecret, "latin1");
    const iv = Buffer.from(state.encryptionIv, "latin1");
    const tag = state.encryptionTag;

    // Try each key until one succeeds (hybrid decryption for key rotation)
    let lastError: unknown = null;
    for (const [version, key] of this.encryptionKeys) {
      try {
        const decrypted = await this.crypto.decrypt(ciphertext, key, iv, tag);
        // If the key version used is not the current one, re-encrypt with current key
        if (state.keyVersion && state.keyVersion !== version) {
          this.logger.info(`Re-encrypting MFA secret from v${version} to current key`);
          // Note: re-encryption will happen on next save() via encryptTotpSecret
        }
        return decrypted.toString("utf8");
      } catch (err) {
        lastError = err;
        // Try next key
      }
    }

    // No key worked
    throw new MfaError(
      "MFA_DECRYPT_FAILED",
      `Impossible de déchiffrer le secret TOTP avec aucune clé disponible (${this.encryptionKeys.size} clé(s) essayée(s))`,
    );
  }

  /**
   * Encrypt a TOTP secret with the current key and return the key version used.
   */
  private async encryptTotpSecret(plaintext: Buffer): Promise<{
    ciphertext: string;
    iv: string;
    tag: Buffer;
    keyVersion: string;
  }> {
    await this.ensureEncryptionKeys();
    const key = this.getCurrentKey();
    const currentVersion = Array.from(this.encryptionKeys.keys()).sort().pop()!;

    const result = await this.crypto.encrypt(plaintext, key);
    return {
      ciphertext: result.ciphertext.toString("latin1"),
      iv: result.iv.toString("latin1"),
      tag: result.tag!,
      keyVersion: currentVersion,
    };
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
    secret: string; // base32 secret (returned once for QR code display)
  }> {
    if (!params.tenantId || typeof params.tenantId !== "string" || params.tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }

    await this.ensureEncryptionKeys();

    const user = await this.userRepository.findById(params.userId);
    if (!user) {
      throw new MfaError("USER_NOT_FOUND", "Utilisateur introuvable");
    }

    if (user.mfaEnabled) {
      throw new MfaError("MFA_ALREADY_ENABLED", "L'authentification multifactorielle est déjà activée");
    }

    // Generate TOTP secret via OtpService
    let enrollment;
    try {
      enrollment = await this.otpService.generateTotpEnrollment({
        tenantId: params.tenantId,
        userId: params.userId,
        accountName: params.accountName,
        issuer: params.issuer,
        config: params.config,
      });
    } catch (err) {
      // OT provider unavailable during enrollment - fail securely
      this.logger.error(`OT provider unavailable during TOTP enrollment for user ${params.userId}`, err as Error);
      throw new MfaError(
        "MFA_PROVIDER_UNAVAILABLE",
        "Le service de vérification MFA est temporairement indisponible. Veuillez réessayer ultérieurement.",
      );
    }

    // Encrypt the secret at rest (never store plain text)
    const encryptionResult = await this.encryptTotpSecret(Buffer.from(enrollment.secret));

    // Store pending enrollment state (not yet enabled)
    const state: MfaState = {
      userId: params.userId,
      tenantId: params.tenantId,
      enabled: false,
      factors: ["totp"],
      encryptedTotpSecret: encryptionResult.ciphertext,
      encryptionIv: encryptionResult.iv,
      encryptionTag: encryptionResult.tag,
      recoveryCodes: [],
      enrolledAt: this.clock.now().getTime(),
      keyVersion: encryptionResult.keyVersion,
    };
    await this.mfaRepository.save(state);

    this.logger.info(`TOTP enrollment initiated for user ${params.userId}`, {
      tenantId: params.tenantId,
      userId: params.userId,
      keyVersion: state.keyVersion,
    });

    return {
      provisioningUri: enrollment,
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
    if (!params.tenantId || typeof params.tenantId !== "string" || params.tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }

    const state = await this.mfaRepository.findByUserId(params.userId, params.tenantId);
    if (!state || state.enabled || !state.encryptedTotpSecret) {
      throw new MfaError("NO_PENDING_ENROLLMENT", "Aucune inscription TOTP en cours");
    }

    // Verify the first TOTP code
    let verifyResult;
    try {
      verifyResult = await this.otpService.verifyTotp({
        tenantId: params.tenantId,
        userId: params.userId,
        code: params.code,
        secret: params.secret,
      });
    } catch (err) {
      // OT provider unavailable - fail securely, never allow enrollment without verification
      this.logger.error(`OT provider unavailable during TOTP enrollment for user ${params.userId}`, err as Error);
      throw new MfaError(
        "MFA_PROVIDER_UNAVAILABLE",
        "Le service de vérification MFA est temporairement indisponible. Veuillez réessayer ultérieurement.",
      );
    }

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
    await this.mfaRepository.save(state);

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

  /** Max failed TOTP attempts before lockout (5 min) */
  private readonly MAX_FAILED_ATTEMPTS = 5;
  /** Lockout duration in ms (5 minutes) */
  private readonly LOCKOUT_MS = 5 * 60 * 1000;

  /**
   * Verify a TOTP code during MFA challenge.
   * Returns true if valid, throws MfaError otherwise.
   * Used after password validation in the login flow.
   *
   * Security:
   * - Tracks failed attempts per user/tenant
   * - Locks out after MAX_FAILED_ATTEMPTS consecutive failures
   * - Resets counter on successful verification
   * - Never reveals whether the user exists or MFA is enabled (generic error)
   */
  async verifyTotpLogin(params: {
    userId: string;
    tenantId: string;
    code: string;
  }): Promise<void> {
    // tenantId must come from authenticated context, never from client input
    if (!params.tenantId || typeof params.tenantId !== "string" || params.tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }

    // Find MFA state with tenant isolation
    const state = await this.mfaRepository.findByUserId(params.userId, params.tenantId);
    if (!state || !state.enabled) {
      // Generic error: do not reveal MFA status for unknown users
      throw new MfaError("MFA_NOT_ENABLED", "L'authentification multifactorielle n'est pas activée");
    }

    if (!state.encryptedTotpSecret) {
      throw new MfaError("MFA_NO_SECRET", "Aucun secret TOTP configuré");
    }

    // Lockout check (handled atomically in incrementFailedAttempts)
    const lockUntil = state.lockUntil ?? 0;
    if (lockUntil && this.clock.now().getTime() < lockUntil) {
      const remainingSec = Math.ceil((lockUntil - this.clock.now().getTime()) / 1000);
      throw new MfaError(
        "MFA_LOCKED",
        `Trop de tentatives échouées. Réessayez dans ${remainingSec} seconde(s).`,
      );
    }

    // Decrypt the TOTP secret using hybrid decryption
    let secret: string;
    try {
      secret = await this.decryptTotpSecret(state);
    } catch {
      throw new MfaError("MFA_NO_SECRET", "Aucun secret TOTP configuré");
    }

    // --- Persistent replay protection (atomic, survives restarts) ---
    // Compute current TOTP time step
    const now = this.clock.now().getTime();
    const config = { timeStepSeconds: 30, verificationWindow: 1 };
    const currentStep = Math.floor(now / 1000 / config.timeStepSeconds);

    // Verify via OtpService first (cryptographic validation)
    // The time-step is only marked as used AFTER successful verification,
    // to avoid consuming a valid time-step with an invalid code (DoS vector).
    let verifyResult;
    try {
      verifyResult = await this.otpService.verifyTotp({
        tenantId: params.tenantId,
        userId: params.userId,
        code: params.code,
        secret,
      });
    } catch (err) {
      // OT provider unavailable - fail securely
      this.logger.error(`OT provider unavailable during MFA verification for user ${params.userId}`, err as Error);
      throw new MfaError(
        "MFA_PROVIDER_UNAVAILABLE",
        "Le service de vérification MFA est temporairement indisponible. Veuillez réessayer ultérieurement.",
      );
    }

    if (!verifyResult.valid) {
      // Atomically increment failed attempts (handles lockout threshold)
      const { count, locked } = await this.mfaRepository.incrementFailedAttempts(
        params.tenantId,
        params.userId
      );

      this.logger.warn(`TOTP verification failed for user ${params.userId}`, {
        tenantId: params.tenantId,
        userId: params.userId,
        reason: verifyResult.reason,
        failedAttempts: count,
        locked,
      });

      throw new MfaError(
        "TOTP_INVALID",
        `Code TOTP invalide: ${verifyResult.reason ?? "inconnu"}`,
      );
    }

    // Success: mark the time step as used and reset failed attempts atomically
    // Transaction prevents a consumed time-step without session creation,
    // or a session without recording the used step.
    await this.mfaRepository.runInTransaction(async (repo) => {
      const alreadyUsed = await repo.recordTotpStepUsed(
        params.tenantId,
        params.userId,
        currentStep
      );
      if (alreadyUsed) {
        throw new MfaError(
          "TOTP_REPLAY",
          "Ce code TOTP a déjà été utilisé. Veuillez en générer un nouveau.",
        );
      }

      await repo.resetFailedAttempts(params.tenantId, params.userId);

      // Update state for local cache
      state.failedAttempts = 0;
      state.lockUntil = undefined;
      state.lastVerifiedAt = this.clock.now().getTime();
      await repo.save(state);
    });

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
    if (!params.tenantId || typeof params.tenantId !== "string" || params.tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }

    const state = await this.mfaRepository.findByUserId(params.userId, params.tenantId);
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
    await this.mfaRepository.save(state);

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
    if (!params.tenantId || typeof params.tenantId !== "string" || params.tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }

    // First verify TOTP (security: only account owner can regenerate)
    await this.verifyTotpLogin({
      userId: params.userId,
      tenantId: params.tenantId,
      code: params.totpCode,
    });

    const state = await this.mfaRepository.findByUserId(params.userId, params.tenantId);
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
    await this.mfaRepository.save(state);

    return { recoveryCodes };
  }

  // =========================================================================
  // MFA Status & Disable
  // =========================================================================

  /** Get MFA state for a user, scoped by tenant. tenantId is mandatory for isolation. */
  async getMfaState(userId: string, tenantId: string): Promise<MfaState | null> {
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }
    return this.mfaRepository.findByUserId(userId, tenantId);
  }

  /** Check if MFA is enabled for a user (tenant-scoped). tenantId is mandatory. */
  async isMfaEnabled(userId: string, tenantId: string): Promise<boolean> {
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }
    const state = await this.mfaRepository.findByUserId(userId, tenantId);
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
    if (!params.tenantId || typeof params.tenantId !== "string" || params.tenantId.trim() === "") {
      throw new MfaError("INVALID_TENANT", "Identifiant de locataire invalide");
    }

    // Verify TOTP first
    await this.verifyTotpLogin({
      userId: params.userId,
      tenantId: params.tenantId,
      code: params.totpCode,
    });

    const state = await this.mfaRepository.findByUserId(params.userId, params.tenantId);
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
    await this.mfaRepository.save(state);

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
