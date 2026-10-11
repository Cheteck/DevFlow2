/**
 * @mosaix/mobile-bridge — Autonomous Mobile Adapter & Bridge for MosaiX Platform
 * Provides OAuth 2.1 PKCE, FCM push token registry, Digital Asset Links,
 * delta-sync for Android Room SQLite, and mobile-optimized OpenAPI contracts.
 */

export * from "./auth/pkce-validator";
export * from "./auth/refresh-token-rotator";
// refresh-token-store re-declares MobileSessionToken/StoredSession with a
// persistent (epoch-millis) shape: export only its class + port explicitly so
// the in-memory rotator keeps ownership of the shared type names. Unifying the
// two shapes is backlog (different backends, different clocks).
export {
  RefreshTokenStoreAdapter,
  type RefreshTokenStorePort,
} from "./auth/refresh-token-store";
export * from "./auth/auth-code-store";
export * from "./push/device-registry";
// Same split as above: DeviceRegistry (in-memory) owns MobilePlatform +
// MobileDeviceRegistration; the persistent adapter exports class + port only.
export {
  DeviceRegistryAdapter,
  type DeviceRegistryPort,
} from "./push/device-registry-adapter";
export * from "./push/push-notification-port";
export * from "./push/fcm-push-adapter";
export * from "./links/assetlinks-service";
export * from "./sync/delta-sync-engine";
export * from "./codegen/mobile-openapi-exporter";
