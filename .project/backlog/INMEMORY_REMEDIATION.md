# Backlog: In-Memory Adapter Remediation

## Objective
Remove unconditional in-memory storage/adapter instantiations in `@mosaix/core` kernel and application presentation layers (`apps/portfolio`, `apps/commerce`, `apps/citadelle`), enforcing `InMemoryGuard` safeguards.

## Status (verified 2026-10-31 by direct source inspection)

### ✅ Guarded (InMemoryGuard.reportFallback in constructor)
| Component | File |
|-----------|------|
| `InMemoryUserRepository` | `apps/citadelle/src/infrastructure/in-memory-user-repository.ts:9` |
| `InMemorySecretsAdapter` | `apps/citadelle/src/infrastructure/in-memory-secrets-adapter.ts:8` |
| `InMemorySessionStore` (bootstrap) | `bootstrap/auth-composition.ts:45` |
| `VendableRepository` (presentation) | `apps/portfolio/src/presentation/portfolio-view.ts:55` |
| `Metrics` / `Tracer` (observability) | `packages/core/src/modules/observability-module.ts:42,48` |

### ❌ Unguarded (no InMemoryGuard in constructor)
| Component | File | Risk |
|-----------|------|------|
| `InMemoryTokenStore` | `apps/citadelle/src/infrastructure/in-memory-token-store.ts:3` | silent fallback in prod |
| `InMemorySessionStore` (citadelle) | `apps/citadelle/src/infrastructure/in-memory-session-store.ts:3` | silent fallback in prod |
| `InMemoryIdentityStore` | `apps/citadelle/src/infrastructure/in-memory-identity-store.ts:8` | silent fallback in prod |
| `InMemoryCredentialStore` | `apps/citadelle/src/infrastructure/in-memory-credential-store.ts:4` | silent fallback in prod |
| `InMemoryThemeAssignmentsStore` | `packages/theme/src/in-memory-theme-assignments-store.ts:22` | silent fallback in prod |
| `InMemoryVendableRepository` | `apps/portfolio/src/infrastructure/in-memory-vendable-repository.ts:4` | silent fallback in prod |
| `InMemoryProposalRepository` | `apps/portfolio/src/infrastructure/in-memory-proposal-repository.ts:4` | silent fallback in prod |
| `InMemoryPlatformSettingsStore` | `packages/core/src/platform-settings.ts:126` | default constructor fallback |
| `InMemoryThemeAssignmentsStore` (shell) | `src/shell/theme/theme-bridge.ts:154` | silent fallback in prod |
| `InMemoryThemeAssignmentsStore` (resolver) | `packages/theme/src/theme-resolver.ts:209` | silent fallback in prod |

### ✅ Fail-closed (throws, no in-memory fallback)
| Component | File |
|-----------|------|
| `PortfolioServiceProvider` | `apps/portfolio/src/index.ts:81` |
| `CommerceAppServiceProvider` | `apps/commerce/src/infrastructure/commerce-service-provider.ts:23` |
| `CitadelleServiceProvider` (identity/session/token/credential) | `apps/citadelle/src/index.ts:115` |

### ⚠️ Justified by-design (volatile, not business storage)
| Component | File | Justification |
|-----------|------|---------------|
| `InMemoryRequestDiagnosticsStore` | `packages/core/src/request-diagnostics-store.ts:51` | ring buffer, redacted, diagnostic-only, never source of truth |

### ⚠️ Known gap (documented, not a bug)
| Component | File | Reason |
|-----------|------|--------|
| `InMemoryUserRepository` (citadelle default) | `apps/citadelle/src/index.ts:75` | No Postgres adapter exists yet — backlog `DB-BAC-OWNERSHIP`. Guarded at constructor level, so fail-fast in prod. |

## Impact
- Core runtime and applications become stricter about in-memory storage/adapters in production or when demo mode is disabled.
- Developers must explicitly provide persistent infrastructure in production environments or set `ALLOW_IN_MEMORY_IN_PRODUCTION=true`.

## Next actions
1. Add `InMemoryGuard.reportFallback()` to the 4 unguarded `apps/citadelle` stores (token/session/identity/credential).
2. Add guard to `packages/theme` store + 2 call sites (shell bridge, resolver).
3. Add guard to `apps/portfolio` repositories (vendable/proposal).
4. Add guard to `packages/core` `PlatformSettingsService` default constructor.
5. Re-run full test suite after each batch.