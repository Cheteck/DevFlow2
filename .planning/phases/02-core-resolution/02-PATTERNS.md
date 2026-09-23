# Phase 2: Core Resolution — Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 8 new/modified runtime files (7 new in `packages/core/src/theme/` + barrel edit)
**Analogs found:** 7 / 8 (1 partial — inheritance DFS resolver)
**Phase boundary:** runtime-only, target-agnostic resolution kernel in `@mosaix/core` (no business entities, no persistence, no Governance/SDK/compiler — Phases 3–5).

---

## File Classification

| New/Modified File                                                                              | Role                       | Data Flow                            | Closest Analog                                                                                                                  | Match Quality                  |
| ---------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `packages/core/src/theme/theme-target-registry.ts`                                             | registry (controller-less) | request-response / registration-only | `packages/core/src/capability-registry.ts`                                                                                      | exact                          |
| `packages/contracts/src/theme/theme-assignments-store.ts` (port, D-18: contracts theme family) | port                       | CRUD                                 | `apps/identity/src/domain/user-repository.ts` + `packages/migrations/src/store.ts` (`MigrationStore`)                           | exact                          |
| `packages/core/src/theme/in-memory-theme-assignments-store.ts` (adapter)                       | service impl               | CRUD                                 | `apps/identity/src/infrastructure/in-memory-user-repository.ts` + `packages/migrations/src/store.ts` (`InMemoryMigrationStore`) | exact                          |
| `packages/core/src/theme/theme-resolver.ts`                                                    | service (orchestrator)     | request-response, step pipeline      | `packages/core/src/kernel.ts` (`executeCapability` 4-step) + `apps/identity/src/application/identity-capabilities.ts`           | role-match                     |
| `packages/core/src/theme/theme-inheritance-resolver.ts`                                        | service                    | transform (DFS graph)                | `packages/migrations/src/planner.ts` (`assertNoResourceCollisions` Map-iteration validation)                                    | partial (no DFS analog exists) |
| `packages/core/src/theme/theme-errors.ts`                                                      | error hierarchy            | —                                    | `packages/core/src/kernel-errors.ts` (exact base to extend) + `apps/identity/src/domain/errors.ts` (typed code union)           | exact                          |
| `packages/core/src/theme/theme-events.ts` (runtime constants/emit helper)                      | model/config               | event-driven                         | `packages/contracts/src/theme/theme-events.ts` (constants already exist) + `apps/identity/src/events/identity-events.ts`        | exact                          |
| `packages/core/src/index.ts` (modified barrel)                                                 | config                     | —                                    | existing `packages/core/src/index.ts` section headers                                                                           | exact                          |

---

## Pattern Assignments

### `theme-target-registry.ts` (registry)

**Analog:** `packages/core/src/capability-registry.ts` (103 lines, read fully)

**Class shape — private `Map` + entry interface + class with register/resolve/list** (lines 12–37):

```typescript
export interface CapabilityEntry {
  id: string;
  ownerApp: string;
  version: string;
  entry: string;
  permissions: string[];
  availability?: CapabilityAvailability;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityEntry>();

  register(entry: CapabilityEntry): void {
    const key = `${entry.ownerApp}:${entry.id}`;
    this.capabilities.set(key, entry);
  }

  resolve(id: string, version?: string): CapabilityEntry | undefined {
    for (const entry of this.capabilities.values()) {
      if (entry.id !== id) continue;
      if (version === undefined || entry.version === version) return entry;
    }
    return undefined;
  }
```

- **Key convention:** composite key `${ownerApp}:${id}` (line 27); for targets, key by `${entry.id}` or `${entry.id}:${...}` — pick a stable composite; single canonical key (collision = overwrite, matching `capability-registry.register` **last-write-wins**, no throw — contrast `EventSchemaRegistry.register` at line 32–42 which **throws** on cross-owner collision).
- **Registration semantics (D-16):** `register()` is the only mutation; `ThemeResolver.resolve()` must never call `register()` (bootstrap-only). Read-only accessors mirror lines 39–48 (`get`) and 94–96 (`has` → `this.resolve(id) !== undefined`).
- **Entry shape (THEME-04):** `ThemeTargetEntry` should carry `id`, `type`, capabilities (`userSelectable` / `adminConfigurable`) — follow `optional` field style: `availability?`-like optional capability flags.

**Bootstrap-only enforcement hint (D-16):** `kernel.ts` blocks post-`start()` mutation by phase — `install()` lines 182–197:

```typescript
if (this.phase === "started") {
  throw new RegistrationError(
    `Cannot install module "${module.name}" after start()`,
    { name: module.name },
  );
}
```

If Phase 2 wants an immutable-after-construction guard, this is the in-repo precedent.

---

### `theme-assignments-store.ts` (port)

**Analog (interface shape):** `apps/identity/src/domain/user-repository.ts` (16 lines) + `packages/migrations/src/store.ts` lines 30–39 (`MigrationStore` — best JSDoc-per-method shape).

**Port naming — two established conventions (OpenCode decision D-2: core).** Domain seam style (`apps/identity`):

```typescript
// apps/identity/src/domain/user-repository.ts (lines 11–16)
import type { User } from "./user";

export interface UserRepository {
  save(user: User): void;
  findById(id: string): User | undefined;
  findByEmail(email: string): User | undefined;
  list(): User[];
}
```

Infrastructure seam style (`packages/ports/*`, `Port` suffix — `packages/ports/database/src/index.ts` lines 56–82, `DatabasePort`):

```typescript
/**
 * DatabasePort — minimal schema-execution surface consumed by
 * `@mosaix/migrations`. ...
 */
export interface DatabasePort {
  readonly capabilities: DatabaseCapabilities;
  /** Runs a statement stream (migration body / cleanup). */
  execute(sql: string, params?: readonly unknown[]): Promise<number>;
  ...
}
```

**Recommendation to planner:** the port contract is already demanded by D-15 ("contract in `@mosaix/contracts` theme family") — Phase 1 has the assignment types. Because in-memory-only delivery with no adapter ecosystem exists yet, the **lowest-friction match** is the domain-port style (`theme-assignments-store.ts` interface + `in-memory-theme-assignments-store.ts` adapter, distinct basenames per AGENTS.md absolute rule). A dedicated `packages/ports/theme` package is only warranted if a second implementation will appear in this phase (it will not — invariant #4). Flag for planner; do not over-engineer.

**Interface shape (D-18):** `assign(assignment)` / `unassign(target)` / `get(target)` / `list()`; `get`/`list` return `undefined`/`[]` for missing (CONVENTIONS.md: "Lookups return `undefined` for missing"). JSDoc every method (see `MigrationStore` lines 30–39 for the documented-contract style).

---

### `in-memory-theme-assignments-store.ts` (adapter)

**Analog:** `apps/identity/src/infrastructure/in-memory-user-repository.ts` (31 lines):

```typescript
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private readonly idsByEmail = new Map<string, string>();

  save(user: User): void { ... }
  findById(id: string): User | undefined {
    return this.users.get(id);
  }
  list(): User[] {
    return Array.from(this.users.values());
  }
}
```

**Map keyed by id convention:** `Map<string, Entity>` + `Array.from(map.values())` for `list()`. Target key = `${target.type}:${target.id}` (mirror `EventStore.tenantKey`, `event-bus.ts` lines 27–31, which composes a string key).

**With migration-store sync style** (`store.ts` lines 42–61): `InMemoryMigrationStore implements MigrationStore` uses a plain array + `find`/`findIndex` + `{ ...migration }` copies. Either storage is fine; `unassign`/`remove` precedent (lines 57–60):

```ts
async remove(id: string): Promise<void> {
  const idx = this.entries.findIndex((e) => e.id === id);
  if (idx >= 0) this.entries.splice(idx, 1);
}
```

---

### `theme-resolver.ts` (pipeline orchestrator)

**Analog:** `packages/core/src/kernel.ts` `executeCapability` (lines 417–475) — step-by-step orchestration behind a single public entry marked by a numbered JSDoc list; and `apps/identity/src/application/identity-capabilities.ts` — thin application layer that calls the domain service then publishes events.

**Public entry pattern — numbered Flow comment + single `resolve()` method** (`kernel.ts` lines 422–446):

```typescript
/**
 * Execute a capability as a calling application.
 *
 * Enforces Flow B of the roadmap through the execution boundary:
 *  1. Resolve provider via Capability Registry
 *  2. Check caller's execute permission (authorization)
 *  3. Tighten to the caller's tenant scope
 *  4. Invoke the provider's registered executor (traced)
 */
async executeCapability(...): Promise<unknown> {
  const capability = this.capabilities.resolve(capabilityId);
  if (!capability) {
    throw new CapabilityError(`Unknown capability: ${capabilityId}`, { capabilityId });
  }
  ...
  const executor = this.executors.get(capabilityId);
  if (!executor) { throw new CapabilityError(...); }
  try { ... } catch (error) { span.end("error", error); throw error; }
}
```

**D-14 mapping for the planner:** `ThemeResolver.resolve(ctx)` is the single public entry mirroring `executeCapability`; each step comes **after** it — `resolveTarget` / `resolveAssignment` / `resolveThemeId` / `resolveMode` / `resolveInheritance` — as separately exported functions/methods returning partial-bearing concrete types (`resolveTarget` returns the resolved entity or an absent-entity marker per D-17; `resolveAssignment` returns `{ assignment } | { none }` etc. — the repo has no "Result" ADT, so prefer explicit optional-return shapes: `User | undefined` style with small discriminated result objects, e.g. `{ kind: "assigned", assignment } | { kind: "unassigned" }`).

**Fail-open at `resolve()` level (D-20):** catch-per-step inside `resolve()`, fall back to platform/default, never crash the experience — mirrors `lifecycle.ts` degrade-on-failure (`initialize()`, lines 102–115: try transition, catch → `transition("degraded")` and `throw error` — here the throws become the fail-open fallback instead of rethrow).

**Constructor in culture** (line 142 `constructor(hooks = {}, options = {})` + lines 43–49 of user-service): constructor-inject collaborators with defaults:

```ts
constructor(
  private readonly registry: ThemeTargetRegistry,
  private readonly store: ThemeAssignmentsStore,
  options: ThemeResolverOptions = {},
) { ... }
```

DI for time/ids (`now?`, `idGenerator?` in `apps/identity/src/domain/user-service.ts` lines 34–49) if feature flags/version gating needs injection; keep default behavior built-in.

**Determinism wiring:** `ThemeResolutionContext.precedence` (contract) is the D-13 authority — when present, iterate that array; else default `["entity","user","application","platform"]`. The async loop over an ordered array with early return is idiomatic here (see `AppEventBus.deliver` iteration at `event-bus.ts` 209–219). **Guarantee no implicit registry/creation in steps (D-17):** `resolveTarget` must treat unknown target type as _absent_ source, return "no match" NOT throw. Keep steps as pure functions of their inputs (idempotent, deterministic, store-aware — roadmap criteria).

---

### `theme-inheritance-resolver.ts` (DFS)

**Analog (partial):** `packages/migrations/src/planner.ts` — deterministic validation over a graph with a Map + throw-on-violation (lines 137–178 `assertStoreConsistent` / `assertNoResourceCollisions`). Precedent for immutable result types (`MigrationPlan` `readonly` — lines 27–33).

**No exact DFS analog in repo.** Pattern to copy (from planner.ts + lifecycle recursive-call style): build `parent-first` merge (D-19):

```
resolve(themeId) → if not in manifest map → throw ThemeNotFoundError (D-20, fails-closed)
visit(themeId, stack: Set) → if themeId in stack → throw ThemeCycleError(cycle path)
                             else mark, recurse on extends (if present), merge parent manifest then overlay child (recursive deep merge — CR-01), unmark
```

Cycle error (D-19/D-21) shape mirrors `MigrationConflictError` (lines 27–39) — carries the **conflicting/graph detail in constructor fields** (`readonly conflictingId, readonly owners`) so consumers can render the cycle path without string parsing.

Recursion style: repo is comfortable with private recursive helpers + state maps (see `planner.ts` private helpers `selectRollbackSet`, `assert*`). Prefer pure function per import: export `resolveThemeInheritance` `interface` + `class ThemeInheritanceResolver` constructor-injecting a manifest lookup (`{ get(themeId): ThemeManifest | undefined }`) — like `MigrationPlanner` constructor (lines 52–56).

**Fail-open at `resolve()` boundary (D-20):** the inheritance resolver throws `ThemeNotFound`/`ThemeCycle` (fails-closed inside the step); `ThemeResolver.resolve()` catches and falls back to platform/default (fails-open at API). Two-layer policy — see `lifecycle.ts` comment at lines 108–114 where catch inside a transition keeps state consistent.

---

### `theme-errors.ts` (error hierarchy)

**Analog:** `packages/core/src/kernel-errors.ts` (105 lines, read fully). **D-22 mandates extending `KernelError` — do NOT copy the identity errors.ts pattern (it extends bare `Error`); copy only its code-union typing for the code constants.**

**Exact subclass pattern to replicate** (`kernel-errors.ts` lines 45–49):

```typescript
export class RegistrationError extends KernelError {
  constructor(message: string, details: KernelErrorDetails = {}) {
    super("REGISTRATION_ERROR", message, details);
    this.name = "RegistrationError";
  }
}
```

`KernelError` base (lines 24–43) already provides: `readonly code`, `readonly details`, `toJSON()`. Theme errors define a **theme-prefixed code union** (D-22 — "no string-matching") modeled on `apps/identity/src/domain/errors.ts` lines 8–13:

```typescript
export type ThemeErrorCode =
  | "THEME_NOT_FOUND"
  | "THEME_CYCLE"
  | "THEME_VERSION"
  | "THEME_VALIDATION"
  | "THEME_COMPATIBILITY"
  | "THEME_AUTHORIZATION";
```

**Phase-2 raises:** `ThemeNotFoundError` (missing id in inheritance — throws), `ThemeCycleError` (cycle — throws with cycle path in `details`), `ThemeVersionError` (version/orm range mismatch), `ThemeValidationError` (schema-invalid assignments — sequential pattern: Zod `.safeParse` → throw with `{ issues }`, see `kernel.ts` `register()` lines 293–301). **Declared not raised (D-21):** `ThemeCompatibilityError` / `ThemeAuthorizationError` — a `// gated` comment in the file body is the precedent for "gate placed in code" (see `migrations/src/errors.ts` line 14: `(Phase 2) MigrationCompilationError, ...` in the hierarchy comment — list them in the file header hierarchy comment but no subclass body yet, or bodies that map; flag for planner, no raise sites).

**Hierarchy-comment convention:** `migrations/src/errors.ts` lines 5–16 shows the ASCII hierarchy block at top of file; keep the same in `theme-errors.ts`.

**Details payload on preference:** `UserNotFoundError` (identity errors.ts lines 40–45) — full constructor message building

```ts
export class UserNotFoundError extends IdentityError {
  constructor(userId: string) {
    super("USER_NOT_FOUND", `User not found: ${userId}`, { userId });
    this.name = "UserNotFoundError";
  }
}
```

Use the same for Theme* errors — errors built with typed args + structured details.

---

### `theme-events.ts` (publish `source` / assignmentChanged event)

**Analog:** `apps/identity/src/application/identity-capabilities.ts` private `publish()` (lines 125–138) — domain-service mutation then event publish, awaited:

```ts
async create(input: CreateUserCapabilityInput): Promise<{ user: UserSnapshot }> {
  const user = this.service.create(input);
  await this.publish(identityUserCreatedEvent, { user: toUserSnapshot(user) }, user.id);
  return { user: toUserSnapshot(user) };
}
private publish(type: ..., payload: IdentityEventPayload, aggregateId: string): Promise<MosaixEventEnvelope> {
  return this.app.publish(type, IDENTITY_EVENT_VERSION, payload, {
    correlationId: this.correlationId(),
    security: { classification: "internal", pii: true },
    metadata: { aggregate: "User", aggregateId },
  });
}
```

Constants + payload types ALREADY EXIST in `packages/contracts/src/theme/theme-events.ts` (lines 22–47): `themeAssignmentChangedEvent = "theme.assignment.changed"` and `themeChangedEvent` with typed payloads (`ThemeAssignmentChangedPayload`, `ThemeChangedPayload`). Phase 2 runtime code imports these — do **not** duplicate constants.

- **Store mutation → publish:** the AssignmentsStore port does NOT own publishing (layering: store is persistence; DomainEventBus is in kernel). **Which step publishes?** Follow `identity-capabilities.ts` layering: the store re-orchestration in `theme-resolver.ts` (or a small `theme-application.ts` layer, planner discretion — the resolver holds the bus reference or the store receives a callback; prefer resolver scope per D-18 "on mutation" + the C-006 integration point).
- `themeChangedEvent` payload is string-typed (`mode: string`, not `ThemeMode`) per contract test `theme-events.test.ts` lines 54–64 — the resolver's emitter produces plain strings.

---

### Barrel `packages/core/src/index.ts` (modified)

**Export convention** — grouped `export {}` / `export type {}` per module with a `// ─── Section ───` comment header (existing file lines 5–93; template sections: `// Theme Resolution` after line 82):

```typescript
// Theme
export { ThemeTargetRegistry } from "./theme/theme-target-registry";
export type { ThemeTargetEntry } from "./theme/theme-target-registry";
export { ThemeResolver } from "./theme/theme-resolver";
...
```

Or `Export { KernelError, ... } from "./kernel-errors"` syntax (lines 5–16 for module with many values). Keep per-package single barrel (CONVENTIONS.md line 141 "no deep imports").

---

## Shared Patterns

### Import organization (CONVENTIONS.md lines 56–69, seen in kernel.ts lines 21–55 and user-service.ts lines 9–27)

```
1. External/workspace (`@mosaix/contracts`, `@mosaix/types`, `zod`, node builtins)
2. Blank line
3. Relative imports (`./user-repository`, `../events/identity-events`)
```

Type-only required everywhere: `import type { ThemeResolutionContext } from "@mosiar/contracts";` (kernel.ts 21, user-service.ts 11). Splitvalue/type imports into separate statements (`user-service.ts` lines 20–27 import values then `type CreateUserInput` inline).

### JSDoc header convention (every source file)

`kernel.ts` lines 1–19:

```
/**
 * @mosaix/core — Runtime Kernel
 *
 * Minimal orchestration core (ADR-0002). ... [why]
 *
 * Depends on: ...
 * Consumed by: ...
 */
```

Phase 2 files: header with purpose, **ADR/PRD refs** (PRD-0008 §8, ADR-0007, D-numbers), dependency direction, consumers. Boxed section separators `// ─── Module System (ADR-0002) ────` (kernel.ts line 180).

### Error-handling norms (CONVENTIONS.md lines 70–96)

- Throw typed `XxxError` subclasses; never raw strings or bare `Error`.
- Uneven lookups return `undefined`, mutations throw (`require`-style private helpers: `user-service.ts` `requireUser` 145–149).
- Catch `unknown` and narrow with `instanceof` / `asKernelError(error)` helper.
- Zod .safeParse -> thrown typed validation error with issue list (kernel.ts 293–301).

### Tests (vitest + `expectTypeOf` + fixture constants)

`capabilities-registry.test.ts` (139 lines) = per-file `describe`/`it` with `beforeEach` constructing the SUT, `entry()` fixture factory for overrides (lines 9–18). `user-service.test.ts` (245 lines) = `createHarness()` factory injecting deterministic `now`/`idGenerator` (lines 14–23), `VALID_INPUT` UPPER_SNAKE fixture, error assertions via `.toThrow(XxxError)`. `theme-contracts.test.ts` uses `expectTypeOf<T>().toEqualTypeOf<...>` structural locking (lines 11, 40–191) — add `expectTypeOf` assertions to seal the pipeline's partial-result shapes as Phase 1 did for contract shapes. Co-located `*.test.ts` next to source (CONVENTIONS line 7).

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md + the D-numbers above):

| File                            | Role    | Data Flow | Reason / substitution                                                                                                                                                                                                                                                            |
| ------------------------------- | ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-inheritance-resolver.ts` | service | DFS graph | No DFS / `extends`-graph code exists. Borrow from `planner.ts` Map-loop validation + `migrations/errors.ts` conflict-details pattern; cycle-visit state can be a `Set` added per node (`lifecycle.ts` `TRANSITIONS` map + `history` array give the “track visited state” idiom). |

---

## Metadata

**Analog search scope:** `packages/core/src/`, `packages/contracts/src/theme/`, `apps/identity/src/{domain,infrastructure,application,events}/`, `packages/migrations/src/`, `packages/ports/database/src/`
**Files scanned:** 20 read (`kernel.ts`, `lifecycle.ts`, `capability-registry.ts` + test, `kernel-errors.ts`, `event-bus.ts`, `event-schema-registry.ts`, `index.ts` (core + contracts), 6 theme contracts + tests, `user-repository.ts`, `in-memory-user-repository.ts`, `user-service.ts` + test, `errors.ts`, `identity-capabilities.ts`, `identity-events.ts`, `store.ts`, `planner.ts`, `errors.ts` migrations, `ports/database/` index)
**Pattern extraction date:** 2026-08-09
