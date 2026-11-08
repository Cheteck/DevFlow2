/**
 * @packages/otp — TOTP (RFC 6238) tests
 */

import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  base32Encode,
  base32Decode,
  generateTotpCode,
  verifyTotpCode,
  generateProvisioningUri,
  DEFAULT_TOTP_CONFIG,
} from "./totp.js";
import type { TotpConfig } from "./totp.js";

describe("TOTP (RFC 6238)", () => {
  const testSecret = "JBSWY3DPEHPK3PXP"; // Known test secret from RFC 6238

  describe("base32 encoding/decoding", () => {
    it("encodes and decodes correctly", () => {
      const bytes = Buffer.from([0x7f, 0x7f, 0x7f, 0x7f]);
      const encoded = base32Encode(bytes);
      const decoded = base32Decode(encoded);
      expect(decoded.equals(bytes)).toBe(true);
    });
  });

  describe("generateTotpSecret", () => {
    it("generates a 32-character base32 string", () => {
      const secret = generateTotpSecret(() => Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
      expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    });
  });

  describe("generateTotpCode", () => {
    const crypto = async (data: string | Buffer, secret: string) => {
      const c = await import("node:crypto");
      return c.createHmac("sha1", secret).update(data as Buffer).digest("hex");
    };

    it("generates a 6-digit code", async () => {
      const config: TotpConfig = {
        secret: testSecret,
        timeStepSeconds: 30,
        codeLength: 6,
        algorithm: "SHA1",
        verificationWindow: 1,
      };
      const result = await generateTotpCode(
        config,
        crypto,
        () => new Date(59 * 1000), // Time step 0
      );
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(result.remainingSeconds).toBeLessThanOrEqual(30);
    });

    it("produces different codes for different time steps", async () => {
      const config: TotpConfig = {
        secret: testSecret,
        timeStepSeconds: 30,
        codeLength: 6,
        algorithm: "SHA1",
        verificationWindow: 1,
      };
      const code1 = await generateTotpCode(config, crypto, () => new Date(0 * 1000));
      const code2 = await generateTotpCode(config, crypto, () => new Date(31 * 1000));
      expect(code1.code).not.toBe(code2.code);
    });
  });

  describe("verifyTotpCode", () => {
    const crypto = async (data: string | Buffer, secret: string) => {
      const c = await import("node:crypto");
      return c.createHmac("sha1", secret).update(data as Buffer).digest("hex");
    };

    it("verifies a valid code", async () => {
      const config: TotpConfig = {
        secret: testSecret,
        timeStepSeconds: 30,
        codeLength: 6,
        algorithm: "SHA1",
        verificationWindow: 1,
      };

      // Generate a code at time step 0
      const result = await generateTotpCode(config, crypto, () => new Date(0 * 1000));

      // Verify it at the same time step
      const verification = await verifyTotpCode(
        {
          code: result.code,
          secret: testSecret,
          usedSteps: new Set(),
          config,
        },
        crypto,
        () => new Date(0 * 1000),
      );
      expect(verification.valid).toBe(true);
    });

    it("rejects an invalid code", async () => {
      const config: TotpConfig = {
        secret: testSecret,
        timeStepSeconds: 30,
        codeLength: 6,
        algorithm: "SHA1",
        verificationWindow: 1,
      };

      const verification = await verifyTotpCode(
        {
          code: "000000",
          secret: testSecret,
          usedSteps: new Set(),
          config,
        },
        crypto,
        () => new Date(30 * 1000), // Use time step 1 to avoid negative step
      );
      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe("INVALID_CODE");
    });

    it("rejects replay of the same time step", async () => {
      const config: TotpConfig = {
        secret: testSecret,
        timeStepSeconds: 30,
        codeLength: 6,
        algorithm: "SHA1",
        verificationWindow: 1,
      };
      const result = await generateTotpCode(config, crypto, () => new Date(0 * 1000));

      // First verification succeeds
      const first = await verifyTotpCode(
        {
          code: result.code,
          secret: testSecret,
          usedSteps: new Set(),
          config,
        },
        crypto,
        () => new Date(0 * 1000),
      );
      expect(first.valid).toBe(true);

      // Second verification with same code and same used steps fails (replay)
      const usedSteps = new Set([0]);
      const second = await verifyTotpCode(
        {
          code: result.code,
          secret: testSecret,
          usedSteps,
          config,
        },
        crypto,
        () => new Date(0 * 1000),
      );
      expect(second.valid).toBe(false);
      expect(second.reason).toBe("INVALID_CODE");
    });
  });

  describe("generateProvisioningUri", () => {
    it("generates a valid otpauth:// URI", () => {
      const uri = generateProvisioningUri({
        secret: testSecret,
        accountName: "alice@example.com",
        issuer: "Mosaix",
      });
      expect(uri.uri.startsWith("otpauth://totp/")).toBe(true);
      expect(uri.uri).toContain("secret=JBSWY3DPEHPK3PXP");
      expect(uri.uri).toContain("issuer=Mosaix");
      expect(uri.secret).toBe(testSecret);
    });
  });

  describe("DEFAULT_TOTP_CONFIG", () => {
    it("has RFC 6238 default values", () => {
      expect(DEFAULT_TOTP_CONFIG.timeStepSeconds).toBe(30);
      expect(DEFAULT_TOTP_CONFIG.codeLength).toBe(6);
      expect(DEFAULT_TOTP_CONFIG.algorithm).toBe("SHA1");
      expect(DEFAULT_TOTP_CONFIG.verificationWindow).toBe(1);
    });
  });
});
