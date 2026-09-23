# MosaiX Theme System — Phase 1

## What This Is

A generic theme resolution engine for the MosaiX composable application ecosystem: an artifact `Theme` can be associated with any entity a project declares as themeable, and the kernel resolves, compiles and injects the theme — **agnostic of every business entity** (`space`, `store`, `organization`, `community`, … are all just `ThemeTarget = { type, id }`). Phase 1 delivers the runtime core (`@mosaix/core`), the SDK `theme.*` API, and the shell bridge (`src/shell/theme`) that lets the Shell consume a `CompiledTheme` end-to-end without knowing the business type.

The governing document is `.project/prd/PRD-0008-theme-system.md` (V2.3, proposition — this GSD project ratifies its Phase-1 scope via requirements).

## Core Value

**A project can theme any entity it declares, without the Theme System knowing anything about that entity** — entity-first resolution (`entity > user > application > platform/default`) with the user's preference limited to `mode`, never overriding identity.

## Requirements

### Validated

Inferred from the existing codebase (`.planning/codebase/`, `2026-08-08`):

- ✓ `ThemeManifest` / `DesignTokens` / `AccessibilityProfile` / `ThemeAssets` contracts exist — `packages/contracts/src/theme/` — existing
- ✓ `ThemeManifestSchema` / `DesignTokensSchema` / `ThemeAssetsSchema` Zod validators exist — `packages/schemas/src/theme.ts` — existing
- ✓ `MosaixArtifactManifest` base + versioning discipline — `packages/contracts/src/mosaix-artifact.ts` — existing
- ✓ Kernel module system (ADR-0002), `KernelContext`, typed error hierarchy (`KernelError`) — `packages/core/src/` — existing
- ✓ Event bus / schema registry / publish-subscribe with permission checks (ADR-0003) — `packages/core/src/event-bus.ts` — existing
- ✓ ADR-0007 ratified: `CompositionContext` (with `target?: ThemeTarget` — G4/Q-T-8 locked), `PolicyResolver` single evaluation chain, App→…→Renderer composition model — `.project/decisions/ADR-0007-experience-composition-model.md` — existing (contracts not yet implemented)
- ✓ Strict TS (`exactOptionalPropertyTypes`, `verbatimModuleSyntax`), ESLint + boundaries enforcement, Vitest 3 — existing tooling
- ✓ Downward-only dependency direction `apps → sdk → core → schemas → contracts → types` enforced by `eslint-plugin-boundaries` — existing

### Active

Phase-1 scope (Core + SDK + Shell, per PRD-0008 V2.3):

- [ ] Generic theme contracts: `ThemeTarget`, `ThemeAssignment`, `ThemePreference`, `ThemeResolutionSource`, `ThemeResolutionContext`, `ResolvedTheme`, `CompiledTheme`, `ThemeManifest.modes` — in `@mosaix/contracts`
- [ ] Theme events: `ThemeAssignmentChangedEvent`, `ThemeChangedEvent` — in `@mosaix/contracts`
- [ ] Zod schemas for all new theme contracts (`.strict()`, deterministic) — in `@mosaix/schemas`
- [ ] `ThemeTargetRegistry` — single registry fed by declarative (manifest) + programmatic (SDK) surfaces; `userSelectable` / `adminConfigurable` capabilities per target type
- [ ] `ThemeResolver` — entity-first precedence (`entity > user > application > platform/default`), **decoupled themeId vs mode resolution**, idempotent, cache-aware
- [ ] `ThemeAssignmentsStore` — in-memory implementation in Phase 1 (assign/unassign + events operational); port defined, persisted adapter deferred to Phase 2
- [ ] `ThemeInheritanceResolver` — static `extends` graph, DFS, cycle → `ThemeCycleError`
- [ ] `ThemeCompiler` — pure, no DOM/I/O, deterministic CSS-variable mapping `--mx-<group>-<token>`
- [ ] `ThemeCache` — keyed by `themeId+version+mode`, hot-switch ≤ 100 ms
- [ ] `ThemeInjector` — Shadow DOM injection, batched, no global scope; diff computed; > 40 roots → `requestAnimationFrame`
- [ ] `ThemeRuntime`/`ThemeService` facade in `@mosaix/core` — load/validate/registerTarget/resolve/compile/inject/notify lifecycle
- [ ] Theme error hierarchy — `ThemeValidationError`, `ThemeNotFoundError`, `ThemeVersionError`, `ThemeCycleError`, `ThemeInjectionError` (+ Phase-2: `ThemeCompatibilityError`, `ThemeAuthorizationError` fail-closed)
- [ ] SDK three levels: `theme.get()` / `theme.watch()` (level 1), `theme.resolve(ctx)` (level 2), `theme.targets.register/list/get` + `theme.assign/unassign` (level 3, admin) — no direct token mutation exposed
- [ ] Shell: `src/shell/theme` — `ThemeContext`, `useTheme`, `ExperienceThemeBridge` — consumption of `CompiledTheme` at the shell boundary, agnostic of business target type
- [ ] DoD conformance: no business-entity references in `@mosaix/core/theme`; fixtures for custom target types; `extends` chains with/without cycle; hot-switch benchmark ≤ 100 ms
- [ ] `@mosaix/ui` package (ThemeProvider/ThemeBoundary/ThemeToggle) — **Phase 2**, out of Phase-1 scope
- [ ] Governance Theme Catalog + Configuration UI + `ThemeCatalogProvider` — **Phase 2+**, out of Phase-1 scope

### Out of Scope

- `@mosaix/ui` React package (ThemeProvider/ThemeBoundary/ThemeToggle) — Phase 2; Phase 1 consumes the theme via the shell bridge instead
- Governance Theme Catalog / preview / assignment UI / `ThemeCatalogProvider` implementation — Control Plane, Phase 2+; the port stays in `core/contracts`
- Persisted `ThemeAssignmentsStore` adapter (Postgres etc.) — Phase 2; Phase 1 uses the in-memory implementation
- Tenant / parent-entity theme inheritance (`Target.parent`) — Phase 2, requires separate ADR (ADR-3)
- `theme.configure:<type>:<id>` policies via `PolicyResolver` (fail-closed authorization on assign) — Phase 2; Phase 1 defines the policy translation point but no authorization decisions (ADR-2)
- Marketplace / distributed Theme Registry / publication & licensing — Phase 3+
- Accessibility engine (AA/AAA), branding/white-label, theme builder, icon/font registries — Phase 3+
- Any Space-specific primitive in the Theme System — architectural invariant (INV-THEME-001/002)

## Context

- **Monorepo**: pnpm workspace, TypeScript ^5.7 ESM, Node 20+, strict TS. Workspace globs: `packages/*`, `packages/ports/*`, `packages/adapters/*`, `apps/*`.
- **Layered stack**: `types → contracts → schemas → core → sdk → apps` (downward-only, ESLint-enforced). `@mosaix/core` never imports Zod directly (via `@mosaix/schemas`, ADR-0001).
- **Existing theme surface**: `packages/contracts/src/theme/{theme-manifest,design-tokens,accessibility,branding}.ts` and `packages/schemas/src/theme.ts` are the V1/V2 base to extend (add `modes`, new contracts; never a parallel set).
- **Composition model**: ADR-0007 is ratified but _not implemented_ — `CompositionContext`, `PolicyResolver`, Surface/Slot/Contribution/Placement are target contracts. The theme system must integrate `target?: ThemeTarget` into the (to-be-built) `CompositionContext` and reuse the single `PolicyResolver` chain for authorization.
- **Ports/adapters are unwired**: 19 ports / 27+ adapters exist but nothing consumes them in the kernel bootstrap yet (dashboard watchpoint T-I1). Theme must not depend on this wiring.
- **Legacy experience contracts** in `@mosaix/contracts/src/experience/` predate ADR-0007 and are expected to be superseded — avoid extending them for theme.
- **Known constraints**: `pnpm install` blocked locally by supply-chain policy (aws-sdk `minimumReleaseAge`); CI (GitHub Actions) exists but inactive (no remote). Test count ~270 across 52 test files (some drift documented in CONCERNS.md).
- **Governance**: project is run via `.project/` protocol (AGENTS.md — ADRs, PRDs, invariants, workflows). This `.planning/` GSD project tracks the Phase-1 implementation. PRD-0008 updated to V2.3 to reflect locked decisions (2026-08-08).

## Constraints

- **Architecture**: Theme kernel must contain no business-entity references (no `if (type === "space")`); `ThemeTarget` is generic `{ type, id }` — INV-THEME-001/002 (PRD-0008 §3). No `space`/`store`/`organization` in `@mosaix/core/theme` types or conformance tests; fixtures use `store`/`brand`/`workspace`
- **Architecture**: `ThemeTargetRegistry` is a contract/resolution registry, not a second kernel (no state, no business execution, no policies in itself) — INV-THEME-006
- **Architecture**: `ThemeCompiler` is target-agnostic: `compile(tokens, mode) → CompiledTheme`, never `compile(entity, theme)` — INV-THEME-007
- **Identity/mode (locked V2.3 + user 2026-08-08)**: entity assignment determines `themeId`; user preference can only set `mode` within the assigned theme's supported modes — never overrides identity. `ThemeResolution = { themeId, mode, source }` locks the decoupling; the codebase never mixes _which theme_ vs _which mode_ vs _why chosen_
- **Schema vs resolver**: a `ThemePreference` is valid independently of entity assignments; Zod validates structure only, precedence is the `ThemeResolver`'s responsibility
- **Registration vs resolution**: `ThemeTargetRegistry.register()` happens at bootstrap/configuration; `ThemeResolver.resolve()` only consumes `CompositionContext.target` — it never creates targets implicitly
- **Resolver pipeline**: decomposed `resolveTarget → resolveAssignment → resolveThemeId → resolveMode → resolveInheritance`
- **Dependency**: `apps → sdk → core → schemas → contracts → types`; core may not depend on projects, `src/`, or a UI framework
- **Purity**: theme compilation is pure (no DOM, no I/O); injection is the only DOM-touching step
- **Compatibility**: Phase-1 contracts additive over existing `theme/*` surface (extend, don't break)
- **Performance**: hot-switch ≤ 100 ms; cache `themeId+version+mode`; diff-based update; > 40 shadow roots batched via `requestAnimationFrame`
- **Security**: authorization on assign fails closed; resolution/load failures fail open (robustness theme, experience never crashes)

## Key Decisions

| Decision                                                                                                                                                                 | Rationale                                                                       | Outcome                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------ |
| Phase 1 = Core + SDK + Shell                                                                                                                                             | Deliver runtime + consumption boundary end-to-end; defer UI package and catalog | ✓ Locked (V2.3)                            |
| `ThemeTarget = { type, id }` generic, no business union                                                                                                                  | Framework must not know project entities; projects declare via registry         | ✓ Locked (V2.1/2.2)                        |
| `CompositionContext.target` (not `themeTarget`)                                                                                                                          | Entity of composition is shared by Theme/Policies/Placements/Renderers          | ✓ Locked (V2.2, G4)                        |
| Entity-first precedence: `entity > user > application > platform/default`                                                                                                | Space-assigned theme is authoritative for its context; user only overrides mode | ✓ Locked (V2.3, ADR-4)                     |
| Decoupled themeId vs mode resolution                                                                                                                                     | Entity sets identity; user/system pick mode within theme capabilities           | ✓ Locked (V2.3, G6)                        |
| `ThemeTargetRegistry` capabilities `userSelectable` / `adminConfigurable`                                                                                                | "Themeable" ≠ "configurable"; project declares, policy enforces                 | ✓ Locked (V2.2, G3)                        |
| Two declaration surfaces feed one registry (declarative + programmatic)                                                                                                  | One resolver, one registry — no second system                                   | ✓ Locked (V2.2)                            |
| In-memory `ThemeAssignmentsStore` in Phase 1, port for Phase 2                                                                                                           | Phase-1 MVP needs assignments for resolution; persistence deferred              | ✓ Locked (V2.3)                            |
| Catalog/Preview/assignment UI in Control Plane, never kernel                                                                                                             | Kernel embeds no UI/catalog/store; port only (Q-T-10)                           | ✓ Locked (V2.2, G5)                        |
| Theme inheritance (`extends`) ≠ entity inheritance (`Target.parent`)                                                                                                     | Two distinct mechanisms; entity inheritance Phase 2 + ADR                       | ✓ Locked (Q-T-9)                           |
| Single `PolicyResolver` chain (ADR-0007) for authorization                                                                                                               | No parallel authorization system; runtime asks, never arbitrates                | ✓ Locked (V2.2)                            |
| 8 implementation invariants (precedence, themeId/mode, schema vs resolver, generic target, registration vs resolution, resolver pipeline, store port, no-Space fixtures) | User-verified implementation contract, 2026-08-08                               | ✓ Locked — see ROADMAP "Locked Invariants" |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-08-08 after initialization (brownfield, PRD-0008 V2.3)_
