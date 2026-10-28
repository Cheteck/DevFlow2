# Backlog: In-Memory Adapter Remediation

## Objective
Remove unconditional in-memory storage/adapter instantiations in `@mosaix/core` kernel and application presentation layers (`apps/portfolio`, `apps/commerce`), enforcing `InMemoryGuard` safeguards.

## Status
- [x] KernelOptions update in `packages/core/src/kernel-module.ts` (already compliant)
- [x] `ObservabilityModule` refactoring to use `InMemoryGuard.reportFallback` in `packages/core/src/modules/observability-module.ts`
- [x] `apps/portfolio/src/presentation/portfolio-view.ts` updated to wrap `new InMemoryVendableRepository()` with `InMemoryGuard.reportFallback("VendableRepository")`
- [x] Ensure backward compatibility of `KernelOptions`
- [x] Verify `Kernel` and application tests still pass successfully when options/services are provided vs when fallback triggers in dev mode.

## Changes
- Updated `ObservabilityModule` (in `packages/core/src/modules/observability-module.ts`) to use `InMemoryGuard` for fallbacks.
- Updated `apps/portfolio/src/presentation/portfolio-view.ts` fallback path to report via `InMemoryGuard.reportFallback("VendableRepository", ...)` instead of instantiating `InMemoryVendableRepository` silently in production/strict environments.
- Verified all unit and integration tests under `apps/portfolio` and `apps/commerce` pass successfully.

## Impact
- Core runtime and applications become stricter about in-memory storage/adapters in production or when demo mode is disabled.
- Developers must explicitly provide persistent infrastructure in production environments or set `ALLOW_IN_MEMORY_IN_PRODUCTION=true`.
