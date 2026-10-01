/**
 * @test Security & Vulnerability Automated Regression Test Suite
 * Validates fixes for VULN-01..VULN-08, GAP-02, and GAP-03.
 */

import { describe, it, expect, vi } from "vitest";
import type * as http from "node:http";
import { URL } from "node:url";
import { EventEmitter } from "node:events";
import * as crypto from "node:crypto";
import { getActiveUserProfile, LOCAL_USER_PROFILE, USER_PROFILES } from "../../src/shell/profiles.js";
import { handleMaintenanceRoutes } from "../../src/server/routes/maintenance-routes.js";
import { handleComplianceAndSystemRoutes } from "../../src/server/routes/compliance-routes.js";
import { pspWebhookHandler } from "../../src/shell/psp-webhook-handler.js";
import { resolveJwtSecret } from "@mosaix/auth";
import { InMemoryGuard } from "@mosaix/support";
import { SecurityGuard } from "../../src/shell/security-guard.js";
import { readLimitedBody, PayloadTooLargeError } from "../../src/server/utils/safe-body-parser.js";

function createMockRequest(bodyJson: unknown, headers: Record<string, string> = {}): http.IncomingMessage {
  const emitter = new EventEmitter() as unknown as http.IncomingMessage;
  (emitter as any).headers = { "content-type": "application/json", ...headers };
  (emitter as any).pause = vi.fn();

  setTimeout(() => {
    emitter.emit("data", Buffer.from(JSON.stringify(bodyJson)));
    emitter.emit("end");
  }, 10);

  return emitter;
}

describe("Security & Vulnerability Automated Regression Suite", () => {
  describe("VULN-01: Default User Profile Security", () => {
    it("never grants admin rights to an unauthenticated visitor by default", () => {
      const mockReq = { headers: {} } as http.IncomingMessage;
      const parsedUrl = new URL("http://localhost:3000/");

      const profile = getActiveUserProfile(mockReq, parsedUrl);
      expect(profile.role).not.toBe("admin");
      expect(profile.role).toBe("member");
    });

    it("returns neutral local profile when MOSAIX_DEMO_USERS=false", () => {
      const prevEnv = process.env.MOSAIX_DEMO_USERS;
      process.env.MOSAIX_DEMO_USERS = "false";

      try {
        const mockReq = { headers: { cookie: "mosaix_role=admin" } } as http.IncomingMessage;
        const parsedUrl = new URL("http://localhost:3000/?role=admin");

        const profile = getActiveUserProfile(mockReq, parsedUrl);
        expect(profile.id).toBe(LOCAL_USER_PROFILE.id);
        expect(profile.role).toBe("member");
      } finally {
        process.env.MOSAIX_DEMO_USERS = prevEnv;
      }
    });
  });

  describe("VULN-02: BOLA / IDOR Protection on GDPR Anonymization", () => {
    it("rejects attempt by standard user to anonymize another user account", async () => {
      const mockReq = createMockRequest({ userId: "victim-user-999" }, { method: "POST" });
      mockReq.method = "POST";

      let statusCode = 0;
      let responseData = "";
      const mockRes = {
        writeHead: (code: number) => {
          statusCode = code;
        },
        end: (data: string) => {
          responseData = data;
        },
      } as unknown as http.ServerResponse;

      const parsedUrl = new URL("http://localhost:3000/api/user/gdpr-anonymize");
      const attackerProfile = USER_PROFILES.member; // standard member (id: "user-1")

      const mockAnonymizer = { anonymizeUser: vi.fn() };
      const mockBackplane = { publish: vi.fn(), getNodeId: () => "node-1" };

      const handled = await handleComplianceAndSystemRoutes(
        mockReq,
        mockRes,
        parsedUrl,
        attackerProfile,
        mockAnonymizer as any,
        mockBackplane as any
      );

      expect(handled).toBe(true);
      expect(statusCode).toBe(403);
      expect(responseData).toContain("You are not authorized to anonymize another user account");
      expect(mockAnonymizer.anonymizeUser).not.toHaveBeenCalled();
    });
  });

  describe("VULN-03: Header Spoofing Rejection (X-Mosaix-Role)", () => {
    it("rejects maintenance state toggle despite X-Mosaix-Role: platform-admin header", async () => {
      const mockReq = createMockRequest({ enabled: true }, { "x-mosaix-role": "platform-admin" });
      mockReq.method = "POST";

      let statusCode = 0;
      let responseData = "";
      const mockRes = {
        writeHead: (code: number) => {
          statusCode = code;
        },
        end: (data: string) => {
          responseData = data;
        },
      } as unknown as http.ServerResponse;

      const parsedUrl = new URL("http://localhost:3000/api/imperia/maintenance");
      const standardUser = USER_PROFILES.member;

      const handled = await handleMaintenanceRoutes(mockReq, mockRes, parsedUrl, standardUser);

      expect(handled).toBe(true);
      expect(statusCode).toBe(403);
      expect(responseData).toContain("Seuls les administrateurs de gouvernance peuvent modifier le mode maintenance");
    });
  });

  describe("VULN-04: PSP Webhook Signature Verification", () => {
    it("rejects webhook request when x-psp-signature header is missing", async () => {
      const mockReq = createMockRequest({
        id: "evt_test",
        type: "payment_intent.succeeded",
        data: { orderId: "ord_100" },
      });

      let statusCode = 0;
      let responseData = "";

      await new Promise<void>((resolve) => {
        const mockRes = {
          writeHead: (code: number) => {
            statusCode = code;
          },
          end: (data: string) => {
            responseData = data;
            resolve();
          },
        } as unknown as http.ServerResponse;

        pspWebhookHandler.handleWebhookRequest(mockReq, mockRes);
      });

      expect(statusCode).toBe(401);
      expect(responseData).toContain("Missing Signature");
    });

    it("accepts webhook request with valid HMAC-SHA256 signature", async () => {
      const payload = JSON.stringify({
        id: "evt_valid_123",
        type: "payment_intent.succeeded",
        data: { orderId: "ord_999", amountInCents: 5000 },
        created: Date.now(),
      });

      const secret = "mosaix_psp_webhook_secret_dev_key_2026";
      const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

      const mockReq = new EventEmitter() as unknown as http.IncomingMessage;
      (mockReq as any).headers = {
        "content-type": "application/json",
        "x-psp-signature": hmac,
      };

      setTimeout(() => {
        mockReq.emit("data", Buffer.from(payload));
        mockReq.emit("end");
      }, 10);

      let statusCode = 0;
      let responseData = "";

      await new Promise<void>((resolve) => {
        const mockRes = {
          writeHead: (code: number) => {
            statusCode = code;
          },
          end: (data: string) => {
            responseData = data;
            resolve();
          },
        } as unknown as http.ServerResponse;

        pspWebhookHandler.handleWebhookRequest(mockReq, mockRes);
      });

      expect(statusCode).toBe(200);
      expect(responseData).toContain("evt_valid_123");
    });
  });

  describe("VULN-07: Payload Limit Protection (DoS Defense)", () => {
    it("throws PayloadTooLargeError when body stream exceeds maxBytes limit", async () => {
      const mockReq = new EventEmitter() as unknown as http.IncomingMessage;
      (mockReq as any).headers = {};
      (mockReq as any).pause = vi.fn();

      const readPromise = readLimitedBody(mockReq, 100);

      // Emit chunk exceeding 100 bytes limit
      mockReq.emit("data", Buffer.alloc(200, "a"));

      await expect(readPromise).rejects.toThrowError(PayloadTooLargeError);
    });
  });

  describe("VULN-08: SecurityGuard Production Constraint Enforcement", () => {
    it("throws fatal security error in production when JWT secret is weak or missing", () => {
      const prevEnv = process.env.NODE_ENV;
      const prevJwt = process.env.MOSAIX_AUTH_JWT_SECRET;
      process.env.NODE_ENV = "production";
      process.env.MOSAIX_AUTH_JWT_SECRET = "weak_secret";

      try {
        expect(() => SecurityGuard.enforceProductionConstraints()).toThrowError(/FATAL_SECURITY/);
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.MOSAIX_AUTH_JWT_SECRET = prevJwt;
      }
    });
  });

  describe("GAP-02: JWT Secret Minimum Length Enforcement", () => {
    it("throws an error in production if MOSAIX_AUTH_JWT_SECRET is shorter than 16 chars", () => {
      const shortSecretEnv = {
        NODE_ENV: "production",
        MOSAIX_AUTH_JWT_SECRET: "short-key",
      };

      expect(() => resolveJwtSecret(shortSecretEnv as any)).toThrowError(
        /MOSAIX_AUTH_JWT_SECRET must be set with at least 16 characters in production/
      );
    });

    it("accepts valid JWT secrets >= 16 chars in production", () => {
      const validSecretEnv = {
        NODE_ENV: "production",
        MOSAIX_AUTH_JWT_SECRET: "super-secure-production-jwt-key-32chars!",
      };

      expect(resolveJwtSecret(validSecretEnv as any)).toBe("super-secure-production-jwt-key-32chars!");
    });
  });

  describe("GAP-03: InMemoryGuard Prohibition in Production Mode", () => {
    it("throws ProductionInvariantViolation when in-memory adapter fallback is triggered in production", () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        expect(() => InMemoryGuard.reportFallback("TestAdapter", "no DB configured")).toThrowError(
          /ProductionInvariantViolation/
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });
});
