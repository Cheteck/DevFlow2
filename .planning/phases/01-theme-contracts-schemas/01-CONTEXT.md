# Phase 1: Theme Contracts & Schemas - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a generic theme ABI in `@mosaix/contracts` plus deterministic Zod
validators in `@mosaix/schemas`, so a project can declare and validate theme
contracts without the Theme System knowing any business entity. This phase is
the type-only foundation — no runtime resolution, compilation, or injection
(those are Phases 2–3). All additions must be additive over the existing
`theme/*` surface (`ThemeManifest`, `DesignTokens`, `AccessibilityProfile`,
`ThemeAssets`) with zero breaking changes.

</domain>

<decisions>
## Implementation Decisions

### ThemePreference naming (legacy collision)

- **D-01:** The new generic `ThemePreference` (`theme/theme-preference.ts`)
  becomes the canonical exported name from `@mosaix/contracts` index.
- **D-02:** The legacy `experience/theme-contract.ts` `ThemePreference`
  (`{ inherit, supports, preferred? }`) is renamed to `ExperienceThemePreference`
  and kept exported under a deprecated alias so `ExperienceContract` and
  `ApplicationExperienceContract` still compile. No existing consumer breaks.
- **D-03:** Legacy experience contracts are NOT extended for theme (pre-ADR-0007
  model, per STRUCTURE.md anti-patterns).

### ThemeResolutionSource union

- **D-04:** Phase 1 defines `ThemeResolutionSource = "entity" | "user" | "application" | "platform"`
  exactly per success criteria #2. `"tenant"` and `"default"` are deferred to
  Phase 2 (tenant inheritance requires a separate ADR; robustness fallback is a
  resolver concern, not a Phase-1 contract).

### Resolution types

- **D-05:** `ThemeResolution = { themeId: string; mode: ThemeMode; source: ThemeResolutionSource }`
  — a lightweight decision record locking the themeId/mode decoupling (the
  _which / which-mode / why_ triad). Never mixes identity with preference.
- **D-06:** `ThemeResolutionContext = { target: ThemeTarget; userPreference?: ThemePreference; applicationPreference?: ThemePreference; precedence?: ThemeResolutionSource[] }`
  — a narrow, theme-scoped input. Standalone type: no dependency on the
  not-yet-implemented ADR-0007 `CompositionContext`.
- **D-07:** `ResolvedTheme = { target?: ThemeTarget; themeId: string; version: string; mode: ThemeMode; manifest: ThemeManifest }`
  per PRD §4.6 — the manifest is the `extends`-resolved final manifest
  (resolution result), distinct from the lightweight `ThemeResolution` record.

### ThemeManifest.modes semantics

- **D-08:** `modes?: { light?: DesignTokens; dark?: DesignTokens }` — partial
  `DesignTokens` overlays merged deterministically over base `tokens` at
  compile time. No full per-mode duplication.
- **D-09:** Only `light` and `dark` are mode overlay keys. `"system"` is a
  resolution-time preference between light/dark — never a token overlay.
- **D-10:** Additive: existing `ThemeManifest` fields (`tokens`, `extends`,
  `assets`, `accessibility`) unchanged.

### Event schema wiring

- **D-11:** `ThemeAssignmentChangedEvent` and `ThemeChangedEvent` are declared
  in `@mosaix/contracts` with typed payloads and event type constants
  (`theme.assignment.changed`, `theme.changed`).
- **D-12:** `@mosaix/schemas` exports strict Zod payload schemas plus a
  `themeEventPayloadSchemas` map keyed by event type, structurally compatible
  with core's `PayloadValidator` (`{ safeParse }`) — mirroring the identity
  event pattern (`apps/identity/src/events/identity-events.ts`). No core
  dependency from schemas. Actual registration into the kernel
  `EventSchemaRegistry` happens in later phases when the resolver emits.

### OpenCode's Discretion

- File layout inside `packages/contracts/src/theme/` and `packages/schemas/src/`
  (split per contract vs single files) is at OpenCode's discretion, following
  existing conventions. Exact JSDoc/gov references follow package norms.
- Whether `ThemeMode` is a shared alias (`"light" | "dark" | "system"`) exported
  once and reused is at OpenCode's discretion (recommended to avoid drift).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Governing PRD & invariants

- `.project/prd/PRD-0008-theme-system.md` — authoritative spec (V2.3): §4.1 ThemeTarget, §4.2 ThemeAssignment, §4.2b ThemeTargetRegistry, §4.3 ThemePreference, §4.5 ThemeResolutionSource, §4.6 ResolvedTheme/CompiledTheme, §4.8 ThemeManifest.modes, §13 Events, §18 DoD
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 items) + 8 locked implementation invariants
- `.planning/REQUIREMENTS.md` — THEME-01, THEME-02, THEME-03

### Architecture

- `.project/decisions/ADR-0007-experience-composition-model.md` — `CompositionContext` (ratified, not implemented); Phase 1 must not depend on it
- `.project/decisions/ADR-0001-*.md` — contracts/schemas layering (contracts type-only; core never imports Zod directly)

### Codebase conventions & patterns

- `.planning/codebase/CONVENTIONS.md` — naming, import order, type-only imports (`verbatimModuleSyntax`), JSDoc headers, error hierarchy
- `.planning/codebase/STRUCTURE.md` — package layout; `theme/*` and `schemas/src/theme.ts` are the additive base
- `packages/contracts/src/theme/*` — existing contracts to extend
- `packages/schemas/src/theme.ts` — existing Zod validators to extend
- `packages/contracts/src/experience/theme-contract.ts` — legacy `ThemePreference` (rename + alias)
- `apps/identity/src/events/identity-events.ts` — event payload schema map pattern (D-12)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/contracts/src/theme/theme-manifest.ts` — `ThemeManifest` to gain `modes`
- `packages/contracts/src/mosaix-artifact.ts` — `MosaixArtifactManifest` base
- `packages/schemas/src/theme.ts` — `ThemeManifestSchema`/`DesignTokensSchema`/`ThemeAssetsSchema` to extend
- `packages/contracts/src/events/event-contract.ts` — envelope types from `@mosaix/types`
- `packages/contracts/src/index.ts` — barrel; `export type { ThemePreference }` at line 72 must be updated

### Established Patterns

- Type-only contracts in `packages/contracts/src/<family>/`, barrel `index.ts`
- Zod `.strict()` validators in `packages/schemas/src/`, re-exported via index
- Event payload schemas as a map structurally compatible with `PayloadValidator` (identity pattern)
- `import type` mandatory for type-only imports; kebab-case filenames; UPPER_SNAKE_CASE event constants

### Integration Points

- `packages/contracts/src/index.ts` — new theme exports (ThemeTarget, ThemeAssignment, ThemePreference, ThemeResolutionSource, ThemeResolutionContext, ThemeResolution, ResolvedTheme, CompiledTheme) + ThemePreference rename
- `packages/schemas/src/index.ts` — new schema exports + theme event payload schemas
- `packages/contracts/src/experience/*` — `ExperienceThemePreference` alias must keep `ExperienceContract`/`ApplicationExperienceContract` compiling

</code_context>

<specifics>
## Specific Ideas

No specific additional requirements beyond the PRD/locked invariants — the
phase is well-specified. Success criteria #5 (a developer can author a theme
target for a _custom_ entity type with zero business references) is the
acceptance lens for the generic contracts.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 1-Theme Contracts & Schemas_
_Context gathered: 2026-08-08_
