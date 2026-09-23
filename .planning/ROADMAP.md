# Roadmap: MosaiX Theme System — Phase 1 (Core + SDK + Shell)

## Overview

Deliver a generic theme resolution engine for the MosaiX ecosystem: a project declares themeable entities as `ThemeTarget = { type, id }`, assigns theme artifacts, and the kernel resolves (entity-first, themeId/mode decoupled), compiles (pure, deterministic CSS variables), and injects (Shadow DOM, ≤ 100 ms hot-switch) the theme — end-to-end through the Shell bridge (`ThemeContext` / `useTheme` / `ExperienceThemeBridge`) — without the Theme System knowing any business entity. Phase 1 is contracts → core resolution → core compile/inject → SDK → shell → conformance. UI package, Governance Catalog, persisted store, and tenant/parent inheritance are Phase 2+.

## Locked Invariants (implementation contract)

Verified by the user (2026-08-08). These are non-negotiable for implementation:

1. **Precedence Phase 1 :** `entity > user > application > platform/default`.
2. **Theme identity et mode sont découplés.** Une assignment d'entité détermine prioritairement le `themeId`. La préférence utilisateur ne peut pas remplacer ce `themeId`, mais peut déterminer le `mode` du thème assigné **si celui-ci supporte le mode demandé**.
   Exemple : `Space → ocean`, `User → preferred=modern, mode=dark` ⇒ `themeId=ocean`, `mode=dark` si `ocean` supporte dark.
3. **Ne pas faire rejeter `ThemePreference` par Zod parce qu'une entity assignment existe.** Le schema valide la structure du contrat. La precedence est une responsabilité du `ThemeResolver`, puisqu'elle dépend du runtime context.
4. **`ThemeTarget` reste totalement générique :** `{ type: string; id: string }`. Aucun `space`, `store`, `organization`, etc. dans `@mosaix/core/theme`.
5. **Target registration et resolution sont séparés.** `ThemeTargetRegistry.register()` intervient au bootstrap/configuration. `ThemeResolver.resolve()` consomme ensuite le target présent dans `CompositionContext`; il ne crée jamais implicitement de target.
6. **Le resolver doit séparer explicitement :** `resolveTarget → resolveAssignment → resolveThemeId → resolveMode → resolveInheritance → compile`.
7. **`ThemeAssignmentsStore` reste un port avec une implémentation in-memory en Phase 1/2.** La persistence, Governance Catalog, tenant inheritance et backend storage restent hors du kernel.
8. **Le Theme Runtime reste agnostique des entités métier.** Le fait que `Space` soit le premier cas d'utilisation ne doit apparaître ni dans les types du kernel ni dans ses tests de conformance. Les fixtures doivent utiliser des targets comme `store`, `brand` ou `workspace`.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Theme Contracts & Schemas** - Generic theme ABI + Zod validators, additive over existing `theme/*` (completed 2026-08-08)
- [x] **Phase 2: Core Resolution** - TargetRegistry, AssignmentsStore, entity-first Resolver, inheritance, errors (completed 2026-08-09)
- [x] **Phase 3: Core Compilation & Injection** - Pure Compiler, Cache, Shadow-DOM Injector, ThemeRuntime facade (completed 2026-08-10)
- [ ] **Phase 4: SDK theme.\*** - Three-level developer API, no direct token mutation
- [ ] **Phase 5: Shell Bridge** - ThemeContext / useTheme / ExperienceThemeBridge end-to-end consumption
- [ ] **Phase 6: Conformance & DoD** - No business refs, fixtures, cycle tests, ≤100ms benchmark, `pnpm check` green

## Phase Details

### Phase 1: Theme Contracts & Schemas

**Goal**: A project can declare and validate a generic theme ABI without the Theme System knowing any business entity
**Depends on**: Nothing (foundation)
**Requirements**: THEME-01, THEME-02, THEME-03
**Success Criteria** (what must be TRUE):

1. `@mosaix/contracts` exposes generic contracts (`ThemeTarget`, `ThemeAssignment`, `ThemePreference`, `ThemeResolutionSource`, `ThemeResolutionContext`, `ThemeResolution`, `ResolvedTheme`, `CompiledTheme`) and `ThemeManifest` gains `modes` — all existing `theme/*` exports still work (additive, no break)
2. `ThemeResolution` locks the themeId/mode decoupling: `{ themeId, mode, source }` where `source: "entity" | "user" | "application" | "platform"` — the codebase never mixes _which theme_ vs _which mode_ vs _why chosen_
3. `@mosaix/schemas` validates every new contract with `.strict()` deterministic Zod. A `ThemePreference` is valid independently of entity assignments — the schema only validates structure; precedence is the resolver's responsibility, never the schema's
4. Theme events (`ThemeAssignmentChangedEvent`, `ThemeChangedEvent`) are declared and wired to the schema registry
5. A developer reading `@mosaix/contracts` can author a theme target for a _custom_ entity type (`store`, `brand`, …) with zero reference to any business code
   **Plans**: 1 plan file (3 plan items)

Plans:

- [x] 01-PLAN.md — item 01-01: Theme contracts (generic types + `modes` + `ThemeResolution` source + legacy rename)
- [ ] 01-PLAN.md — item 01-02: Theme events (typed payloads + `theme.assignment.changed` / `theme.changed` constants)
- [ ] 01-PLAN.md — item 01-03: Zod schemas + `themeEventPayloadSchemas` map + exports + index

### Phase 2: Core Resolution

**Goal**: Given a `CompositionContext.target`, the kernel resolves which theme applies (entity-first, themeId/mode decoupled) from a single registry and store
**Depends on**: Phase 1
**Requirements**: THEME-04, THEME-05, THEME-06, THEME-07, THEME-12
**Success Criteria** (what must be TRUE):

1. A developer registers a custom target type (e.g. `store`) declaratively (manifest) and programmatically (SDK) — both surfaces feed ONE `ThemeTargetRegistry`, with `userSelectable`/`adminConfigurable` capabilities respected
2. Assigning a theme to an entity wins over the user preference; the user preference only selects `mode` within the assigned theme's supported modes (e.g. `Space → ocean`, `User → preferred=modern, mode=dark` ⇒ `themeId=ocean`, `mode=dark` if `ocean` supports dark)
3. `ThemeResolver` exposes a decomposed pipeline — `resolveTarget() → resolveAssignment() → resolveThemeId() → resolveMode() → resolveInheritance()` — each a separate, testable step returning a `ResolvedTheme` carrying `source`; idempotent and cache-aware
4. `ThemeResolver.resolve()` never registers or creates targets implicitly — registration happens at bootstrap via `ThemeTargetRegistry.register()`; resolution only consumes `CompositionContext.target`
5. `ThemeAssignmentsStore` assign/unassign works in-memory behind a port and publishes `ThemeAssignmentChangedEvent`
6. `extends` chains resolve via DFS; a cycle raises `ThemeCycleError`; missing theme raises `ThemeNotFoundError`
7. Resolution/load failures fail open (robustness) — the experience never crashes on a theme error
   **Plans**: written — `.planning/phases/02-core-resolution/02-01-PLAN.md` … `02-04-PLAN.md`

Plans:

- [x] 02-01: ThemeTargetRegistry (declarative + programmatic, capabilities, bootstrap-only registration)
- [x] 02-02: ThemeAssignmentsStore (port + in-memory implementation)
- [x] 02-03: ThemeResolver pipeline (resolveTarget → resolveAssignment → resolveThemeId → resolveMode → resolveInheritance)
- [x] 02-04: ThemeInheritanceResolver + error hierarchy

### Phase 3: Core Compilation & Injection

**Goal**: A resolved theme compiles to deterministic CSS variables and hot-switches into Shadow DOM roots ≤ 100 ms
**Depends on**: Phase 2
**Requirements**: THEME-08, THEME-09, THEME-10, THEME-11
**Success Criteria** (what must be TRUE):

1. `ThemeCompiler.compile(tokens, mode)` is pure and deterministic (`--mx-<group>-<token>`) with no DOM or I/O; target-agnostic
2. `ThemeCache` keyed by `themeId+version+mode` serves repeat resolutions; hot-switch from one theme to another completes ≤ 100 ms (benchmark present)
3. `ThemeInjector` applies to Shadow DOM roots without touching global scope; > 40 roots batched via `requestAnimationFrame`; updates are diff-based
4. `ThemeRuntime`/`ThemeService` separates **bootstrap** (load themes → validate → register themes → register targets, all explicit) from **runtime** (resolve → compile → inject → notify); it never registers targets during resolution; publishes `ThemeChangedEvent` on switch
   **Plans**: 4 plans

Plans:

- [x] 03-01: ThemeCompiler (pure, deterministic)
- [x] 03-02: ThemeCache (keyed, ≤100ms hot-switch)
- [x] 03-03: ThemeInjector (Shadow DOM, batched, diff)
- [x] 03-04: ThemeRuntime facade (bootstrap vs runtime separation + events)

### Phase 4: SDK theme.\*

**Goal**: A project developer consumes resolution/assignment via three progressive API levels without mutating tokens directly
**Depends on**: Phase 3
**Requirements**: THEME-13
**Success Criteria** (what must be TRUE):

1. `theme.get()` (read resolved theme) and `theme.watch()` (subscribe to changes) work for a consumer app
2. `theme.resolve(ctx)` returns the resolved+compiled theme for an arbitrary target context
3. `theme.targets.register/list/get` and `theme.assign/unassign` (level 3, admin) route through the registry and store with permission checks — no direct token mutation surface exists
4. All SDK errors surface the typed `ThemeError` hierarchy
   **Plans**: TBD

Plans:

- [ ] 04-01: SDK L1 (get / watch)
- [ ] 04-02: SDK L2 (resolve)
- [ ] 04-03: SDK L3 (targets + assign/unassign, admin)

### Phase 5: Shell Bridge

**Goal**: The Shell consumes a `CompiledTheme` end-to-end for any target, agnostic of the business type
**Depends on**: Phase 4
**Requirements**: THEME-14
**Success Criteria** (what must be TRUE):

1. `ThemeContext` exposes the current `CompiledTheme` + mode to Shell components
2. `useTheme()` hook returns theme values that re-render on `ThemeChangedEvent`
3. `ExperienceThemeBridge` maps `CompositionContext.target` → resolution → `ThemeContext`, so switching target updates the applied theme live
4. The Shell renders a themed surface without referencing any business entity type
   **Plans**: TBD

Plans:

- [ ] 05-01: ThemeContext + useTheme
- [ ] 05-02: ExperienceThemeBridge (target → resolution → context)

### Phase 6: Conformance & DoD

**Goal**: Phase-1 DoD is verified — generic, cycle-safe, fast, green
**Depends on**: Phase 5
**Requirements**: THEME-15
**Success Criteria** (what must be TRUE):

1. Static check confirms no business-entity types or references (`space`, `store`, `organization`, …) anywhere in `@mosaix/core/theme` — neither types nor conformance tests mention `Space` as a known target
2. Fixtures exercise ≥ 2 custom target types such as `store`, `brand`, `workspace` through resolve→compile→inject
3. `extends` chains tested with and without cycle; cycle → `ThemeCycleError`
4. Hot-switch benchmark ≤ 100 ms asserted; `pnpm check` (build + lint + test) green
   **Plans**: TBD

Plans:

- [ ] 06-01: No-business-ref conformance check (types + conformance tests)
- [ ] 06-02: Fixtures (store/brand/workspace) + cycle tests + benchmark
- [ ] 06-03: Full `pnpm check` green + docs sync

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase                           | Plans Complete | Status      | Completed  |
| ------------------------------- | -------------- | ----------- | ---------- |
| 1. Theme Contracts & Schemas    | 1/1            | Complete    | 2026-08-08 |
| 2. Core Resolution              | 4/5            | Complete    | 2026-08-09 |
| 3. Core Compilation & Injection | 4/4            | Complete    | 2026-08-10 |
| 4. SDK theme.*                  | 0/3            | Not started | -          |
| 5. Shell Bridge                 | 0/2            | Not started | -          |
| 6. Conformance & DoD            | 0/3            | Not started | -          |
