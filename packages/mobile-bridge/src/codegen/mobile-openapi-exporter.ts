/**
 * Mobile-Optimized OpenAPI 3.1 Contract Exporter
 * Formats API endpoints and schemas specifically tailored for Android Kotlin / Retrofit
 * generator tools (e.g. openapi-generator-cli with kotlin / kotlinx.serialization).
 */
export class MobileOpenApiExporter {
  public static generateMobileSchema(): Record<string, unknown> {
    return {
      openapi: "3.1.0",
      info: {
        title: "MosaiX Mobile Gateway API",
        version: "1.0.0",
        description: "Official Android & iOS Native Client Contract for MosaiX Platform",
      },
      servers: [
        {
          url: "/",
          description: "Current MosaiX Instance",
        },
      ],
      paths: {
        "/.well-known/assetlinks.json": {
          get: {
            summary: "Android Digital Asset Links",
            description: "Used by Android OS to verify app link domain ownership",
            operationId: "getAssetLinks",
            tags: ["Mobile Links"],
            responses: {
              "200": {
                description: "Array of statement objects",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          relation: { type: "array", items: { type: "string" } },
                          target: {
                            type: "object",
                            properties: {
                              namespace: { type: "string" },
                              package_name: { type: "string" },
                              sha256_cert_fingerprints: { type: "array", items: { type: "string" } },
                            },
                            required: ["namespace", "package_name", "sha256_cert_fingerprints"],
                          },
                        },
                        required: ["relation", "target"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/api/mobile/devices": {
          post: {
            summary: "Register Mobile Device Push Token",
            description: "Associates an FCM push token with the authenticated user",
            operationId: "registerDevice",
            tags: ["Mobile Push"],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      deviceId: { type: "string" },
                      fcmToken: { type: "string" },
                      platform: { type: "string", enum: ["android", "ios"] },
                      appVersion: { type: "string" },
                      osVersion: { type: "string" },
                      deviceModel: { type: "string" },
                    },
                    required: ["deviceId", "fcmToken", "platform"],
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Device successfully registered",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        deviceId: { type: "string" },
                        registeredAt: { type: "string", format: "date-time" },
                      },
                      required: ["success", "deviceId"],
                    },
                  },
                },
              },
            },
          },
        },
        "/api/mobile/auth/token": {
          post: {
            summary: "OAuth 2.1 PKCE Token Exchange & Refresh",
            description: "Exchange authorization code + code_verifier for JWT tokens, or rotate refresh token",
            operationId: "exchangeOrRefreshToken",
            tags: ["Mobile Auth"],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      grantType: { type: "string", enum: ["authorization_code", "refresh_token"] },
                      code: { type: "string" },
                      codeVerifier: { type: "string" },
                      refreshToken: { type: "string" },
                      deviceId: { type: "string" },
                    },
                    required: ["grantType", "deviceId"],
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Token response",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        accessToken: { type: "string" },
                        refreshToken: { type: "string" },
                        tokenType: { type: "string", example: "Bearer" },
                        expiresInSeconds: { type: "integer", example: 900 },
                        userId: { type: "string" },
                      },
                      required: ["accessToken", "refreshToken", "tokenType", "expiresInSeconds", "userId"],
                    },
                  },
                },
              },
            },
          },
        },
        "/api/solara/feed": {
          get: {
            summary: "Get Algorithmic / Personalized Solara Feed",
            description: "Returns paginated feed posts with optional recommendation and sponsored insertion",
            operationId: "getFeed",
            tags: ["Social Feed"],
            parameters: [
              { name: "mode", in: "query", schema: { type: "string", enum: ["for_you", "trending", "chronological", "media"] } },
              { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
              { name: "afterCursor", in: "query", schema: { type: "string" } },
              { name: "sponsored", in: "query", schema: { type: "boolean", default: true } },
            ],
            responses: {
              "200": {
                description: "Feed payload with cursor",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        feedMode: { type: "string" },
                        posts: { type: "array", items: { $ref: "#/components/schemas/FeedPostItem" } },
                        hasMore: { type: "boolean" },
                        nextCursor: { type: "string", nullable: true },
                      },
                      required: ["feedMode", "posts", "hasMore"],
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          FeedPostItem: {
            type: "object",
            properties: {
              id: { type: "string" },
              actorType: { type: "string", enum: ["user", "space", "organization", "system"] },
              actorId: { type: "string" },
              publicationType: { type: "string" },
              targetType: { type: "string" },
              targetId: { type: "string" },
              content: { type: "string" },
              mediaUrls: { type: "array", items: { type: "string" } },
              likeCount: { type: "integer" },
              commentsCount: { type: "integer" },
              createdAt: { type: "string", format: "date-time" },
              isSponsored: { type: "boolean", nullable: true },
              sponsorName: { type: "string", nullable: true },
              sponsorBadge: { type: "string", nullable: true },
              ctaText: { type: "string", nullable: true },
              ctaUrl: { type: "string", nullable: true },
            },
            required: ["id", "actorType", "actorId", "publicationType", "targetType", "targetId", "content", "likeCount", "commentsCount", "createdAt"],
          },
        },
      },
    };
  }
}
