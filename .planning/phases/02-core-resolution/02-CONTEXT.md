# Phase 2: Core Resolution - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the **runtime resolution kernel** for the generic theme ABI (Phase 1):
given a `ThemeResolutionContext` (target + preferences + optional precedence),
the kernel resolves which theme applies â€” entity-first
(`entity > user > application > platform/default`), themeId/mode decoupled
â€” from a single target registry (bootstrap-only registration, capability-aware)
and a theme assignments store (port + in-memory implementation), then resolves
the manifest's `extends` inheritance graph (DFS, cycle â†’ error). This phase is
**runtime-only, target-agnostic**: no business entity (`space`, `store`, â€¦)
appears in types or fixtures, no compiler/injector/SDK/shell (Phases 3â€“5). No
persistence, tenant inheritance, or Governance Catalog (all deferred per
invariant #7 / roadmap Phase 2+).

</domain>

<decisions>
## Implementation Decisions

### Precedence & themeId/mode decoupling

- **D-13:** Resolution precedence is `entity > user > application > platform/default`
  (roadmap invariant #1, PRD Â§8.1). The resolver follows `ctx.precedence` when
  provided; otherwise the default sequence used.
- **D-14:** themeId is decided first (authority chain), mode second, via a
  decomposed pipeline per invariant #6:
  `resolveTarget â†’ resolveAssignment â†’ resolveThemeId â†’ resolveMode â†’ resolveInheritance`.
  Each step is separately exported, independently testable, and returns a partial/
  intermediate result. `ThemeResolver.resolve()` is the single public entry that
  wires the pipeline.
- **D-15:** `source` on the final `ThemeResolution`/`ResolvedTheme` records WHICH
  step won the themeId (`entity`/`application`/`platform`); a user-configured
  mode is recorded through the mode step, never through `themeId`. No source mix.

### Registry (THEME-04)

- **D-16:** ONE `ThemeTargetRegistry` fed by two surfaces (declarative
  registration from app manifests + programmatic `register()`), never two
  registries (PRD Â§4.2b). Capabilities per target type:
  `userSelectable` / `adminConfigurable`. Registration is **bootstrap-only**:
  `ThemeResolver.resolve()` never registers/creates targets implicitly
  (invariant #5 / roadmap criterion #4).
- **D-17:** Unregistered target type in `resolve()` â†’ deferred to resolution
  (handled as absent-entity source step), NOT a registry error; registry only
  knows capabilities, never business types.

### Assignments store (THEME-06)

- **D-18:** `ThemeAssignmentsStore` is a **port** (contract in
  `@mosaix/contracts` theme family, per repo conventions) with an
  **in-memory implementation** in this phase (invariant #7 â€” persistence,
  Governance, tenant inheritance, backend storage out of scope here). API:
  `assign(assignment)` / `unassign(target)`, `get(target)`, `list()`, and it
  publishes `themeAssignmentChangedEvent` on mutation (THEME-06, roadmap
  criterion #5).

### Inheritance (THEME-07)

- **D-19:** `ThemeInheritanceResolver` resolves the static `extends` graph by
  **DFS**, merging parent manifests first (parent-first order), child overlays
  after with a **recursive deep merge** (child scalars/arrays win, nested
  subtrees preserved — CR-01); a cycle in the graph raises `ThemeCycleError`
  (roadmap criterion #6).
- **D-20:** Missing theme id in inheritance â†’ `ThemeNotFoundError` fails-closed
  (resolution-dependent, explicit); resolution/load failures fail-open at the
  `resolve()` API level (robustness â€” experience never crashes), falling back to
  platform/default per PRD Â§14.

### Errors (THEME-12)

- **D-21:** Raise the Phase-2 error set from `@mosaix/contracts` theme errors:
  `ThemeNotFoundError`, `ThemeCycleError`, `ThemeVersionError`,
  `ThemeValidationError` for schema-invalid assignments.
  - `ThemeCompatibilityError` / `ThemeAuthorizationError` are **declared but NOT
    raised** in Phase 2 (roadmap: PHASE-2 errors declared, not raised). Gate
    placed in the code so later phases can raise.
- **D-22:** Errors extend the core error hierarchy (`KernelError` with stable
  `code`), consistent with `packages/core/src/kernel-errors.ts`; theme-specific
  codes use a theme prefix. No string-matching on messages.

### OpenCode's Discretion

- Exact file layout inside `packages/core/src/theme/` and where the port
  interface lives (must be importable by core without Zod; keep contracts
  type-only). `resolveTarget` return vs `resolveAssignment` signature, name of
  intermediate pipeline result types, `getOrThrow` vs optional-return helpers
  are at the implementer's discretion as long as the D-14 pipeline contract and
  the roadmap success criteria (idempotent, deterministic, store-aware) hold.
- Whether `ThemeAssignmentsStore` port is a dedicated `packages/ports/theme`
  package or lives in `packages/contracts/src/theme/` â€” pick whichever matches
  the repo's established port pattern (check existing ports; in-memory only).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Governing PRD

- `.project/prd/PRD-0008-theme-system.md` â€” Â§4.2b ThemeTargetRegistry, Â§4.2
  ThemeAssignment, Â§4.5 ThemeResolutionContext, Â§8 Resolution (precedence +
  pipeline, Â§8.1/8.2), Â§14 Errors, Â§15 SDK-later reference; V2.3 entity-first
- `.planning/ROADMAP.md` â€” Phase 2 goal, 7 success criteria, locked invariants #1â€“8

### Requirements

- `.planning/REQUIREMENTS.md` â€” THEME-04 (registry), THEME-05 (resolver),
  THEME-06 (store), THEME-07 (inheritance), THEME-12 (errors)

### Architecture & prior decisions

- `.project/decisions/ADR-0007-experience-composition-model.md` â€”
  CompositionContext; resolver consumes `target`, never imports it (D-06)
- `.planning/phases/01-theme-contracts-schemas/01-CONTEXT.md` â€” D-01..D-12,
  the theme ABI the resolver consumes
- `.planning/phases/01-theme-contracts-schemas/01-PLAN.md` â€” exact type
  definitions for the contracts the resolver consumes

### Codebase / conventions

- `.planning/codebase/CONVENTIONS.md`, `STRUCTURE.md` â€” core kernel layout,
  `packages/core/src/` organization, naming
- `packages/core/src/kernel-errors.ts` â€” error hierarchy base (KernelError,
  stable `code`) that theme errors extend
- `packages/core/src/capability-registry.ts`, `packages/core/src/event-bus.ts`,
  `apps/identity/src/events/identity-events.ts` â€” registry/event-bus/event-schema
  patterns already in repo
- `packages/ports/database/...` or current `packages/ports/*` — port pattern
  used by repositories

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `@mosaix/contracts` theme family (Phase 1) â€” ThemeTarget, ThemeAssignment,
  ThemePreference, ThemeResolution, ThemeResolutionContext, ResolvedTheme,
  ThemeResolutionSource to consume
- `packages/core/src/event-bus.ts` / `event-schema-registry.ts` â€” where
  `themeAssignmentChangedEvent` / `themeChangedEvent` wire into kernel events
- `packages/core/src/kernel-errors.ts` â€” base error classes for theme errors
- `packages/core/src/capability-registry.ts` â€” registry-with-capabilities and
  entry-tracking pattern mirroring `ThemeTargetRegistry`

### Established Patterns

- Registry-per-capability with explicit `register()`/`resolve()` separation
  (`capability-registry.ts`)
- Event constants + payload schemas keyed by constants (`identity-events.ts`,
  Phase-1 D-12 `themeEventPayloadSchemas`)
- Error classes extend `KernelError` with `code`, `details`, name (kernel-errors)

### Integration Points

- `packages/core/src/index.ts` â€” exports new runtime modules
- `packages/contracts/src/theme/*` â€” new `ThemeTargetRegistry`/store/inheritance
  types are mirrored as contracts only where needed (keep runtime logic in core)
- Zod schemas added in Phase 1 are reused as validators for pipeline
  intermediate types (schemas are contracts; resolver keeps warning-free)

</code_context>

<specifics>
## Specific Ideas

No external-specific requirements beyond PRD/locked invariants â€” Phase 1 gave a
clean, target-agnostic ABI. Acceptance lens: roadmap Phase 2 criteria #2 (Space
â†’ ocean, User preferred=modern/mode=dark â†’ themeId=ocean, mode=dark if ocean
supports dark), #4 (resolve() never creates targets implicitly), #6 (extends
DFS with cycle â†’ ThemeCycleError).

</specifics>

<deferred>
## Deferred Ideas

- **Tenant inheritance** (`tenant` resolution source) â€” deferred to roadmap
  Phase 2 branch / later: requires a separate ADR (Phase-1 D-04 deferred).
- **ThemeAssignmentsStore persistence/backend, Governance** â€” invariant #4:
  backend storage + Governance CLI/Catalog out of kernel.
- **SDK surface (theme.get/watch/resolve/targets)** â€” Phase 4.

</deferred>

---

_Phase: 2-Core Resolution_
_Context gathered: 2026-08-09_
