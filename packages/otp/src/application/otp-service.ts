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

/**
 * OtpService – core application service for OTP lifecycle.
 * The implementation below is a minimal stub sufficient for compilation and tests.
 */
export class OtpService {
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

  // verifyOtp, resendOtp, invalidateOtp, getOtpStatus would be added later.
}
