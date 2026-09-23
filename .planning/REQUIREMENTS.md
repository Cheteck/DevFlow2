# Requirements: MosaiX Theme System — Phase 1

**Defined:** 2026-08-08
**Core Value:** A project can theme any entity it declares, without the Theme System knowing anything about that entity — entity-first resolution (`entity > user > application > platform/default`) with the user's preference limited to `mode`, never overriding identity.

Source: `.project/prd/PRD-0008-theme-system.md` (V2.3) and `.planning/PROJECT.md`.

## v1 Requirements

Requirements for Phase 1 (Core + SDK + Shell). Each maps to exactly one roadmap phase.

### Contracts (generic ABI)

- [x] **THEME-01**: Generic theme contracts exist — `ThemeTarget`, `ThemeAssignment`, `ThemePreference`, `ThemeResolutionSource`, `ThemeResolutionContext`, `ThemeResolution` (`{ themeId, mode, source }` — locks themeId/mode decoupling), `ResolvedTheme`, `CompiledTheme`, `ThemeManifest.modes` — in `@mosaix/contracts`, additive over the existing `theme/*` surface (no breaking change)
- [x] **THEME-02**: Theme events declared — `ThemeAssignmentChangedEvent`, `ThemeChangedEvent` — in `@mosaix/contracts` with schema-registry integration
- [x] **THEME-03**: Zod schemas validate every new theme contract (`.strict()`, deterministic) in `@mosaix/schemas`. A `ThemePreference` is **valid independently of entity assignments** — the schema validates structure only; precedence is enforced by `ThemeResolver` at resolution time, never by the schema

### Core Resolution

- [x] **THEME-04**: `ThemeTargetRegistry` — single registry fed by declarative (manifest) + programmatic (SDK) surfaces; `userSelectable` / `adminConfigurable` capabilities per target type; no business-entity knowledge
- [x] **THEME-05**: `ThemeResolver` — entity-first precedence (`entity > user > application > platform/default`), decoupled themeId vs mode resolution, idempotent, cache-aware; exposed as a decomposed pipeline `resolveTarget → resolveAssignment → resolveThemeId → resolveMode → resolveInheritance`; never registers or creates targets implicitly (registration is bootstrap-only)
- [x] **THEME-06**: `ThemeAssignmentsStore` — in-memory implementation (assign/unassign + events operational); port defined, persisted adapter deferred
- [x] **THEME-07**: `ThemeInheritanceResolver` — static `extends` graph, DFS, cycle → `ThemeCycleError`
- [x] **THEME-12**: Theme error hierarchy — `ThemeValidationError`, `ThemeNotFoundError`, `ThemeVersionError`, `ThemeCycleError`, `ThemeInjectionError` (fail-closed; Phase-2 errors `ThemeCompatibilityError`, `ThemeAuthorizationError` declared but not raised)

### Core Compilation & Injection

- [x] **THEME-08**: `ThemeCompiler` — pure, no DOM/I/O, deterministic CSS-variable mapping `--mx-<group>-<token>`
- [x] **THEME-09**: `ThemeCache` — keyed `themeId+version+mode`, hot-switch ≤ 100 ms
- [x] **THEME-10**: `ThemeInjector` — Shadow DOM injection, batched, no global scope; diff computed; > 40 roots → `requestAnimationFrame`
- [x] **THEME-11**: `ThemeRuntime`/`ThemeService` facade in `@mosaix/core` — separates **bootstrap** (load/validate/register themes + register targets, all explicit) from **runtime** (resolve → compile → inject → notify), typed errors; never registers targets during resolution

### SDK

- [ ] **THEME-13**: SDK three levels — `theme.get()` / `theme.watch()` (L1), `theme.resolve(ctx)` (L2), `theme.targets.register/list/get` + `theme.assign/unassign` (L3, admin) — no direct token mutation exposed

### Shell

- [ ] **THEME-14**: Shell bridge — `src/shell/theme` with `ThemeContext`, `useTheme`, `ExperienceThemeBridge` — consumes `CompiledTheme` end-to-end, agnostic of business target type

### Conformance (DoD)

- [ ] **THEME-15**: Phase-1 DoD verified — no business-entity types or references (`space`, `store`, `organization`, …) in `@mosaix/core/theme` (types or conformance tests); fixtures use custom target types (`store`, `brand`, `workspace`); `extends` chains with/without cycle; hot-switch benchmark ≤ 100 ms; `pnpm check` green

## v2 Requirements

Deferred to Phase 2 (Core-2). Tracked but not in current roadmap.

- **UI package** — `@mosaix/ui` with `ThemeProvider`/`ThemeBoundary`/`ThemeToggle`
- **Governance Theme Catalog** — preview, assignment UI, `ThemeCatalogProvider` (Control Plane); `theme.configure` policies (fail-closed authorization via single `PolicyResolver` chain)
- **Persisted store** — `ThemeAssignmentsStore` adapter (Postgres etc.) behind the port
- **Tenant/parent resolution** — entity inheritance (`ThemeTarget.parent`), separate ADR
- **Errors** — `ThemeCompatibilityError`, `ThemeAuthorizationError` raised at runtime

## Out of Scope

| Feature                                          | Reason                                      |
| ------------------------------------------------ | ------------------------------------------- |
| Theme marketplace / distributed registry         | Phase 3+ of strategic roadmap               |
| Accessibility engine (AA/AAA)                    | Phase 3+ (Future Experience System)         |
| Branding / white-label / theme builder           | Phase 3+                                    |
| Icon / font registries                           | Phase 3+                                    |
| Theme-as-package publication & licensing         | Phase 3+                                    |
| Any Space-specific primitive in the Theme System | Architectural invariant (INV-THEME-001/002) |
| Legacy `experience/*` contracts extension        | Superseded by ADR-0007; avoid extending     |

## Traceability

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| THEME-01    | Phase 1 | Complete |
| THEME-02    | Phase 1 | Complete |
| THEME-03    | Phase 1 | Complete |
| THEME-04    | Phase 2 | Complete |
| THEME-05    | Phase 2 | Complete |
| THEME-06    | Phase 2 | Complete |
| THEME-07    | Phase 2 | Complete |
| THEME-12    | Phase 2 | Complete |
| THEME-08    | Phase 3 | Complete |
| THEME-09    | Phase 3 | Complete |
| THEME-10    | Phase 3 | Complete |
| THEME-11    | Phase 3 | Complete |
| THEME-13    | Phase 4 | Pending  |
| THEME-14    | Phase 5 | Pending  |
| THEME-15    | Phase 6 | Pending  |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---

_Requirements defined: 2026-08-08_
_Last updated: 2026-08-08 after initial roadmap creation_
