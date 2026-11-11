/**
 * @mosaix/otp — TOTP (Time-Based One-Time Password, RFC 6238)
 *
 * TOTP generates time-based codes from a shared secret, used by authenticator
 * apps (Google Authenticator, FreeOTP, etc.). Unlike delivery-based OTP
 * (SMS/email/whatsapp), TOTP codes are computed locally by both the server
 * and the client app using the same secret and the current time step.
 *
 * Security properties:
 * - Secret is never transmitted after enrollment (only during QR code setup)
 * - Codes expire every 30 seconds (configurable time step)
 * - Verification window tolerates small clock drift (±1 step by default)
 * - Replay protection: each code can only be used once within its time step
 */

import type { OtpChannel } from "./otp-channel.js";
import type { OtpPurpose } from "./otp-purpose.js";

/**
 * TOTP configuration (RFC 6238 defaults)
 */
export interface TotpConfig {
  /** Shared secret encoded in base32 (as displayed in QR code) */
  readonly secret?: string;
  /** Time step in seconds (default: 30) */
  readonly timeStepSeconds: number;
  /** Number of digits in the code (default: 6) */
  readonly codeLength: number;
  /** HMAC algorithm (default: SHA1 per RFC 6238) */
  readonly algorithm: "SHA1" | "SHA256" | "SHA512";
  /** Verification window: number of steps to look back/forward for clock drift (default: 1) */
  readonly verificationWindow: number;
}

/**
 * Default TOTP configuration (RFC 6238 compliant)
 */
export const DEFAULT_TOTP_CONFIG: TotpConfig = {
  timeStepSeconds: 30,
  codeLength: 6,
  algorithm: "SHA1",
  verificationWindow: 1,
};

/**
 * Result of TOTP code generation
 */
export interface TotpCodeResult {
  /** The 6-digit code */
  readonly code: string;
  /** Unix timestamp when this code expires */
  readonly expiresAt: number;
  /** Remaining seconds until this code expires */
  readonly remainingSeconds: number;
}

/**
 * Provisioning URI for QR code display (otpauth:// URI)
 * Used by authenticator apps to enroll the TOTP secret
 */
export interface TotpProvisioningUri {
  /** Full otpauth:// URI */
  readonly uri: string;
  /** Base32-encoded secret */
  readonly secret: string;
}

/**
 * Result of TOTP verification
 */
export interface TotpVerifyResult {
  /** Whether the code is valid */
  readonly valid: boolean;
  /** Reason for failure if invalid */
  readonly reason?: "INVALID_CODE" | "EXPIRED" | "REPLAY_DETECTED";
  /** The time step that matched (for audit) */
  readonly matchedStep?: number;
}

/**
 * Generate a random base32-encoded TOTP secret (160 bits / 20 bytes = 32 base32 chars)
 */
export function generateTotpSecret(cryptoRandomBytes: (len: number) => Buffer): string {
  const bytes = cryptoRandomBytes(20);
  return base32Encode(bytes);
}

/**
 * Encode a byte array to base32 (RFC 4648)
 */
export function base32Encode(bytes: Buffer): string {
  const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  // Pad to multiple of 8 characters (optional per RFC 4648)
  const remainder = output.length % 8;
  if (remainder > 0) {
    output += "=".repeat(8 - remainder);
  }

  return output;
}

/**
 * Decode a base32 string to bytes
 */
export function base32Decode(encoded: string): Buffer {
  const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of encoded) {
    if (char === "=") continue;
    const idx = BASE32_ALPHABET.indexOf(char.toUpperCase());
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a TOTP code for the current time step
 */
export function generateTotpCode(
  config: TotpConfig,
  cryptoHmac: (data: string | Buffer, secret: string) => Promise<string>,
  clockNow: () => number,
): Promise<TotpCodeResult> {
  if (!config.secret) {
    throw new Error("TOTP secret is required");
  }
  const secretBytes = base32Decode(config.secret);
  const now = clockNow();
  const timeStep = Math.floor(now / 1000 / config.timeStepSeconds);
  const expiresAt = (timeStep + 1) * config.timeStepSeconds * 1000;
  const remainingSeconds = Math.ceil((expiresAt - now) / 1000);

  // Convert time step to 8-byte big-endian buffer
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(timeStep));

  // Decode base32 secret to use as HMAC key
  const hmacKey = Buffer.from(secretBytes).toString("latin1");

  return cryptoHmac(timeBuffer, hmacKey).then((hmacHex) => {
    // Dynamic truncation (RFC 4226)
    const hmacBytes = Buffer.from(hmacHex, "hex");
    const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
    const binary =
      ((hmacBytes[offset] & 0x7f) << 24) |
      ((hmacBytes[offset + 1] & 0xff) << 16) |
      ((hmacBytes[offset + 2] & 0xff) << 8) |
      (hmacBytes[offset + 3] & 0xff);

    const code = String(binary % 10 ** config.codeLength).padStart(
      config.codeLength,
      "0",
    );

    return { code, expiresAt, remainingSeconds };
  });
}

/**
 * Verify a TOTP code against the secret, with replay protection and clock drift tolerance
 */
export function verifyTotpCode(
  params: {
    code: string;
    secret: string;
    usedSteps: Set<number>; // Steps already used (replay protection)
    config?: Partial<TotpConfig>;
  },
  cryptoHmac: (data: string | Buffer, secret: string) => Promise<string>,
  clockNow: () => number,
): Promise<TotpVerifyResult> {
  const config = { ...DEFAULT_TOTP_CONFIG, ...params.config };
  const now = clockNow();
  const currentStep = Math.floor(now / 1000 / config.timeStepSeconds);
  const codeLength = config.codeLength;

  // Check verification window (current step ± window)
  for (let offset = -config.verificationWindow; offset <= config.verificationWindow; offset++) {
    const step = currentStep + offset;

    // Replay protection: step already used
    if (params.usedSteps.has(step)) {
      continue;
    }

    // Skip negative time steps (before Unix epoch)
    if (step < 0) {
      continue;
    }

    // Generate expected code for this step
    const secretBytes = base32Decode(params.secret);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(step));
    const hmacKey = Buffer.from(secretBytes).toString("latin1");

    cryptoHmac(timeBuffer, hmacKey).then((hmacHex) => {
      const hmacBytes = Buffer.from(hmacHex, "hex");
      const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
      const binary =
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff);

      const expectedCode = String(binary % 10 ** codeLength).padStart(
        codeLength,
        "0",
      );

      if (expectedCode === params.code) {
        return { valid: true, matchedStep: step };
      }
    });

    // We can't use .then() synchronously in a loop, so we handle it differently below
  }

  // Synchronous version using crypto directly (HMAC is sync in our port? No, it's async)
  // We need to collect all promises and check them
  const promises: Promise<TotpVerifyResult | null>[] = [];
  for (let offset = -config.verificationWindow; offset <= config.verificationWindow; offset++) {
    const step = currentStep + offset;

    // Skip negative time steps (before epoch)
    if (step < 0) {
      promises.push(Promise.resolve(null));
      continue;
    }

    if (params.usedSteps.has(step)) {
      promises.push(Promise.resolve(null));
      continue;
    }

    const secretBytes = base32Decode(params.secret);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(step));
    const hmacKey = Buffer.from(secretBytes).toString("latin1");

    promises.push(
      cryptoHmac(timeBuffer, hmacKey).then((hmacHex) => {
        const hmacBytes = Buffer.from(hmacHex, "hex");
        const offset2 = hmacBytes[hmacBytes.length - 1] & 0xf;
        const binary =
          ((hmacBytes[offset2] & 0x7f) << 24) |
          ((hmacBytes[offset2 + 1] & 0xff) << 16) |
          ((hmacBytes[offset2 + 2] & 0xff) << 8) |
          (hmacBytes[offset2 + 3] & 0xff);

        const expectedCode = String(binary % 10 ** codeLength).padStart(
          codeLength,
          "0",
        );

        if (expectedCode === params.code) {
          return { valid: true, matchedStep: step } as TotpVerifyResult;
        }
        return null as TotpVerifyResult | null;
      }),
    );
  }

  return Promise.all(promises).then((results) => {
    for (const result of results) {
      if (result && result.valid) {
        return result;
      }
    }
    return { valid: false, reason: "INVALID_CODE" };
  });
}

/**
 * Generate a provisioning URI for QR code scanning (otpauth://TOTP/...)
 */
export function generateProvisioningUri(params: {
  secret: string;
  accountName: string;
  issuer: string;
  algorithm?: "SHA1" | "SHA256" | "SHA512";
  digits?: number;
  period?: number;
}): TotpProvisioningUri {
  const algorithm = params.algorithm ?? "SHA1";
  const digits = params.digits ?? 6;
  const period = params.period ?? 30;

  const encodedSecret = params.secret.replace(/=+$/, ""); // Remove padding for URI
  const encodedAccount = encodeURIComponent(params.accountName);

  const uri = `otpauth://totp/${encodedAccount}?secret=${encodedSecret}&issuer=${encodeURIComponent(params.issuer)}&algorithm=${algorithm}&digits=${digits}&period=${period}`;

  return { uri, secret: params.secret };
}
