# ADR-0012 — Platform Auth vs Identity Workflows Separation

**Status:** Accepted
**Date:** August 19, 2026
**Deciders:** Platform Architecture Review

---

## Context

A fundamental architectural distinction exists in MosaiX between **Platform Authentication (Platform Auth)** and **Identity Workflows**:

1. **Platform Auth** is a core, platform-wide runtime mechanism (`Layer 4 — framework-primitive`). It owns the single platform authenticated session, credentials, tokens, and authentication state consumed by all Bounded Applications.
2. **Identity Workflows** are user-facing workflows (login, logout, registration, password management, MFA/challenges, account management) provided by the `Identity` application (`apps/identity`).

Prior implementation risks included treating `Identity` as the owner of the platform session or having applications establish independent authentication sessions.

---

## Decision

We establish the immutable architectural rule:

> **1 User ➔ 1 Platform Authentication ➔ 1 Platform Session ➔ N Applications.**

1. **Platform Auth (`@mosaix/auth`)**:
   - Classformed as `Layer 4 — framework-primitive`.
   - Owns platform authentication state, tokens, and the single platform session.
   - Independent of `Identity` application source code (`Auth` NEVER depends on `Identity`).
2. **Identity (`apps/identity`)**:
   - Provides user-facing workflows (login, logout, registration, credentials management).
   - Consumes `Platform Auth` primitives to establish and manage platform sessions.
3. **Application Authorization**:
   - All Bounded Applications (Portfolio, Commerce, etc.) consume the single platform authentication context provided by Platform Auth.
   - Application-specific authorization rules and permissions remain strictly owned by each respective application.

---

## Consequences

- Applications cannot create independent authentication sessions.
- Zero-trust token validation is unified across the `Gateway` and Bounded Applications via `Platform Auth`.
- `Identity` becomes an ergonomic workflow provider for establishing platform sessions, avoiding circular dependencies between the Kernel/SDK and IAM domain apps.
