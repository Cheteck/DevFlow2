# Phase 4: SDK theme.\* - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the `theme.*` developer API in `@mosaix/sdk` — the three
progressive API levels a project developer uses to consume resolution and
assignment, with **no direct token mutation surface** exposed.

Artifacts:

- Level 1: `theme.get()` (read resolved+compiled theme) + `theme.watch()`
  (subscribe to changes via `theme.changed`)
- Level 2: `theme.resolve(ctx)` — resolved+compiled theme for an arbitrary
  target context
- Level 3 (admin): `theme.targets.register/list/get` + `theme.assign/unassign`
  — routed through registry and store with permission checks
- All SDK errors surface the typed `ThemeError` hierarchy

Requirement: THEME-13

</domain>

<decisions>
## Implementation Decisions

### API Object Shape & Access

- `theme` namespace surfaced via `createThemeClient(kernel, tenant, options)` factory returning a `theme` object — mirrors the existing SDK kernel-injection pattern (`MosaixApp.register`)
- `theme.watch()` returns an `Unsubscribe` closure (mirrors `bus.subscribe`)
- The `ThemeClient` instance keeps its last `ThemeApplyOutcome` (client-held state, no re-fetch of unchanged data)
- `createThemeClient` + types exported from the SDK barrel (`packages/sdk/src/index.ts`)

### get() / watch() (Level 1)

- `theme.get(ctx?)` returns the full `ThemeApplyOutcome` `{ resolution, compiled, appliedAt }` — reuses the Phase-3 shape exactly
- `get()` is async — calls `ThemeRuntime.apply(ctx)` (the resolver is async)
- `get(ctx?: Partial<ThemeResolutionContext>)` — optional context; default reads from the client's registered/bound context
- `theme.watch()` emits `ThemeChangedPayload` (subscribed to `theme.changed` via the kernel `DomainEventBus`, client tenant)

### resolve() (Level 2)

- `theme.resolve(ctx)` returns `ThemeApplyOutcome` (resolved+compiled+appliedAt) — same as `get()`
- Signature: `resolve(ctx: ThemeResolutionContext)` with a required target
- Runs the full `apply()` pipeline including injection + notify
- `get()` is a thin wrapper over `resolve(defaultCtx)`

### Level 3 Admin Surface & Permissions

- Per-operation permission strings: `theme.configure:<type>:<id>` for assign/unassign (fail-closed); list/get are read-only
- SDK client holds an injected `can(permission, tenant)` check (factory option); L3 mutation methods consult it and throw `ThemeAuthorizationError` on denial (fail-closed)
- `theme.targets.register(registration)` forwards to the registry (bootstrap surface)
- assign/unassign route through the store (emits `ThemeAssignmentChangedEvent`); NO direct token mutation surface exists anywhere in the SDK

### OpenCode's Discretion

- Exact file layout inside `packages/sdk/src/theme/`
- Whether `ThemeClient` requires core collaborators (registry/store/runtime) as options or constructs them itself (likely: accept injected registry/store/cache/injector/runtime, mirroring `createThemeResolver`/`createThemeRuntime` factories)
- How the default client context is bound (constructor option vs lazy)
- Watch plumbing details (initial emission semantics, cleanup)
</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/sdk/src/index.ts` — existing `MosaixApp` class + helpers; SDDK barrel; eslintBoundaries `sdk`
- `packages/core/src/theme/theme-runtime.ts` — `ThemeRuntime` + `createThemeRuntime` (D-12 wiring, `theme.changed@1.0.0`, `ThemeChangedPublisher` seam, `apply()` pipeline) — the SDK client's core collaborator
- `packages/core/src/theme/theme-target-registry.ts` — `ThemeTargetRegistry` (register/list/get/capabilities)
- `packages/core/src/theme/in-memory-theme-assignments-store.ts` — `InMemoryThemeAssignmentsStore` (assign/unassign, emits `onMutation`)
- `packages/core/src/theme/theme-cache.ts`, `theme-injector.ts`, `theme-compiler.ts` — Phase-3 building blocks (barrel-exported)
- `packages/core/src/theme/theme-errors.ts` — `ThemeError` hierarchy incl. `ThemeAuthorizationError` (declared Phase-2, not yet raised) and `ThemeValidationError`
- `packages/contracts/src/theme/theme-events.ts` — `themeChangedEvent`, `ThemeAssignmentChangedEvent`
- `packages/contracts/src/theme/theme-resolution.ts` — `ThemeResolutionContext`, `ThemePreference`

### Established Patterns

- Class + factory split: `createThemeResolver`/`createThemeRuntime` (factory wires collaborators, class stays simple) — 02-04/03-04 convention
- Errors extend `KernelError` with stable `code`; fail-open/fail-closed two-layer policy
- Strict TS (`exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Vitest 3, co-located tests, JSDoc headers
- Downward-only dependency direction sdk → core → contracts → types
- `MosaixApp` pattern: `static register(config, kernel)` + private constructor; kernel injected

### Integration Points

- `packages/sdk/src/index.ts` — barrel export of `createThemeClient` + types
- `packages/core/src/index.ts` — Phase-3 barrel already exports `ThemeRuntime`, `createThemeRuntime`, registry, store, cache, injector, compiler, errors
- `packages/sdk/src/theme/` — new theme client directory
- Phase-5 Shell (`src/shell/theme`) will consume `createThemeClient`
  </code_context>

<specifics>
## Specific Ideas

- No direct token mutation surface exposed anywhere (roadmap criterion #3) — grep-gated
- All SDK errors surface the typed `ThemeError` hierarchy (roadmap criterion #4) — never bare `Error`
- Assign/unassign are fail-closed on permission (matches INV security posture; `ThemeAuthorizationError` declared in Phase 2 now raised)
</specifics>

<deferred>
## Deferred Ideas

- Token-level mutation APIs — never (out of scope by design)
- Governance catalog/UI integration — Phase 2+ (Control Plane)
- Persisted store adapter, tenant/parent inheritance — Phase 2+

</deferred>
