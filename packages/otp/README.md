# @mosaix/otp

Multi-channel OTP system for the MosaiX platform. Supports email, SMS, and WhatsApp delivery with cryptographic security (HMAC-SHA256, constant-time comparison, atomic consumption).

## Architecture

Hexagonal / ports-and-adapters:

```
@mosaix/otp
  domain/          OtpPurpose, OtpChannel, OtpRecord, OtpPolicy
  ports/           OtpRepositoryPort, OtpDeliveryPort, OtpRateLimiterPort
  application/     OtpService (requestOtp, verifyOtp, resendOtp, invalidateOtp, getOtpStatus)
  adapters/        Database adapter, delivery dispatcher, cache-based rate limiter
```

## Exports

```typescript
export type { OtpPurpose } from "./domain/otp-purpose.js";
export type { OtpChannel } from "./domain/otp-channel.js";
export type { OtpRecord } from "./domain/otp-record.js";
export type { OtpPolicy, DEFAULT_OTP_POLICY } from "./domain/otp-policy.js";

export type {
  OtpLookupKey,
  OtpRepositoryPort,
} from "./ports/otp-repository-port.js";

export type {
  OtpDeliveryPort,
  OtpDeliveryCommand,
} from "./ports/otp-delivery-port.js";

export type { OtpRateLimiterPort } from "./ports/otp-rate-limiter-port.js";
```

## Usage

```typescript
import { OtpService } from "@mosaix/otp";

// Wiring (composition root) — ports injected, no framework knowledge
const otpService = new OtpService(
  repository,   // OtpRepositoryPort (transactional, atomic consumption)
  delivery,     // OtpDeliveryPort (email / sms / whatsapp dispatcher)
  rateLimiter,  // OtpRateLimiterPort (cache-backed counters)
  crypto,       // CryptoPort (HMAC + constant-time comparison)
  clock,        // ClockPort (testable time)
  idGen,        // IdGeneratorPort
  secrets,      // SecretsPort (HMAC key via secrets manager)
  logger,       // LoggingPort
  config,       // ConfigPort
);

// Request an OTP
const otp = await otpService.requestOtp({
  destination: "user@example.com",
  channel: "email",
  purpose: "login",
  tenantId: "tenant-1",
  userId: "user-42",
});

// Verify an OTP
const result = await otpService.verifyOtp({
  otpId: otp.id,
  code: "123456",
});
```

## Security

- Codes are never stored in plain text (HMAC-SHA256 hash keyed with a secret from `SecretsPort`).
- HMAC input is bound to `tenantId | otpId | destination | purpose | code` for cross-tenant/cross-purpose isolation.
- Verification uses constant-time comparison (`CryptoPort.timingSafeEqual`) to prevent timing attacks.
- Atomic consumption (`consumeAtomically`) prevents race conditions: only one concurrent verification can succeed.
- Rejection sampling over `crypto.randomBytes` avoids modulo bias in code generation.
- Rate limiting (per destination/purpose/hour + resend cooldown) protects against abuse.
- Codes never appear in logs.

## Status

- Phase 3 complete: domain models + ports compile cleanly.
- Phase 4 (adapters: database repository, delivery dispatcher, cache rate limiter) pending ChatGPT validation of the domain.