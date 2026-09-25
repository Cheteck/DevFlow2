# ADR-0015: Mobile Bridge & Native Android Integration Architecture

## Status
Accepted

## Context
MosaiX supports web-based SSR and desktop clients, but native mobile platforms (Android Kotlin, Jetpack Compose, iOS Swift) require dedicated protocol adapters for:
1. Client-side OAuth 2.1 PKCE without embedded client secrets.
2. Single-use refresh token rotation with family revocation to prevent token interception replay attacks.
3. Android Digital Asset Links (`/.well-known/assetlinks.json`) for seamless Google App Links domain verification.
4. Offline-first local database synchronization (Room SQLite) with HTTP delta-sync (`ETag`, `If-None-Match`, `since`).
5. Firebase Cloud Messaging (FCM v1) device token registry and background wakeup payloads.
6. Contract-First code generation for Retrofit / Ktor via OpenAPI 3.1.

## Decision
We introduce the standalone package `@mosaix/mobile-bridge`:
- `packages/mobile-bridge/`
  - `auth/pkce-validator.ts`: RFC 7636 compliant S256 code challenge computation and verification.
  - `auth/refresh-token-rotator.ts`: Atomic token rotation with token-family reuse detection.
  - `push/device-registry.ts`: Mobile device and topic subscription registry.
  - `push/fcm-push-adapter.ts`: FCM v1 HTTP API payload formatter and dispatcher.
  - `links/assetlinks-service.ts`: Digital Asset Links statement generator.
  - `sync/delta-sync-engine.ts`: ETag generation, 304 Not Modified handler, and delta-sync calculator.
  - `codegen/mobile-openapi-exporter.ts`: Mobile-optimized OpenAPI 3.1 contract generator.

Endpoints exposed in the platform via `src/server/routes/mobile-routes.ts`:
- `GET /.well-known/assetlinks.json`
- `GET /api/mobile/openapi.json`
- `POST /api/mobile/devices`
- `POST /api/mobile/auth/authorize`
- `POST /api/mobile/auth/token`
- `POST /api/mobile/push/test`
- `GET /api/mobile/sync/feed`

## Consequences
- Native Android developers can generate Retrofit clients directly from `/api/mobile/openapi.json`.
- Mobile users enjoy instant launch and offline access using Room DB and delta-sync.
- App Links open native activities without browser selection dialogs.
- Zero secrets are bundled inside the Android APK.
