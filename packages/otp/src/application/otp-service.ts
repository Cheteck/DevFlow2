import { DEFAULT_OTP_POLICY, type OtpPolicy } from "../domain/otp-policy.js";
import type { OtpRecord } from "../domain/otp-record.js";
import type { OtpChannel } from "../domain/otp-channel.js";
import type { OtpPurpose } from "../domain/otp-purpose.js";
import type { OtpLookupKey } from "../ports/otp-repository-port.js";
import type { OtpRepositoryPort } from "../ports/otp-repository-port.js";
import type { OtpDeliveryPort, OtpDeliveryCommand } from "../ports/otp-delivery-port.js";
import type { OtpRateLimiterPort } from "../ports/otp-rate-limiter-port.js";
import type { CryptoPort } from "@mosaix/ports-crypto";
import type { ClockPort } from "@mosaix/ports-clock";
import type { IdGeneratorPort } from "@mosaix/ports-id";
import type { SecretsPort } from "@mosaix/ports-secrets";
import type { LoggingPort } from "@mosaix/ports-logging";
import type { ConfigPort } from "@mosaix/ports-config";
import type {
  TotpConfig,
  TotpCodeResult,
  TotpProvisioningUri,
  TotpVerifyResult,
} from "../domain/totp.js";
import {
  DEFAULT_TOTP_CONFIG,
  base32Decode,
  generateProvisioningUri,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from "../domain/totp.js";

/**
 * OtpService – core application service for OTP lifecycle.
 * The implementation below is a minimal stub sufficient for compilation and tests.
 */
export class OtpService {
  /**
   * Used TOTP steps per (tenantId, userId) for replay protection.
   * In-memory for initial implementation; production should use cache/database.
   * Key: `${tenantId}:${userId}` → Set of used time steps.
   */
  private readonly usedTotpSteps = new Map<string, Set<number>>();

  constructor(
    private readonly repository: OtpRepositoryPort,
    private readonly delivery: OtpDeliveryPort,
    private readonly rateLimiter: OtpRateLimiterPort,
    private readonly crypto: CryptoPort,
    private readonly clock: ClockPort,
    private readonly idGen: IdGeneratorPort,
    private readonly secrets: SecretsPort,
    private readonly logger: LoggingPort,
    private readonly config: ConfigPort,
    private readonly policy: OtpPolicy = DEFAULT_OTP_POLICY,
  ) {}

  /** Generate a cryptographically secure numeric code using rejection sampling to avoid modulo bias */
  private generateSecureCode(length: number): string {
    if (length <= 0) return "";
    const max = 10 ** length;
    // 6 bytes = 48 bits, max 2^48 = 281,474,976,710,656
    // Largest multiple of 1,000,000 under 2^48 is 281,474,976,000,000
    const limit = Math.floor((256 ** 6) / max) * max;
    while (true) {
      const buf = this.crypto.randomBytes(6);
      const num = buf.readUIntBE(0, 6);
      if (num < limit) {
        return String(num % max).padStart(length, "0");
      }
    }
  }

  /** Request a new OTP */
  async requestOtp(params: {
    tenantId: string;
    destination: string;
    channel: OtpChannel;
    purpose: OtpPurpose;
    userId?: string;
  }): Promise<OtpRecord> {
    const scope = `${params.tenantId}:${params.destination}:${params.purpose}`;

    // 1️⃣ Reserve an atomic quota slot before any DB work
    const reserved = await this.rateLimiter.reserveSlot(scope);
    if (!reserved) {
      this.logger.warn(`OTP request quota exhausted for scope ${scope}`);
      throw new Error("OTP_RATE_LIMIT_EXCEEDED");
    }

    const code = this.generateSecureCode(this.policy.codeLength);
    const otpId = this.idGen.generate();
    const now = this.clock.now().getTime();
    const expiresAt = now + this.policy.ttlSeconds * 1000;
    const secret = await this.secrets.getRequiredSecret("otp.hmac.key");
    const hmacInput = `${params.tenantId}|${otpId}|${params.destination}|${params.purpose}|${code}`;
    const codeHash = await this.crypto.hmac(hmacInput, secret);

    const record: OtpRecord = {
      id: otpId,
      tenantId: params.tenantId,
      destination: params.destination,
      channel: params.channel,
      purpose: params.purpose,
      userId: params.userId,
      codeHash,
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: this.policy.maxAttempts,
    };

    // 2️⃣ Perform DB transaction: invalidate previous OTPs and save the new one
    await this.repository.runInTransaction(async (repo) => {
      await repo.invalidateActive({
        tenantId: params.tenantId,
        destination: params.destination,
        purpose: params.purpose,
        userId: params.userId,
      });
      await repo.save(record);
    });

    // 3️⃣ Delivery outside of DB transaction – ensure we don't hold DB locks during network I/O
    try {
      const cmd: OtpDeliveryCommand = {
        destination: params.destination,
        channel: params.channel,
        message: `Your verification code is ${code}`,
      };
      await this.delivery.send(cmd);
    } catch (err) {
      // Delivery failed – rollback the OTP we just created and release the reserved quota slot
      await this.repository.invalidateById(record.id);
      await this.rateLimiter.releaseSlot(scope);
      this.logger.error(`OTP delivery failed for ${otpId}, record invalidated`, err as Error);
      throw new Error("OTP_DELIVERY_FAILED");
    }

    // 4️⃣ Success – the quota slot is already consumed, no further action needed
    return record;
  }

  /** Verify an OTP code atomically (consume-once, attempt tracking, replay protection) */
  async verifyOtp(params: {
    otpId: string;
    code: string;
    tenantId: string;
  }): Promise<{ valid: boolean; reason?: string }> {
    const now = this.clock.now().getTime();

    const record = await this.repository.findById(params.otpId);
    if (!record) {
      return { valid: false, reason: "OTP_NOT_FOUND" };
    }

    // Tenant isolation
    if (record.tenantId !== params.tenantId) {
      return { valid: false, reason: "OTP_TENANT_MISMATCH" };
    }

    // Already consumed
    if (record.consumedAt !== undefined) {
      return { valid: false, reason: "OTP_ALREADY_CONSUMED" };
    }

    // Expired
    if (record.expiresAt <= now) {
      return { valid: false, reason: "OTP_EXPIRED" };
    }

    // Max attempts reached
    if (record.attempts >= record.maxAttempts) {
      return { valid: false, reason: "OTP_MAX_ATTEMPTS_REACHED" };
    }

    // Recompute expected HMAC
    const secret = await this.secrets.getRequiredSecret("otp.hmac.key");
    const hmacInput = `${record.tenantId}|${record.id}|${record.destination}|${record.purpose}|${params.code}`;
    const expectedHash = await this.crypto.hmac(hmacInput, secret);

    // Constant-time comparison
    if (!this.crypto.timingSafeEqual(expectedHash, record.codeHash)) {
      // Increment attempts on failure
      const inc = await this.repository.incrementAttemptsAtomically(params.otpId, now);
      if (inc.maxReached) {
        return { valid: false, reason: "OTP_MAX_ATTEMPTS_REACHED" };
      }
      return { valid: false, reason: "OTP_INVALID_CODE" };
    }

    // Atomically consume the OTP
    const consumeResult = await this.repository.consumeAtomically(
      params.otpId,
      record.codeHash,
      now,
    );

    if (!consumeResult.consumed) {
      return { valid: false, reason: "OTP_CONSUMPTION_FAILED" };
    }

    this.logger.info(`OTP verified successfully for ${params.otpId}`, {
      tenantId: params.tenantId,
      purpose: record.purpose,
      channel: record.channel,
    });

    return { valid: true };
  }

  /** Resend an OTP (respects cooldown, invalidates previous) */
  async resendOtp(params: {
    otpId: string;
    tenantId: string;
  }): Promise<OtpRecord> {
    const record = await this.repository.findById(params.otpId);
    if (!record) {
      throw new Error("OTP_NOT_FOUND");
    }

    // Tenant isolation
    if (record.tenantId !== params.tenantId) {
      throw new Error("OTP_TENANT_MISMATCH");
    }

    const now = this.clock.now().getTime();
    const scope = `${record.tenantId}:${record.destination}:${record.purpose}`;

    // Cooldown check
    const canResend = await this.rateLimiter.canResend(scope);
    if (!canResend) {
      throw new Error("OTP_RESEND_COOLDOWN");
    }

    // Invalidate the old OTP
    await this.repository.invalidateById(record.id);

    // Generate a new code
    const code = this.generateSecureCode(this.policy.codeLength);
    const otpId = this.idGen.generate();
    const expiresAt = now + this.policy.ttlSeconds * 1000;
    const secret = await this.secrets.getRequiredSecret("otp.hmac.key");
    const hmacInput = `${record.tenantId}|${otpId}|${record.destination}|${record.purpose}|${code}`;
    const codeHash = await this.crypto.hmac(hmacInput, secret);

    const newRecord: OtpRecord = {
      id: otpId,
      tenantId: record.tenantId,
      destination: record.destination,
      channel: record.channel,
      purpose: record.purpose,
      userId: record.userId,
      codeHash,
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: this.policy.maxAttempts,
    };

    await this.repository.runInTransaction(async (repo) => {
      await repo.save(newRecord);
    });

    // Record the resend for cooldown tracking
    await this.rateLimiter.recordResend(scope);

    // Deliver outside of DB transaction
    try {
      const cmd: OtpDeliveryCommand = {
        destination: record.destination,
        channel: record.channel,
        message: `Your verification code is ${code}`,
      };
      await this.delivery.send(cmd);
    } catch (err) {
      await this.repository.invalidateById(newRecord.id);
      this.logger.error(`OTP resend delivery failed for ${otpId}`, err as Error);
      throw new Error("OTP_DELIVERY_FAILED");
    }

    this.logger.info(`OTP resent successfully for ${otpId}`, {
      tenantId: record.tenantId,
      purpose: record.purpose,
      channel: record.channel,
    });

    return newRecord;
  }

  /** Invalidate (revoke) an OTP manually */
  async invalidateOtp(params: {
    otpId: string;
    tenantId: string;
  }): Promise<void> {
    const record = await this.repository.findById(params.otpId);
    if (!record) {
      return; // Idempotent
    }

    // Tenant isolation
    if (record.tenantId !== params.tenantId) {
      throw new Error("OTP_TENANT_MISMATCH");
    }

    await this.repository.invalidateById(params.otpId);

    this.logger.info(`OTP invalidated for ${params.otpId}`, {
      tenantId: params.tenantId,
      purpose: record.purpose,
    });
  }

  // =========================================================================
  // TOTP (RFC 6238) methods
  // =========================================================================

  /** Generate a TOTP secret and provisioning URI for MFA enrollment */
  async generateTotpEnrollment(params: {
    tenantId: string;
    userId: string;
    accountName: string;
    issuer: string;
    config?: Partial<TotpConfig>;
  }): Promise<TotpProvisioningUri & { secret: string }> {
    const secret = generateTotpSecret(this.crypto.randomBytes.bind(this.crypto));

    const uri = generateProvisioningUri({
      secret,
      accountName: params.accountName,
      issuer: params.issuer,
      algorithm: params.config?.algorithm,
      digits: params.config?.codeLength,
      period: params.config?.timeStepSeconds,
    });

    this.logger.info(`TOTP enrollment secret generated for user ${params.userId}`, {
      tenantId: params.tenantId,
      userId: params.userId,
    });

    return { ...uri, secret };
  }

  /** Verify a TOTP code with replay protection and clock drift tolerance */
  async verifyTotp(params: {
    tenantId: string;
    userId: string;
    code: string;
    secret: string; // base32-encoded TOTP secret
    config?: Partial<TotpConfig>;
  }): Promise<TotpVerifyResult> {
    const now = this.clock.now().getTime();
    const stepKey = `${params.tenantId}:${params.userId}`;

    // Get or create the used steps set for this user
    let usedSteps = this.usedTotpSteps.get(stepKey);
    if (!usedSteps) {
      usedSteps = new Set();
      this.usedTotpSteps.set(stepKey, usedSteps);
    }

    // Clean up old steps (older than 2 time steps) to prevent unbounded growth
    const config = { ...DEFAULT_TOTP_CONFIG, ...params.config };
    const currentStep = Math.floor(now / 1000 / config.timeStepSeconds);
    for (const step of usedSteps) {
      if (step < currentStep - config.verificationWindow - 1) {
        usedSteps.delete(step);
      }
    }

    const result = await verifyTotpCode(
      {
        code: params.code,
        secret: params.secret,
        usedSteps,
        config,
      },
      (data, secret) => this.crypto.hmac(data, secret),
      () => now,
    );

    if (result.valid && result.matchedStep !== undefined) {
      // Mark this step as used (replay protection)
      usedSteps.add(result.matchedStep);
    }

    if (!result.valid) {
      this.logger.warn(`TOTP verification failed for user ${params.userId}`, {
        tenantId: params.tenantId,
        userId: params.userId,
        reason: result.reason,
      });
    }

    return result;
  }

  /** Mark a TOTP step as used (for replay protection after successful verification elsewhere) */
  markTotpStepUsed(params: {
    tenantId: string;
    userId: string;
    step: number;
  }): void {
    const stepKey = `${params.tenantId}:${params.userId}`;
    let usedSteps = this.usedTotpSteps.get(stepKey);
    if (!usedSteps) {
      usedSteps = new Set();
      this.usedTotpSteps.set(stepKey, usedSteps);
    }
    usedSteps.add(params.step);
  }

  /** Get remaining seconds until the current TOTP code expires */
  getTotpRemainingSeconds(config?: Partial<TotpConfig>): number {
    const cfg = { ...DEFAULT_TOTP_CONFIG, ...config };
    const now = this.clock.now().getTime();
    const currentStep = Math.floor(now / 1000 / cfg.timeStepSeconds);
    const expiresAt = (currentStep + 1) * cfg.timeStepSeconds * 1000;
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
  }
}
