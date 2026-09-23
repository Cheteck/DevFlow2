# MosaiX Authentication Terminology

## Purpose

Disambiguate two overloaded terms in the MosaiX auth ecosystem: **Provider** and **Adapter**.

## Definitions

### Provider (Authentication Mechanism)

A **Provider** implements a **business authentication strategy** in `@mosaix/auth`.

It answers: *"How does the principal prove who they are?"*

| Provider | Mechanism |
|----------|-----------|
| `LocalPasswordProvider` | Username + password hash verification |
| `OidcProvider` | OpenID Connect authorization code flow |
| `WebAuthnProvider` | WebAuthn passwordless assertion |
| `SamlProvider` | SAML 2.0 assertion consumer |
| `LdapProvider` | LDAP bind authentication |
| `ApiKeyProvider` | Static API key validation |

A Provider:
- depends on **MosaiX ports** (`IdentityStore`, `SessionStore`, `CredentialStore`, `SecretsPort`, `HttpPort`, …)
- does **not** depend on infrastructure frameworks (Express, Fastify, React, PostgreSQL, Redis, …)
- is registered in `ProviderRegistry`
- is selected by the application through `auth.authenticate({ provider: "local" })`

### Adapter (Technical Implementation)

An **Adapter** implements a **technical dependency** for a port.

It answers: *"How does MosaiX talk to the outside world?"*

| Adapter | Port | Technology |
|---------|------|------------|
| `database-postgres` | `DatabasePort` | PostgreSQL |
| `cache-redis` | `CachePort` | Redis |
| `email-ses` | `EmailPort` | AWS SES |
| `secrets-env` | `SecretsPort` | Environment variables |
| `crypto-node` | `CryptoPort` | Node.js `crypto` |
| `http-fetch` | `HttpPort` | Global `fetch` |

An Adapter:
- implements a **port interface**
- is injected at runtime via DI
- can be swapped without changing the bounded context

### Why the distinction matters

In classic hexagonal architecture, a Provider **is** an adapter (an authentication mechanism adapter).

MosaiX chooses a **two-level vocabulary** because:

```text
Application
    │
    ▼
@mosaix/auth           ← bounded context (core)
    │
    ├── ProviderRegistry
    │       ├── LocalPasswordProvider   ← strategy
    │       ├── OidcProvider            ← strategy
    │       └── WebAuthnProvider        ← strategy
    │
    └── ports (via DI)
            ├── IdentityStore     ← abstraction
            ├── SessionStore      ← abstraction
            └── CredentialStore   ← abstraction
                    │
                    ▼
            @mosaix/adapters      ← technical implementations
                    ├── PostgresIdentityStore
                    ├── RedisSessionStore
                    └── …
```

**Provider = métier (stratégie d'authentification)**  
**Adapter = technique (implémentation d'un port)**

This matches the MosaiX platform motto:

> *The Kernel orchestrates. Identity knows identities. Auth authenticates. Core authorizes. The adapters talk to external systems.*

## Anti-patterns to avoid

❌ **Do not** put `node:crypto`, `fetch`, database drivers, or HTTP servers inside `@mosaix/auth` core.  
❌ **Do not** make `@mosaix/auth` depend on `@mosaix/adapters/*` directly.  
✅ **Do** inject ports via DI.  
✅ **Do** keep providers strategy-only.
