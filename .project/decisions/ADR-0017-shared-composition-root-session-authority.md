# ADR-0017 — Shared Composition Root & Single Platform Session Authority

**Status:** Accepted
**Date:** September 26, 2026
**Deciders:** Platform Architecture Review

---

## Context

To comply with ADR-0012 (Platform Auth vs Identity Workflows Separation) and ADR-0016 (BAC Ownership & Boundaries), the platform requires a single, authoritative session mechanism without duplicating authentication logic or violating bounded context boundaries between the Shell (`@mosaix/shell`), `@mosaix/auth`, and Citadelle (`apps/citadelle`).

---

## Decision

We establish the following architectural rules:

1. **Single Platform Session Authority (`@mosaix/auth`)**:
   - `@mosaix/auth` is the sole owner of platform session lifecycle, tokens, and resolution (`PlatformSessionResolver` / `SessionResolver`).
   - Sessions are validated against persistent stores (`SessionStore`, `IdentityStore`). Resolved sessions are checked for expiration, revocation, and active identity status.

2. **Domain Boundaries (`Citadelle`)**:
   - `Citadelle` (`apps/citadelle`) owns user identity records, credential registration, and profile domains.
   - Citadelle exposes domain ports (`IdentityAuthenticationPort`, `IdentityRegistrationPort`, `IdentityProfilePort`) and does NOT own or create alternative platform session systems.

3. **Shared Composition Root (`bootstrap/auth-composition.ts`)**:
   - The root `bootstrap/` subsystem wires a single, shared instance of `AuthManager`, `SessionManager`, `SessionResolver`, and persistent database adapters.
   - The Shell and API dispatchers receive contracts and capability ports via `PlatformAuthComposition` rather than creating direct cross-domain imports to application internals.

4. **HTTP Transport & SSR Projection**:
   - Web browsers convey session context via opaque HttpOnly cookies (`mosaix_session` or `__Host-mosaix_session`).
   - The Shell resolves the session via `SessionResolver` on each HTTP request and projects it to `UserProfile`.
   - When demo mode is disabled (`MOSAIX_DEMO_USERS=false`), unauthenticated requests resolve to a guest profile (`id: "guest"`), displaying Login and Register CTA widgets.

---

## Consequences

- Zero cross-domain leakage or duplicate session managers.
- Clear separation between session state (`@mosaix/auth`), identity workflows (`apps/citadelle`), and HTTP transport (`@mosaix/shell`).
- Production-grade security without silent in-memory fallback violations.
