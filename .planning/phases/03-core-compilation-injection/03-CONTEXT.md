# Phase 3: Core Compilation & Injection - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the compile → inject → notify leg of the theme pipeline in
`@mosaix/core`: a resolved theme compiles to deterministic CSS variables
(`--mx-<group>-<token>`) and hot-switches into Shadow DOM roots ≤ 100 ms,
target-agnostic, without touching global scope.

Artifacts:

- `ThemeCompiler` — pure, deterministic `compile(manifest, mode) → CompiledTheme`
- `ThemeCache` — keyed `themeId+version+mode`, hot-switch ≤ 100 ms (benchmark present)
- `ThemeInjector` — Shadow DOM, batched (> 40 roots via requestAnimationFrame), diff-based
- `ThemeRuntime`/`ThemeService` — bootstrap (load/validate/register, explicit) vs runtime (resolve → compile → inject → notify); never registers targets during resolution; publishes `ThemeChangedEvent` on switch

Requirements: THEME-08, THEME-09, THEME-10, THEME-11

</domain>

<decisions>
## Implementation Decisions

### ThemeCompiler Contract

- `compile(manifest: ThemeManifest, mode: ThemeMode): CompiledTheme` — the compiler needs both tokens AND the mode overlay (PRD §4.6/§8.2), stays target-agnostic (INV-THEME-007); no DOM or I/O
- CSS variable naming: flatten nested groups with `-`, keep token names verbatim — `colors.primary` → `--mx-color-primary`, `spacing.md` → `--mx-space-md`
- Deterministic output: keys sorted alphabetically for byte-stable output
- Value coercion: strings pass through; numbers → `${n}px`; booleans → `"1"`/`"0"`; other primitives rejected with `ThemeValidationError`

### ThemeCache

- Caches the final `CompiledTheme`, keyed by `themeId+version+mode` (compile is the costly step; resolution stays cheap)
- LRU-bounded (~100 entries), explicit `get`/`set`/`clear`/`invalidate` API
- No auto-invalidation wiring in Phase 3 (Phase-4 runtime may subscribe); `invalidate(themeId, version, mode)` is public

### ThemeInjector

- `register(root)` → internal `Set` of roots; `inject(compiled)` applies per root; never touches `document`/global scope
- Diff-based updates: compare previous vs new `CompiledTheme`; `setProperty` only changed vars; unset removed vars
- Batching: requestAnimationFrame-deferred flush when pending roots ≥ 40; immediate below threshold
- Accepts `HTMLElement` or `ShadowRoot` roots

### ThemeRuntime Facade

- `ThemeRuntime` class separating bootstrap (`load`/`validate`/`registerTheme`/`registerTarget` — all explicit) from runtime (`resolve` → `compile` → `inject` → `notify`)
- Publishes `theme.changed` after injection via injected `DomainEventBus` (D-11/D-12 — Phase 3 is the event-wiring point; schema from `@mosaix/schemas`)
- Resolution path contains no `register` call; a test asserts the invariant
- Inject failure raises `ThemeInjectionError` (THEME-12 — declared in Phase 2 per D-21, now raised)

### OpenCode's Discretion

- Exact file layout inside `packages/core/src/theme/`
- Whether ThemeRuntime owns the cache/injector composition or accepts them as injected collaborators
- Benchmark harness shape (vitest bench vs script) as long as it's present and demonstrates ≤ 100 ms

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/core/src/theme/theme-resolver.ts` — `ResolvedTheme` producer, pure-function export style, `DEFAULT_THEME_PRECEDENCE`, fail-open two-layer policy
- `packages/core/src/theme/theme-errors.ts` — `KernelError`-derived 6-code union incl. `ThemeInjectionError` (declared, now raised)
- `packages/core/src/event-bus.ts` — `DomainEventBus` + `EventSchemaRegistry` (ADR-0003) for `theme.changed` publishing
- `packages/contracts/src/theme/` — `ResolvedTheme`, `ThemeManifest`, `DesignTokens`, `ThemeMode`, `themeChangedEvent`/`ThemeChangedPayload` (already defined)
- `packages/schemas/src/theme.ts` — `ThemeChangedPayloadSchema` (strict) to validate emits

### Established Patterns

- Pure exported functions per pipeline step (resolver 02-03), class + factory for stateful pieces (store 02-02, registry 02-01)
- Errors extend `KernelError` with stable code; fail-open/fail-closed two-layer policy
- Strict TS (`exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Vitest 3, co-located tests, JSDoc headers
- Downward-only dependency direction core → contracts → types

### Integration Points

- `packages/core/src/index.ts` — barrel-export new compile/inject/runtime modules
- `packages/core/src/theme/` — theme family directory
- `packages/schemas/src/theme.ts` — event payload schemas for `theme.changed`
- Phase-4 SDK `theme.*` will consume `ThemeRuntime` (next phase)

</code_context>

<specifics>
## Specific Ideas

- Hot-switch benchmark must exist and demonstrate ≤ 100 ms (roadmap criterion #2)
- `--mx-` prefix is the deterministic ABI the Shell (Phase 5) consumes
- Compiler must stay target-agnostic: `compile` never sees a `ThemeTarget` (INV-THEME-007)

</specifics>

<deferred>
## Deferred Ideas

- Auto-invalidation of cache via `theme.changed` subscription — deferred to Phase 4 runtime wiring
- ThemeRuntime persistence / Governance / UI — invariant #4, Phase 2+
- `ThemeCompatibilityError`/`ThemeAuthorizationError` raise sites — Phase-3 Governance PolicyResolver per D-21
</deferred>
