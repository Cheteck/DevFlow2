# ADR-0005: Dynamic App Loading & Shell-App Decoupling

## Context
In the early prototype phase of MosaiX, `src/start.ts` and `src/shell/discovery.ts` imported application frontend contributions and page views directly via `src/generated-bac-registry.ts` using static relative imports (`../../apps/*/frontend/src/index.js`).

This created a direct compile-time coupling from the hosting shell to specific Bounded Application Contexts (BACs), violating the hexagonal architecture boundaries and the dependency inversion principle:
1. The shell should only depend on `@mosaix/core`, `@mosaix/contracts`, and standard runtime ports.
2. Applications should be discovered dynamically from their manifests (`mosaix.json`) and loaded through dynamic imports (`import()`) or registered via declarative composition manifests.

## Decision
1. **Dynamic Discovery and Inversion of Control**: The runtime shell uses `ApplicationDiscovery` (`@mosaix/core`) to locate all workspace application contexts and read their declarative manifests (`mosaix.json`).
2. **Dynamic Entrypoint Resolution**: When frontend or backend contributions are needed, the shell dynamically resolves entrypoints defined in the manifest (`runtime.entrypoint` and `experience.frontend.entrypoint`) rather than hardcoding static import lists.
3. **Generated Registry as Transitional Build Artifact**: `src/generated-bac-registry.ts` is treated strictly as an optional generated/transitional aggregator, while the primary architecture transitions to dynamic plugin/app loading managed by `RuntimeKernel` and `ApplicationDiscovery`.

## Status
Accepted.

## Consequences
- **Positive**: Strict boundary enforcement; adding or removing an app does not require modifying the shell core; clean isolation between platform host and tenant applications.
- **Negative**: Dynamic import paths require robust bundle resolution and runtime error boundaries.
