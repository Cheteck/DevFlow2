---
phase: 01-theme-contracts-schemas
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/contracts/src/theme/theme-mode.ts
  - packages/contracts/src/theme/theme-target.ts
  - packages/contracts/src/theme/theme-assignment.ts
  - packages/contracts/src/theme/theme-preference.ts
  - packages/contracts/src/theme/theme-resolution.ts
  - packages/contracts/src/theme/theme-resolved.ts
  - packages/contracts/src/theme/theme-events.ts
  - packages/contracts/src/theme/theme-manifest.ts
  - packages/contracts/src/experience/theme-contract.ts
  - packages/contracts/src/index.ts
  - packages/contracts/src/theme/theme-contracts.test.ts
  - packages/contracts/src/theme/theme-events.test.ts
  - packages/schemas/src/theme.ts
  - packages/schemas/src/index.ts
  - packages/schemas/src/theme.test.ts
autonomous: true
requirements: [THEME-01, THEME-02, THEME-03]
must_haves:
  truths:
    - "A developer can import ThemeTarget, ThemeAssignment, ThemePreference, ThemeMode, ThemeResolutionSource, ThemeResolutionContext, ThemeResolution, ResolvedTheme, CompiledTheme from @mosaix/contracts and author a target for a custom entity ({ type: 'store', id: 'store_9' }) with zero business-entity references (success criteria #5)"
    - "ThemeManifest accepts optional modes { light?, dark? } overlays while every existing theme manifest without modes still type-checks and validates (additive, D-08/D-10)"
    - "ThemeResolution is exactly { themeId, mode, source } and source is only 'entity' | 'user' | 'application' | 'platform' — 'tenant'/'default' are rejected by both the type and the Zod schema (D-04/D-05)"
    - "Legacy experience ThemePreference consumers (ExperienceContract, ApplicationExperienceContract) still compile after the rename; the deprecated alias resolves to ExperienceThemePreference (D-02)"
    - "ThemeAssignmentChangedEvent and ThemeChangedEvent exist with typed payloads and constants theme.assignment.changed / theme.changed (D-11)"
    - "Every new contract is validated by a deterministic .strict() Zod schema in @mosaix/schemas; a ThemePreference is schema-valid with no assignment context (schema validates structure only — THEME-03)"
    - "themeEventPayloadSchemas is keyed by the contracts constants and each value exposes { safeParse } (PayloadValidator-compatible, no core import — D-12)"
    - "pnpm check (build + lint + test + prettier) stays green after all three plan items"
  artifacts:
    - path: "packages/contracts/src/theme/theme-mode.ts"
      provides: "Shared ThemeMode union (drift prevention)"
      contains: "export type ThemeMode"
    - path: "packages/contracts/src/theme/theme-target.ts"
      provides: "Generic ThemeTarget"
      contains: "interface ThemeTarget"
    - path: "packages/contracts/src/theme/theme-assignment.ts"
      provides: "AssignmentSource + ThemeAssignment"
      contains: "interface ThemeAssignment"
    - path: "packages/contracts/src/theme/theme-preference.ts"
      provides: "Canonical generic ThemePreference"
      contains: "interface ThemePreference"
    - path: "packages/contracts/src/theme/theme-resolution.ts"
      provides: "ThemeResolutionSource, ThemeResolution, ThemeResolutionContext"
      contains: "type ThemeResolutionSource"
    - path: "packages/contracts/src/theme/theme-resolved.ts"
      provides: "ResolvedTheme, CompiledTheme"
      contains: "interface ResolvedTheme"
    - path: "packages/contracts/src/theme/theme-events.ts"
      provides: "Theme events + type constants"
      contains: "theme.assignment.changed"
    - path: "packages/contracts/src/theme/theme-manifest.ts"
      provides: "ThemeManifest.modes overlay"
      contains: "modes"
    - path: "packages/contracts/src/experience/theme-contract.ts"
      provides: "ExperienceThemePreference + deprecated alias"
      contains: "ExperienceThemePreference"
    - path: "packages/schemas/src/theme.ts"
      provides: "Strict Zod schemas for all new contracts + event payload schemas + themeEventPayloadSchemas map"
      contains: "themeEventPayloadSchemas"
  key_links:
    - from: "packages/contracts/src/index.ts"
      to: "theme/theme-preference.ts"
      via: "canonical export named ThemePreference (D-01), replacing line 72 export from experience/theme-contract"
      pattern: "export type \\{ ThemePreference \\}"
    - from: "packages/contracts/src/experience/theme-contract.ts"
      to: "experience-contract.ts + application-experience.ts"
      via: "deprecated type alias ThemePreference = ExperienceThemePreference keeps relative imports compiling (D-02)"
      pattern: "type ThemePreference = ExperienceThemePreference"
    - from: "packages/schemas/src/theme.ts"
      to: "packages/contracts/src/theme/theme-events.ts"
      via: "imports themeAssignmentChangedEvent / themeChangedEvent constants to key themeEventPayloadSchemas (D-12, legal schemas → contracts boundary)"
      pattern: "import \\{ themeAssignmentChangedEvent, themeChangedEvent \\} from \"@mosaix/contracts\""
    - from: "ThemeResolution.mode / ResolvedTheme.mode / ThemePreference.preferredMode"
      to: "theme/theme-mode.ts"
      via: "single shared ThemeMode alias — one definition, no drift"
      pattern: "ThemeMode"
    - from: "packages/schemas/src/theme.ts ThemeManifestSchema"
      to: "modes overlay strict object"
      via: ".extend({ modes: ... .strict() }) rejects a 'system' overlay key (D-09)"
      pattern: "modes: z\\.object"
---

<objective>
Phase 1 — Theme Contracts & Schemas. Deliver the generic theme ABI in
`@mosaix/contracts` (type-only) plus deterministic Zod validators in
`@mosaix/schemas`, additive over the existing `theme/*` surface
(`ThemeManifest`, `DesignTokens`, `AccessibilityProfile`, `ThemeAssets`). NO
runtime code — resolution/compilation/injection are Phases 2–3.

Purpose: A project can declare and validate a theme ABI without the Theme
System knowing any business entity (PRD-0008 V2.3, roadmap Phase 1 success
criteria #1–#5, invariants #4/#8).

Output: 9 new generic contracts + `ThemeManifest.modes`, legacy
`ThemePreference` renamed (deprecated alias), 2 theme events, strict Zod
schemas + event payload map, updated barrels, co-located Vitest coverage,
`pnpm check` green.

Plan item order (executed strictly sequentially within this file — shared
`packages/contracts/src/index.ts` barrel + type dependencies force
item1 → item2 → item3):

1. **01-01 — Theme contracts** (types) — Wave 1
2. **01-02 — Theme events** (constants + interfaces) — Wave 2 (depends on 01-01)
3. **01-03 — Zod schemas + exports + index** — Wave 3 (depends on 01-01 + 01-02)
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.project/prd/PRD-0008-theme-system.md
@.project/decisions/ADR-0001-contract-layer.md
@.planning/phases/01-theme-contracts-schemas/01-CONTEXT.md
@.planning/codebase/CONVENTIONS.md
@.planning/codebase/STRUCTURE.md

<interfaces>
Exact shapes to implement. These ARE the contracts — no codebase exploration needed.
All fields readonly, per CONVENTIONS.md (`readonly` on interface fields, `readonly string[]`).

From PRD-0008 §4 + CONTEXT.md D-04..D-09 + D-11 (authoritative):

````typescript
// theme/theme-mode.ts (shared alias, drift prevention — CONTEXT "OpenCode's Discretion")
export type ThemeMode = "light" | "dark" | "system";

// theme/theme-target.ts (PRD §4.1, INV-THEME-001 — no business fields)
export interface ThemeTarget {
  readonly type: string;
  readonly id: string;
}

// theme/theme-assignment.ts (PRD §4.2)
export type AssignmentSource = "platform" | "admin" | "user" | "application";
export interface ThemeAssignment {
  readonly target: ThemeTarget;
  readonly themeId: string;
  readonly version?: string;      // semver-range, e.g. "^1.0.0"
  readonly mode?: ThemeMode;
  readonly source: AssignmentSource;
  readonly updatedAt?: string;
  readonly updatedBy?: string;
}

// theme/theme-preference.ts (PRD §4.3, V2.3 — mode only, NEVER identity)
export interface ThemePreference {
  readonly inherit: boolean;
  readonly allowedModes?: readonly ThemeMode[];
  readonly preferredMode?: ThemeMode;
}

// theme/theme-resolution.ts (CONTEXT D-04/D-05/D-06 — 4 sources ONLY, no tenant/default)
export type ThemeResolutionSource = "entity" | "user" | "application" | "platform";
export interface ThemeResolution {
  readonly themeId: string;
  readonly mode: ThemeMode;
  readonly source: ThemeResolutionSource;
}
export interface ThemeResolutionContext {
  readonly target: ThemeTarget;
  readonly userPreference?: ThemePreference;
  readonly applicationPreference?: ThemePreference;
  readonly precedence?: readonly ThemeResolutionSource[];
}

// theme/theme-resolved.ts (PRD §4.6, CONTEXT D-07)
export interface ResolvedTheme {
  readonly target?: ThemeTarget;
  readonly themeId: string;
  readonly version: string;
  readonly mode: ThemeMode;
  readonly manifest: ThemeManifest;
}
export type CompiledTheme = Record<string, string>;   // { "--mx-color-primary": "#1e73e8" }

// theme/theme-manifest.ts — ADD ONLY (D-08/D-09/D-10), keep every existing field
modes?: { light?: DesignTokens; dark?: DesignTokens };   // NO "system" key

// experience/theme-contract.ts — RENAME + ALIAS (D-02). Do NOT touch
// experience-contract.ts or application-experience.ts:
export interface ExperienceThemePreference { inherit: boolean; supports: string[]; preferred?: string; }
export type ThemePreference = ExperienceThemePreference; // @deprecated alias

// theme/theme-events.ts (PRD §13, D-11)
export const themeAssignmentChangedEvent = "theme.assignment.changed" as const;
export const themeChangedEvent = "theme.changed" as const;
// ThemeAssignmentChangedEvent { type; payload: { target; assignment; changedBy; at } }
// ThemeChangedEvent { type; payload: { theme; mode; version; appliedAt; target? } }

// Existing shapes already in the codebase (do not redefine):
// packages/contracts/src/theme/theme-manifest.ts → ThemeManifest
// packages/contracts/src/theme/design-tokens.ts  → DesignTokens
// packages/schemas/src/theme.ts                  → DesignTokensSchema, ThemeManifestSchema (base)
// packages/schemas/src/artifact.ts               → artifactManifest(type, payload?) — base is .strict()
// packages/contracts/src/events/event-contract.ts → envelope (NOT needed — theme events are
//   payload-contract events like apps/identity/src/events/identity-events.ts, wrapped by the bus)
</interfaces>
</context>

<tasks>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- PLAN ITEM 01-01 — Theme contracts (Wave 1)                           -->
<!-- ════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>01-01: Implement generic theme contracts in @mosaix/contracts (types + ThemeManifest.modes + legacy rename)</name>
  <files>
    packages/contracts/src/theme/theme-mode.ts
    packages/contracts/src/theme/theme-target.ts
    packages/contracts/src/theme/theme-assignment.ts
    packages/contracts/src/theme/theme-preference.ts
    packages/contracts/src/theme/theme-resolution.ts
    packages/contracts/src/theme/theme-resolved.ts
    packages/contracts/src/theme/theme-manifest.ts
    packages/contracts/src/experience/theme-contract.ts
    packages/contracts/src/index.ts
    packages/contracts/src/theme/theme-contracts.test.ts
  </files>
  <action>
    Create the six new contract files and modify three existing files in
    `packages/contracts`, per the <interfaces> block above. Type-only package —
    no values, no Zod, no runtime code. Every file starts with the package's
    header JSDoc block (purpose, PRD/ADR references, dependency direction,
    consumers) per CONVENTIONS.md; use `import type` for all type imports
    (mandatory `verbatimModuleSyntax`).

    1. **Create `packages/contracts/src/theme/theme-mode.ts`** — single shared
       `export type ThemeMode = "light" | "dark" | "system"` with JSDoc noting
       this is THE mode definition (drift prevention) and that `"system"` is a
       resolution-time preference, never a token overlay key (D-09).

    2. **Create `packages/contracts/src/theme/theme-target.ts`** —
       `export interface ThemeTarget { readonly type: string; readonly id: string }`.
       JSDoc must state INV-THEME-001/002: no business fields; `type` is a
       project-declared string ("store", "brand", "workspace", …).

    3. **Create `packages/contracts/src/theme/theme-assignment.ts`** — imports
       `type ThemeTarget` from `./theme-target` and `type ThemeMode` from
       `./theme-mode`. Declares `AssignmentSource` (4 members, per PRD §4.2 —
       NOT ThemeResolutionSource; the two unions are intentionally distinct)
       and `ThemeAssignment` per the <interfaces> block.

    4. **Create `packages/contracts/src/theme/theme-preference.ts`** — the
       CANONICAL generic `ThemePreference` (D-01). Imports `type ThemeMode`
       from `./theme-mode`. JSDoc must state the V2.3 rule (C5/G6): the
       preference determines ONLY `mode`; it can never replace an assigned
       themeId — precedence is the resolver's responsibility (Phase 2), never
       this contract's.

    5. **Create `packages/contracts/src/theme/theme-resolution.ts`** —
       imports `type ThemeTarget` and `type ThemePreference` and `type
       ThemeMode`. Declares in one file: `ThemeResolutionSource` (EXACTLY
       `"entity" | "user" | "application" | "platform"` — D-04; JSDoc notes
       `"tenant"` and `"default"` are deferred to Phase 2), `ThemeResolution`
       (D-05: the lightweight decision record `{ themeId, mode, source }` —
       never mixes identity with preference), `ThemeResolutionContext` (D-06:
       standalone, NO import of any ADR-0007 `CompositionContext` type —
       verify with a grep that no `CompositionContext` string appears).

    6. **Create `packages/contracts/src/theme/theme-resolved.ts`** — imports
       `type ThemeTarget` from `./theme-target`, `type ThemeMode` from
       `./theme-mode`, `type ThemeManifest` from `./theme-manifest`. Declares
       `ResolvedTheme` (D-07: manifest is the `extends`-resolved final
       manifest — resolution result, distinct from the lightweight
       `ThemeResolution` record) and `export type CompiledTheme = Record<string, string>`
       (PRD §4.6 / correction C2 — never `unknown`).

    7. **Modify `packages/contracts/src/theme/theme-manifest.ts`** — ADDITIVE
       only (D-10). Add one optional field to the existing interface,
       importing `type DesignTokens` (already imported):
       `modes?: { light?: DesignTokens; dark?: DesignTokens }`. JSDoc: partial
       `DesignTokens` overlays merged deterministically over base `tokens` at
       compile time; only `light`/`dark` keys (D-08/D-09 — a `"system"` key is
       a schema error, enforced in 01-03). Do NOT touch `tokens`, `extends`,
       `assets`, `accessibility`.

    8. **Modify `packages/contracts/src/experience/theme-contract.ts`** (D-02) —
       rename the interface `ThemePreference` → `ExperienceThemePreference`
       and append a deprecated alias:
       ```ts
       /** @deprecated Renamed to ExperienceThemePreference. Pre-ADR-0007 model; do not use for new code. */
       export type ThemePreference = ExperienceThemePreference;
       ```
       This keeps `import type { ThemePreference } from "./theme-contract"` in
       `experience-contract.ts` and `../experience/theme-contract` in
       `application-experience.ts` compiling unchanged. Do NOT modify
       `experience-contract.ts` or `application-experience.ts` (D-03: legacy
       experience contracts are NOT extended).

    9. **Modify `packages/contracts/src/index.ts`** — barrel updates:
       - Replace line 72 `export type { ThemePreference } from "./experience/theme-contract";`
         with `export type { ExperienceThemePreference } from "./experience/theme-contract";`
         (the deprecated alias stays importable only via the relative path, per
         D-02; the barrel name `ThemePreference` is now owned by the generic
         contract per D-01).
       - In the `─── Theme ───` section add `export type { ... }` entries for:
         `ThemeTarget` (`./theme/theme-target`), `AssignmentSource` +
         `ThemeAssignment` (`./theme/theme-assignment`), `ThemePreference`
         (`./theme/theme-preference` — canonical, D-01), `ThemeMode`
         (`./theme/theme-mode`), `ThemeResolutionSource` + `ThemeResolution` +
         `ThemeResolutionContext` (`./theme/theme-resolution`), `ResolvedTheme`
         + `CompiledTheme` (`./theme/theme-resolved`).
       - Keep every existing export untouched (100% additive).

    10. **Create `packages/contracts/src/theme/theme-contracts.test.ts`** —
        co-located Vitest type-assertion suite using `expectTypeOf` from
        "vitest" (assertions are compile-time enforced by `pnpm build`; the
        `it()` wrappers make them visible in `pnpm test`). Fixture convention
        per roadmap invariant #8 / THEME-15: custom target types `store`,
        `brand`, `workspace` — NEVER `space`. Assert at minimum:
        - `expectTypeOf<ThemeTarget>().toEqualTypeOf<{ readonly type: string; readonly id: string }>()`
        - `expectTypeOf<ThemeResolutionSource>().toEqualTypeOf<"entity" | "user" | "application" | "platform">()`
          (proves D-04 — no tenant/default)
        - `expectTypeOf<ThemeResolution>().toEqualTypeOf<{ themeId: string; mode: ThemeMode; source: ThemeResolutionSource }>()` (D-05)
        - `expectTypeOf<ThemeMode>().toEqualTypeOf<"light" | "dark" | "system">()` (D-09)
        - `expectTypeOf<CompiledTheme>().toEqualTypeOf<Record<string, string>>()` (C2)
        - `expectTypeOf<ResolvedTheme>()` matches the D-07 shape; `ThemeResolutionContext`
          has no `CompositionContext` dependency (assert its exact shape)
        - `expectTypeOf<ThemePreference>().toEqualTypeOf<ExperienceThemePreference>()`
          for the deprecated alias, imported from `../experience/theme-contract`
        - A compile-time custom-target sample: declare
          `const target: ThemeTarget = { type: "store", id: "store_9" }` and use
          it in a `ThemeAssignment` value — proves success criteria #5.
  </action>
  <verify>
    <automated>pnpm --filter @mosaix/contracts exec vitest run src/theme/theme-contracts.test.ts</automated>
  </verify>
  <done>
    All 9 contracts + ThemeManifest.modes exist with the exact shapes in
    <interfaces>; barrel exports them; `ExperienceContract` /
    `ApplicationExperienceContract` still type-check (no edits to them);
    `theme-contracts.test.ts` passes; grep on `theme-resolution.ts` shows no
    `"tenant"`/`"default"` literals in the union; `pnpm build` (tsc --build)
    succeeds for the whole workspace.
  </done>
</task>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- PLAN ITEM 01-02 — Theme events (Wave 2)                              -->
<!-- ════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>01-02: Declare ThemeAssignmentChangedEvent and ThemeChangedEvent with type constants</name>
  <files>
    packages/contracts/src/theme/theme-events.ts
    packages/contracts/src/index.ts
    packages/contracts/src/theme/theme-events.test.ts
  </files>
  <action>
    Create `packages/contracts/src/theme/theme-events.ts` mirroring the
    `apps/identity/src/events/identity-events.ts` pattern (D-12): constants +
    typed payload interfaces, values and types in one module. File lives in
    `theme/` (PRD §9 structure proposal; keeps the theme family cohesive —
    events import theme types from sibling files; no cross-family imports).
    Requires 01-01 to be complete (`ThemeTarget`, `ThemeAssignment`,
    `ThemeMode` must exist).

    1. **Create `packages/contracts/src/theme/theme-events.ts`**:
       - Constants (camelCase identifiers, string values — matches the
         identity-events pattern and CONVENTIONS event-type grammar
         `<domain>.<resource>.<past-tense-action>`):
         ```ts
         export const themeAssignmentChangedEvent = "theme.assignment.changed" as const;
         export const themeChangedEvent = "theme.changed" as const;
         ```
       - `export interface ThemeAssignmentChangedPayload`:
         `{ readonly target: ThemeTarget; readonly assignment: ThemeAssignment; readonly changedBy: string; readonly at: string }`
       - `export interface ThemeChangedPayload`:
         `{ readonly theme: string; readonly mode: string; readonly version: string; readonly appliedAt: string; readonly target?: ThemeTarget }`
         (payload field types exactly as PRD §13 writes them — `theme`, `mode`,
         `version` are strings; `mode` intentionally NOT narrowed to
         `ThemeMode` to stay faithful to the source spec. The resolvers'
         emitter in Phase 3 produces these values.)
       - Wrapper interfaces per PRD §13 (event = type + payload):
         ```ts
         export interface ThemeAssignmentChangedEvent {
           readonly type: typeof themeAssignmentChangedEvent;
           readonly payload: ThemeAssignmentChangedPayload;
         }
         export interface ThemeChangedEvent {
           readonly type: typeof themeChangedEvent;
           readonly payload: ThemeChangedPayload;
         }
         ```
       - Header JSDoc: these are payload-contract events (ADR-0003 style);
         actual registration into the kernel `EventSchemaRegistry` happens in
         later phases when the resolver emits (D-12). `theme.assignment.changed`
         is the configuration trace; `theme.changed` fires AFTER injection
         (PRD §13).

    2. **Modify `packages/contracts/src/index.ts`** — in the Theme section add
       (value exports for the constants, type exports for the interfaces):
       ```ts
       export { themeAssignmentChangedEvent, themeChangedEvent } from "./theme/theme-events";
       export type {
         ThemeAssignmentChangedEvent,
         ThemeAssignmentChangedPayload,
         ThemeChangedEvent,
         ThemeChangedPayload,
       } from "./theme/theme-events";
       ```

    3. **Create `packages/contracts/src/theme/theme-events.test.ts`** —
       co-located Vitest type-assertion suite (expectTypeOf):
       - `expectTypeOf<ThemeAssignmentChangedEvent["type"]>().toEqualTypeOf<"theme.assignment.changed">()`
       - `expectTypeOf<ThemeChangedEvent["type"]>().toEqualTypeOf<"theme.changed">()`
       - `expectTypeOf<ThemeChangedEvent["payload"]["mode"]>().toEqualTypeOf<string>()`
         (locks the PRD §13 literal shape)
       - Build a `ThemeAssignmentChangedEvent` value using a custom
         `{ type: "brand", id: "brand_7" }` target (fixture rule: never
         `space`), asserting it satisfies the type.
  </action>
  <verify>
    <automated>pnpm --filter @mosaix/contracts exec vitest run src/theme/theme-events.test.ts</automated>
  </verify>
  <done>
    theme-events.ts declares both constants + 4 interfaces exactly per PRD §13;
    barrel exports constants AND types; theme-events.test.ts passes; no
    `"space"` literal anywhere in the new files; `pnpm build` green.
  </done>
</task>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- PLAN ITEM 01-03 — Zod schemas + exports + index (Wave 3)             -->
<!-- ════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>01-03: Add strict Zod schemas for every new contract + themeEventPayloadSchemas map + barrel exports</name>
  <files>
    packages/schemas/src/theme.ts
    packages/schemas/src/index.ts
    packages/schemas/src/theme.test.ts
  </files>
  <action>
    Extend `packages/schemas/src/theme.ts` (single-file-per-family convention
    in this package — matches existing `theme.ts`) and re-export from
    `packages/schemas/src/index.ts`. Requires 01-01 + 01-02 complete (imports
    the event constants from `@mosaix/contracts` — schemas already depends on
    contracts per package.json, and the eslint-boundaries allow the downward
    schemas → contracts direction). No import from `@mosaix/core` or any
    package above contracts (D-12).

    1. **Modify `packages/schemas/src/theme.ts`** — ADDITIVE. Keep
       `ColorTokensSchema`, `DesignTokensSchema`, `ThemeAssetsSchema`,
       `ThemeManifestSchema` exactly as-is. Add:
       - `export const ThemeModeSchema = z.enum(["light", "dark", "system"])`
       - `export const ThemeResolutionSourceSchema = z.enum(["entity", "user", "application", "platform"])`
         (D-04 — a `"tenant"`/`"default"` source fails validation)
       - `export const ThemeTargetSchema = z.object({ type: z.string().min(1), id: z.string().min(1) }).strict()`
       - `export const AssignmentSourceSchema = z.enum(["platform", "admin", "user", "application"])`
       - `export const ThemeAssignmentSchema = z.object({ target: ThemeTargetSchema, themeId: z.string().min(1), version: z.string().optional(), mode: ThemeModeSchema.optional(), source: AssignmentSourceSchema, updatedAt: z.string().datetime({ offset: true }).optional(), updatedBy: z.string().optional() }).strict()`
       - `export const ThemePreferenceSchema = z.object({ inherit: z.boolean(), allowedModes: z.array(ThemeModeSchema).optional(), preferredMode: ThemeModeSchema.optional() }).strict()`
         (THEME-03: structure only — a preference is valid with NO assignment
         context; precedence is never the schema's concern)
       - `export const ThemeResolutionSchema = z.object({ themeId: z.string().min(1), mode: ThemeModeSchema, source: ThemeResolutionSourceSchema }).strict()`
       - `export const ThemeResolutionContextSchema = z.object({ target: ThemeTargetSchema, userPreference: ThemePreferenceSchema.optional(), applicationPreference: ThemePreferenceSchema.optional(), precedence: z.array(ThemeResolutionSourceSchema).optional() }).strict()`
       - `export const ResolvedThemeSchema = z.object({ target: ThemeTargetSchema.optional(), themeId: z.string().min(1), version: z.string().min(1), mode: ThemeModeSchema, manifest: ThemeManifestSchema }).strict()`
       - `export const CompiledThemeSchema = z.record(z.string(), z.string())`
         (note: `.strict()` is inapplicable to records — record values are
         already constrained to strings; document this in a JSDoc comment)
       - Extend the manifest schema (additive):
         ```ts
         .extend({
           modes: z.object({ light: DesignTokensSchema.optional(), dark: DesignTokensSchema.optional() }).strict().optional(),
         })
         ```
         — i.e. change `ThemeManifestSchema = artifactManifest("theme").extend({ ... })`
         to include `modes`. The inner `.strict()` REJECTS a `"system"` overlay
         key (D-09). JSDoc: overlays require `colors.primary` (DesignTokens is
         not partial at the root — faithful to D-08 which types overlays as
         `DesignTokens`).
       - Event payload schemas + map (identity-events pattern, D-12) — import
         the constants at the top:
         ```ts
         import { themeAssignmentChangedEvent, themeChangedEvent } from "@mosaix/contracts";
         ```
         Then:
         ```ts
         export const ThemeAssignmentChangedPayloadSchema = z.object({
           target: ThemeTargetSchema,
           assignment: ThemeAssignmentSchema,
           changedBy: z.string().min(1),
           at: z.string().datetime({ offset: true }),
         }).strict();
         export const ThemeChangedPayloadSchema = z.object({
           theme: z.string().min(1),
           mode: z.string().min(1),          // string, mirroring PRD §13 (not narrowed)
           version: z.string().min(1),
           appliedAt: z.string().datetime({ offset: true }),
           target: ThemeTargetSchema.optional(),
         }).strict();
         export const themeEventPayloadSchemas = {
           [themeAssignmentChangedEvent]: ThemeAssignmentChangedPayloadSchema,
           [themeChangedEvent]: ThemeChangedPayloadSchema,
         } as const;
         ```
         Keying the map by the imported constants guarantees structural
         compatibility with core's `PayloadValidator` (`{ safeParse }`) and
         zero key drift (D-12). Registration into `EventSchemaRegistry` is
         explicitly OUT of scope (later phases).

    2. **Modify `packages/schemas/src/index.ts`** — extend the `ThemeManifestSchema`
       block in the `───` theme export group with all new schemas:
       `ThemeModeSchema`, `ThemeResolutionSourceSchema`, `ThemeTargetSchema`,
       `AssignmentSourceSchema`, `ThemeAssignmentSchema`,
       `ThemePreferenceSchema`, `ThemeResolutionSchema`,
       `ThemeResolutionContextSchema`, `ResolvedThemeSchema`,
       `CompiledThemeSchema`, `ThemeAssignmentChangedPayloadSchema`,
       `ThemeChangedPayloadSchema`, `themeEventPayloadSchemas`.
       Existing exports untouched (additive).

    3. **Create `packages/schemas/src/theme.test.ts`** — co-located Vitest
       runtime suite (safeParse assertions). Fixtures MUST use custom target
       types `store`/`brand`/`workspace` — never `space` (invariant #8,
       THEME-15). Cover at minimum:
       - ThemeTargetSchema: accepts `{ type: "store", id: "store_9" }`; rejects
         an empty `type`; rejects an unknown key (`.strict()`).
       - ThemeAssignmentSchema: accepts full assignment with `source: "admin"`;
         rejects `source: "tenant"`; rejects unknown keys.
       - ThemePreferenceSchema: accepts `{ inherit: false, preferredMode: "dark" }`
         with NO assignment context (THEME-03 invariant — the key regression
         guard); rejects `preferredMode: "violet"`.
       - ThemeResolutionSchema: accepts `{ themeId: "ocean", mode: "system", source: "user" }`;
         rejects `source: "default"` (D-04).
       - ThemeResolutionContextSchema: accepts `{ target }` alone; accepts
         `precedence: ["entity", "user"]`; rejects unknown keys.
       - ResolvedThemeSchema: accepts a full resolved theme whose manifest is a
         valid `ThemeManifest`; rejects a missing `manifest`.
       - CompiledThemeSchema: accepts `{ "--mx-color-primary": "#1e73e8" }`;
         rejects a non-string value.
       - ThemeManifestSchema with modes: accepts `modes: { dark: { colors: { primary: "#000000" } } }`;
         REJECTS `modes: { system: { colors: { primary: "#000000" } } }` (D-09);
         existing manifests without `modes` still pass (additive, D-10).
       - Event payload schemas: `ThemeAssignmentChangedPayloadSchema` accepts a
         valid payload (target `brand_7`, `changedBy`, ISO `at`);
         `ThemeChangedPayloadSchema` accepts a valid payload; both reject
         unknown keys.
       - Map integrity: `themeEventPayloadSchemas[themeAssignmentChangedEvent]`
         and `themeEventPayloadSchemas[themeChangedEvent]` exist (import the
         constants from `@mosaix/contracts` to key the lookups); each value
         exposes a function-shaped `safeParse` (PayloadValidator compatibility
         check: `typeof schema.safeParse === "function"`).
  </action>
  <verify>
    <automated>pnpm --filter @mosaix/schemas exec vitest run src/theme.test.ts</automated>
  </verify>
  <done>
    All schemas are `.strict()` deterministic validators (CompiledThemeSchema
    excepted — record type, documented); `modes` overlay rejects the `"system"`
    key; `themeEventPayloadSchemas` keyed by imported contracts constants with
    `{ safeParse }`-compatible values; no import from core anywhere in
    packages/schemas; theme.test.ts passes; full `pnpm check`
    (build + lint + test + prettier) green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| contracts → schemas | Type-only ABI crosses into runtime validation; a drift between a contract shape and its Zod schema makes valid payloads fail or invalid payloads pass later phases |
| schemas → event registry | Event payload schemas will be registered into core's `EventSchemaRegistry` in later phases; payloads crossing here are untrusted |
| legacy experience → deprecated alias | `ExperienceThemePreference` alias must stay behavior-identical or legacy consumers mis-validate |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Spoofing | `themeEventPayloadSchemas` map keys | mitigate | Map keyed by the constants imported from `@mosaix/contracts` (`theme.assignment.changed` / `theme.changed`) — a mistyped literal cannot silently register under the wrong event type (D-12); type-assertion test locks the event `type` literals |
| T-01-02 | Tampering | All new Zod schemas | mitigate | Every object schema is `.strict()` — unknown keys (e.g. a `"system"` modes overlay per D-09, or a `"tenant"` resolution source per D-04) fail `safeParse` deterministically |
| T-01-03 | Information disclosure | contracts package | accept | Type-only package; no runtime, no data, no I/O — nothing disclosable in this phase |
| T-01-04 | Denial of service | contracts↔schemas drift | mitigate | Single shared `ThemeMode` alias (drift prevention); `theme-contracts.test.ts` `expectTypeOf` assertions are compile-time enforced by `pnpm build`, so a contract shape change fails CI before any consumer mis-validates |
| T-01-05 | Elevation of privilege | N/A | accept | No authz surface exists in Phase 1 (policy evaluation is Phase 2+ per PRD §7); nothing to elevate |
</threat_model>

<testing_strategy>
- **Runner:** Vitest (root `pnpm test`), co-located `*.test.ts` files — the established repo pattern (`packages/schemas/src/index.test.ts`, `packages/adapters/*`).
- **Contracts (01-01, 01-02):** type-level assertions with `expectTypeOf` from vitest. These are compile-time checked by `tsc --build` (tests live inside `src/` and are part of the build), so `pnpm build` + the focused `vitest run` both gate the shapes. Runtime behavior is not applicable to type-only contracts.
- **Schemas (01-03):** runtime `safeParse` assertions covering accept + reject paths for every new schema, including the two locked negative cases (D-04: `source: "default"` rejected; D-09: `modes.system` key rejected) and the THEME-03 invariant (a `ThemePreference` validates with no assignment context).
- **Fixture rule (DoD):** every fixture uses a custom target type — `store`, `brand`, or `workspace` — NEVER `space`. Enforced by tests themselves (fixtures written this way) and by the Phase 6 no-business-ref conformance check.
- **Additivity gate:** `pnpm check` (build + lint + test + prettier) must stay green; existing exports (all `theme/*` types, `ExperienceContract`, `ApplicationExperienceContract`, `ThemeManifestSchema` without modes) must compile and validate unchanged.
- **Focused commands per item:** `pnpm --filter @mosaix/contracts exec vitest run src/theme/theme-contracts.test.ts` (01-01), `... src/theme/theme-events.test.ts` (01-02), `pnpm --filter @mosaix/schemas exec vitest run src/theme.test.ts` (01-03). Full gate: `pnpm check` at the end.
</testing_strategy>

<verification>
- `pnpm --filter @mosaix/contracts exec vitest run src/theme/theme-contracts.test.ts` → passes (01-01)
- `pnpm --filter @mosaix/contracts exec vitest run src/theme/theme-events.test.ts` → passes (01-02)
- `pnpm --filter @mosaix/schemas exec vitest run src/theme.test.ts` → passes (01-03)
- `rg -n "CompositionContext" packages/contracts/src/theme/` → no matches (D-06)
- `rg -n '"tenant"|"default"' packages/contracts/src/theme/theme-resolution.ts` → no matches in the union (D-04)
- `rg -n '"space"' packages/contracts/src/theme/ packages/schemas/src/theme.ts packages/schemas/src/theme.test.ts` → no matches (invariant #8)
- `pnpm check` (build + lint + test + prettier) → green
- `git diff --stat` shows ONLY the files listed in `files_modified` (no scope creep, no edits to `experience-contract.ts` / `application-experience.ts`)
</verification>

<success_criteria>
1. `@mosaix/contracts` exposes the 9 generic contracts + `ThemeManifest.modes`; every pre-existing `theme/*` export still works (THEME-01, success criteria #1)
2. `ThemeResolution` = `{ themeId, mode, source }` with `source` limited to `"entity" | "user" | "application" | "platform"` — the codebase never mixes which-theme / which-mode / why (success criteria #2, D-04/D-05)
3. `@mosaix/schemas` validates every new contract with deterministic `.strict()` Zod; a `ThemePreference` is valid independent of entity assignments — structure only (THEME-03, success criteria #3)
4. `ThemeAssignmentChangedEvent` / `ThemeChangedEvent` declared with typed payloads + constants + `themeEventPayloadSchemas` map compatible with `PayloadValidator` (THEME-02, D-11/D-12, success criteria #4)
5. A developer reading `@mosaix/contracts` can author a `ThemeTarget` for a custom entity type (`store`, `brand`, `workspace`) with zero business references (success criteria #5)
6. `pnpm check` green; zero breaking changes; fixtures never use `space`
</success_criteria>

<output>
After completion, create `.planning/phases/01-theme-contracts-schemas/01-SUMMARY.md`
</output>
````
