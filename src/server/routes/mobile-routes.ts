/**
 * @server/routes — Native Mobile API Routes (Android / iOS)
 * Integrates @mosaix/mobile-bridge for OAuth 2.1 PKCE, FCM push registry,
 * Android Digital Asset Links, and delta-sync for Android Room DB.
 */

import * as crypto from "node:crypto";
import type * as http from "node:http";
import type { URL } from "node:url";
import {
  AssetLinksService,
  PkceValidator,
  DeltaSyncEngine,
  MobileOpenApiExporter,
  FcmPushAdapter,
  type SyncableItem,
} from "../../../packages/mobile-bridge/src/index.js";
import type { UserProfile } from "../../shell/profiles.js";
import type { SolaraSocialService } from "../../../apps/solara/src/domain/social.model.js";
import type { DatabasePort } from "@mosaix/ports-database";
import {
  AuthCodeStoreAdapter,
  type AuthCodeRecord,
} from "../../../packages/mobile-bridge/src/auth/auth-code-store.js";
import { DeviceRegistryAdapter } from "../../../packages/mobile-bridge/src/push/device-registry-adapter.js";
import { RefreshTokenStoreAdapter } from "../../../packages/mobile-bridge/src/auth/refresh-token-store.js";

const fcmAdapter = new FcmPushAdapter();

function readJsonBody(req: http.IncomingMessage, maxBytes: number = 512 * 1024): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    let receivedBytes = 0;
    let exceeded = false;

    req.on("data", (chunk: Buffer | string) => {
      if (exceeded) return;
      receivedBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (receivedBytes > maxBytes) {
        exceeded = true;
        req.pause();
        resolve({});
        return;
      }
      data += chunk;
    });

    req.on("end", () => {
      if (exceeded) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });

    req.on("error", () => {
      resolve({});
    });
  });
}

export async function handleMobileRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  currentUser: UserProfile,
  socialService: SolaraSocialService,
  db: DatabasePort
): Promise<boolean> {
  const authCodeStore = new AuthCodeStoreAdapter(db);
  const deviceRegistry = new DeviceRegistryAdapter(db);
  const refreshTokenStore = new RefreshTokenStoreAdapter(db);
  const pathname = parsedUrl.pathname;

  // 1. Android Digital Asset Links (RFC & Google App Links Standard)
  if (pathname === "/.well-known/assetlinks.json" && (req.method === "GET" || req.method === "HEAD")) {
    const assetLinks = AssetLinksService.getAssetLinks();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    });
    res.end(JSON.stringify(assetLinks, null, 2));
    return true;
  }

  // 2. Mobile-Optimized OpenAPI 3.1 Spec (for Kotlin Retrofit / Ktor Generator)
  if ((pathname === "/api/mobile/openapi.json" || pathname === "/mobile/openapi.json") && req.method === "GET") {
    const spec = MobileOpenApiExporter.generateMobileSchema();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
    res.end(JSON.stringify(spec, null, 2));
    return true;
  }

  // 3. Register / Update Mobile Device (FCM Token Registration)
  if (pathname === "/api/mobile/devices" && req.method === "POST") {
    const body = await readJsonBody(req);
    const deviceId = String(body.deviceId || "");
    const fcmToken = String(body.fcmToken || "");
    const platform = (body.platform === "ios" ? "ios" : "android") as "android" | "ios";

    if (!deviceId || !fcmToken) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "deviceId and fcmToken are required." }));
      return true;
    }

    const registration = await deviceRegistry.register({
      userId: currentUser.id || "Administrateur",
      deviceId,
      fcmToken,
      platform,
      appVersion: body.appVersion ? String(body.appVersion) : undefined,
      osVersion: body.osVersion ? String(body.osVersion) : undefined,
      deviceModel: body.deviceModel ? String(body.deviceModel) : undefined,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, registration }));
    return true;
  }

  // 4. OAuth 2.1 PKCE Authorize (Step 1: issue code with code_challenge)
  if (pathname === "/api/mobile/auth/authorize" && req.method === "POST") {
    const body = await readJsonBody(req);
    const codeChallenge = String(body.codeChallenge || "");
    const method = body.codeChallengeMethod || "S256";

    // VULN-05: OAuth 2.1 forbids the "plain" challenge method (RFC 7636 / OAuth 2.1 draft)
    if (method !== "S256") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "invalid_request",
          message: "OAuth 2.1 requires codeChallengeMethod to be 'S256'. The 'plain' method is forbidden.",
        })
      );
      return true;
    }

    if (!codeChallenge) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "codeChallenge is required for PKCE flow." }));
      return true;
    }

    // Cryptographically secure authorization code (256 bits entropy)
    const code = `auth_code_${crypto.randomBytes(32).toString("hex")}`;
    const authCodeRecord: AuthCodeRecord = {
      id: code,
      userId: currentUser.id || "Administrateur",
      codeChallenge,
      codeChallengeMethod: "S256",
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      createdAt: Date.now(),
    };
    await authCodeStore.save(authCodeRecord);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, code, expiresInSeconds: 300 }));
    return true;
  }

  // 5. OAuth 2.1 PKCE Token Exchange & Refresh Token Rotation (Step 2)
  if (pathname === "/api/mobile/auth/token" && req.method === "POST") {
    const body = await readJsonBody(req);
    const grantType = body.grantType;
    const deviceId = String(body.deviceId || "android_default");

    if (grantType === "authorization_code") {
      const code = String(body.code || "");
      const codeVerifier = String(body.codeVerifier || "");

      const storedCode = await authCodeStore.findById(code);
      if (!storedCode || storedCode.expiresAt < Date.now()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_grant", message: "Code d'autorisation expiré ou invalide." }));
        return true;
      }

      // Verify PKCE verifier against stored challenge
      const isValid = PkceValidator.verify(codeVerifier, storedCode.codeChallenge, storedCode.codeChallengeMethod);
      await authCodeStore.deleteById(code); // One-time use

      if (!isValid) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_grant", message: "Échec de vérification PKCE: codeVerifier non valide." }));
        return true;
      }

      const session = await refreshTokenStore.createSession(storedCode.userId, deviceId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(session));
      return true;
    }

    if (grantType === "refresh_token") {
      const refreshToken = String(body.refreshToken || "");
      const rotationResult = await refreshTokenStore.rotate(refreshToken);

      if (!rotationResult.success) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_grant", message: rotationResult.error }));
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(rotationResult.tokens));
      return true;
    }

    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unsupported_grant_type", message: "Utilisez authorization_code ou refresh_token." }));
    return true;
  }

  // 6. Test FCM Push Notification to Registered Device
  if (pathname === "/api/mobile/push/test" && req.method === "POST") {
    const body = await readJsonBody(req);
    const fcmToken = String(body.fcmToken || "");
    if (!fcmToken) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "fcmToken parameter is required for push dispatch" }));
      return true;
    }

    const result = await fcmAdapter.sendToDevice(fcmToken, {
      title: body.title ? String(body.title) : "☀️ MosaiX Solara",
      body: body.body ? String(body.body) : "Nouvelle publication dans votre espace suivi !",
      priority: "high",
      data: {
        type: "NEW_POST",
        targetSpace: "space-commerce",
        timestamp: new Date().toISOString(),
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, result }));
    return true;
  }

  // 7. Delta-Sync Endpoint for Android Room DB (ETags & Since timestamp)
  // Served from the Solara N1 pipeline (post shell_feed removal): full
  // chronological post list; DeltaSyncEngine derives deltas + ETags.
  if (pathname === "/api/mobile/sync/feed" && req.method === "GET") {
    const clientSince = parsedUrl.searchParams.get("since") || undefined;
    const clientIfNoneMatch = req.headers["if-none-match"];

    const solaraPosts = await socialService.listFeedMultiSourceAsync(
      currentUser.id,
      "chronological",
    );
    const syncablePosts: SyncableItem[] = solaraPosts.map((p) => ({
      id: p.id,
      type: p.publicationType,
      author: p.actorId,
      content: p.content,
      category: p.targetId,
      tags: Array.isArray(p.metadata?.tags) ? p.metadata.tags : [],
      likes: p.likeCount,
      timestamp: p.createdAt.getTime(),
      spaceId: p.targetType === "space" ? p.targetId : undefined,
      updatedAt: p.createdAt.toISOString(),
    }));

    const deltaResult = DeltaSyncEngine.calculateDelta(syncablePosts, clientSince, clientIfNoneMatch);

    if (!deltaResult.isModified) {
      res.writeHead(304, {
        ETag: deltaResult.eTag,
        "Cache-Control": "private, must-revalidate",
      });
      res.end();
      return true;
    }

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      ETag: deltaResult.eTag,
      "Cache-Control": "private, must-revalidate",
    });
    res.end(JSON.stringify(deltaResult));
    return true;
  }

  return false;
}
