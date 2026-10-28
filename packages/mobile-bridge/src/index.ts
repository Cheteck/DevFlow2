/**
 * @mosaix/mobile-bridge — Autonomous Mobile Adapter & Bridge for MosaiX Platform
 * Provides OAuth 2.1 PKCE, FCM push token registry, Digital Asset Links,
 * delta-sync for Android Room SQLite, and mobile-optimized OpenAPI contracts.
 */

export * from "./auth/pkce-validator.js";
export * from "./auth/refresh-token-rotator.js";
// refresh-token-store re-declares MobileSessionToken/StoredSession with a
// persistent (epoch-millis) shape: export only its class + port explicitly so
// the in-memory rotator keeps ownership of the shared type names. Unifying the
// two shapes is backlog (different backends, different clocks).
export {
  RefreshTokenStoreAdapter,
  type RefreshTokenStorePort,
} from "./auth/refresh-token-store.js";
export * from "./auth/auth-code-store.js";
export * from "./push/device-registry.js";
// Same split as above: DeviceRegistry (in-memory) owns MobilePlatform +
// MobileDeviceRegistration; the persistent adapter exports class + port only.
export {
  DeviceRegistryAdapter,
  type DeviceRegistryPort,
} from "./push/device-registry-adapter.js";
export * from "./push/push-notification-port.js";
export * from "./push/fcm-push-adapter.js";
export * from "./links/assetlinks-service.js";
export * from "./sync/delta-sync-engine.js";
export * from "./codegen/mobile-openapi-exporter.js";
