import { describe, it, expect } from "vitest";
import {
  PkceValidator,
  RefreshTokenRotator,
  DeviceRegistry,
  AssetLinksService,
  DeltaSyncEngine,
  MobileOpenApiExporter,
  FcmPushAdapter,
} from "./index";

describe("@mosaix/mobile-bridge", () => {
  describe("PKCE Validator", () => {
    it("should compute S256 challenge and verify correctly", () => {
      // 43-character valid verifier
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const challenge = PkceValidator.computeS256Challenge(verifier);

      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe("string");
      expect(PkceValidator.verify(verifier, challenge, "S256")).toBe(true);
      expect(PkceValidator.verify("invalid_verifier_that_is_too_long_or_different_43chars", challenge, "S256")).toBe(false);
    });

    it("should reject verifiers that are too short (< 43 chars)", () => {
      expect(PkceValidator.verify("short", "any", "S256")).toBe(false);
    });
  });

  describe("Refresh Token Rotator & Reuse Detection", () => {
    it("should issue and rotate refresh tokens", () => {
      const session = RefreshTokenRotator.createSession("user-1", "device-android-1");
      expect(session.accessToken).toMatch(/^mosaix_acc_/);
      expect(session.refreshToken).toMatch(/^mosaix_ref_/);

      const rotateResult = RefreshTokenRotator.rotate(session.refreshToken);
      expect(rotateResult.success).toBe(true);
      if (rotateResult.success) {
        expect(rotateResult.tokens.accessToken).toBeDefined();
        expect(rotateResult.tokens.refreshToken).not.toBe(session.refreshToken);

        // Attempting to reuse the OLD refresh token should trigger reuse detection and revoke
        const replayResult = RefreshTokenRotator.rotate(session.refreshToken);
        expect(replayResult.success).toBe(false);
        if (!replayResult.success) {
          expect(replayResult.error).toContain("Token reuse detected");
        }
      }
    });
  });

  describe("Device Registry", () => {
    it("should register devices and subscribe to topics", () => {
      const dev = DeviceRegistry.register({
        userId: "user-42",
        deviceId: "dev-pixel-9",
        fcmToken: "fcm-token-xyz-123",
        platform: "android",
      });

      expect(dev.deviceId).toBe("dev-pixel-9");
      expect(dev.platform).toBe("android");

      DeviceRegistry.subscribeToTopic("dev-pixel-9", "space-commerce");
      const tokens = DeviceRegistry.getTokensForTopic("space-commerce");
      expect(tokens).toContain("fcm-token-xyz-123");
    });
  });

  describe("Android Digital Asset Links", () => {
    it("should produce valid assetlinks structure", () => {
      const links = AssetLinksService.getAssetLinks();
      expect(Array.isArray(links)).toBe(true);
      expect(links[0].relation).toContain("delegate_permission/common.handle_all_urls");
      expect(links[0].target.namespace).toBe("android_app");
      expect(links[0].target.package_name).toBe("io.mosaix.mobile");
    });
  });

  describe("Delta Sync Engine", () => {
    it("should calculate deltas and generate ETags", () => {
      const items = [
        { id: "post-1", updatedAt: "2026-09-25T06:00:00.000Z", content: "Post 1" },
        { id: "post-2", updatedAt: "2026-09-25T07:00:00.000Z", content: "Post 2" },
      ];

      const fullSync = DeltaSyncEngine.calculateDelta(items);
      expect(fullSync.items.length).toBe(2);
      expect(fullSync.isModified).toBe(true);
      expect(fullSync.eTag).toBeDefined();

      // If client provides matching ETag, returns 304 not modified
      const cachedSync = DeltaSyncEngine.calculateDelta(items, undefined, fullSync.eTag);
      expect(cachedSync.isModified).toBe(false);
      expect(cachedSync.items.length).toBe(0);

      // Delta sync since 06:30
      const delta = DeltaSyncEngine.calculateDelta(items, "2026-09-25T06:30:00.000Z");
      expect(delta.items.length).toBe(1);
      expect(delta.items[0].id).toBe("post-2");
    });
  });

  describe("Mobile OpenAPI Exporter", () => {
    it("should output valid OpenAPI 3.1 structure with mobile endpoints", () => {
      const schema = MobileOpenApiExporter.generateMobileSchema() as {
        openapi: string;
        paths: Record<string, unknown>;
      };
      expect(schema.openapi).toBe("3.1.0");
      expect(schema.paths["/.well-known/assetlinks.json"]).toBeDefined();
      expect(schema.paths["/api/mobile/devices"]).toBeDefined();
      expect(schema.paths["/api/mobile/auth/token"]).toBeDefined();
    });
  });

  describe("FCM Push Adapter", () => {
    it("should format valid FCM v1 message structure", () => {
      const adapter = new FcmPushAdapter();
      const payload = adapter.formatFcmPayload("token-123", {
        title: "Hello Android",
        body: "Test Body",
        data: { key: "value" },
      }) as { message: { notification: { title: string }; token: string } };

      expect(payload.message.token).toBe("token-123");
      expect(payload.message.notification.title).toBe("Hello Android");
    });
  });
});
