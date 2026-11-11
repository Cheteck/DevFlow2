/**
 * @mosaix/otp — Multi-channel OTP bounded context for MosaiX.
 *
 * Supports email, SMS, and WhatsApp delivery with cryptographic security
 * (HMAC-SHA256, constant-time comparison, atomic consumption, rate limiting).
 *
 * @mosaix/otp does NOT know:
 * - PostgreSQL / SQLite / Redis
 * - Twilio / SES / Meta Cloud / any particular carrier
 * - Express / Fastify / Next.js / React
 *
 * It only knows MosaiX ports.
 */

// Domain
export type { OtpPurpose } from "./domain/otp-purpose.js";
export type { OtpChannel } from "./domain/otp-channel.js";
export type { OtpRecord } from "./domain/otp-record.js";
export type { OtpPolicy } from "./domain/otp-policy.js";
export { DEFAULT_OTP_POLICY } from "./domain/otp-policy.js";
// TOTP (RFC 6238)
export type { TotpConfig, TotpCodeResult, TotpProvisioningUri, TotpVerifyResult } from "./domain/totp.js";
export { DEFAULT_TOTP_CONFIG, generateTotpSecret, base32Encode, base32Decode, generateTotpCode, verifyTotpCode, generateProvisioningUri } from "./domain/totp.js";

// Ports
export type {
  OtpLookupKey,
  ConsumeResult,
  IncrementAttemptsResult,
  OtpRepositoryPort,
} from "./ports/otp-repository-port.js";
export type {
  OtpDeliveryPort,
  OtpDeliveryCommand,
  OtpDeliveryResult,
} from "./ports/otp-delivery-port.js";
export type { OtpRateLimiterPort } from "./ports/otp-rate-limiter-port.js";

// Application
export { OtpService } from "./application/otp-service.js";