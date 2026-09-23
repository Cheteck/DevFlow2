# Coding Conventions

**Analysis Date:** 2026-08-08

## Naming Patterns

**Files:**

- kebab-case for all source files: `user-service.ts`, `kernel-module.ts`, `event-bus.ts`, `in-memory-user-repository.ts`, `kernel-errors.ts`
- Co-located test files: `*.test.ts` next to the implementation (`src/user-service.ts` → `src/user-service.test.ts`)
- Barrel exports named `index.ts` in every package/app (`packages/core/src/index.ts`, `apps/identity/src/index.ts`)
- Ports and adapters must have distinct basenames (absolute rule in `AGENTS.md`): port `apps/identity/src/domain/user-repository.ts` vs adapter `apps/identity/src/infrastructure/in-memory-user-repository.ts`

**Classes:**

- PascalCase: `RuntimeKernel`, `UserService`, `DomainEventBus`, `EventStore`, `MosaixApp`, `ConsoleLogger`, `IdentityCapabilities`, `SchemaBuilder`, `MigrationRunner`

**Functions:**

- camelCase: `uuidV7`, `hashPassword`, `verifyPassword`, `normalizeEmail`, `asKernelError`, `createIdentityApp`, `describeTenant`
- Factory functions prefixed with `create` (`createIdentityApp` in `apps/identity/src/index.ts`, `createExecutionContext` in `packages/core/src/observability.ts`)

**Variables:**

- camelCase; module-scope constants in UPPER_SNAKE_CASE: `MIN_PASSWORD_LENGTH`, `IDENTITY_EVENT_VERSION`, `VERSION_MASK` in `packages/types/src/uuid.ts`
- Test fixture constants in UPPER_SNAKE_CASE: `TENANT`, `MANIFEST`, `VALID_INPUT` (see `packages/core/src/kernel.test.ts`, `apps/identity/src/domain/user-service.test.ts`)
- Private members use plain `private readonly` — no underscore prefix (`kernel.ts`, `user-service.ts`)

**Types/Interfaces:**

- PascalCase. Suffix conventions:
  - `Port` for port abstractions: `TracingPort`, `SpanPort` in `packages/ports/tracing/src/index.ts`; `DatabasePort` in `packages/ports/database`
  - `Options` for constructor option bags: `KernelOptions` (`packages/core/src/kernel.ts`), `UserServiceOptions` (`apps/identity/src/domain/user-service.ts`), `IdentityCapabilitiesOptions`, `MosaixAppConfig`
  - `Config` for configuration objects: `KernelConfig` (`packages/core/src/kernel-module.ts`)
- Union type aliases model state machines: `KernelPhase = "stopped" | "starting" | "started" | "stopping" | "failed"` (`kernel.ts`), `IdentityErrorCode` (`apps/identity/src/domain/errors.ts`)
- `readonly` on interface fields and `readonly string[]` arrays for immutable data

**Errors:**

- `XxxError` classes extending a domain base error; each package owns its hierarchy:
  - `KernelError` + subclasses in `packages/core/src/kernel-errors.ts`
  - `MigrationError` + subclasses in `packages/migrations/src/errors.ts`
  - `IdentityError` + subclasses in `apps/identity/src/domain/errors.ts`

## Code Style

**Formatting:**

- Prettier 3 (`prettier.config.json`): semicolons required, **double quotes**, tabWidth 2, `trailingComma: "es5"`, `printWidth: 100`, `endOfLine: "lf"`
- Run: `pnpm format` (`prettier --write .`); verify: `pnpm exec prettier --check .` (part of `pnpm check`)
- `.prettierignore` excludes `AGENTS.md`, `.project/`, `pnpm-lock.yaml` (governance docs follow manual formatting)

**Linting:**

- ESLint 9 flat config `eslint.config.mjs`: `js.configs.recommended` + `tseslint.configs.recommended` + `eslint-plugin-boundaries` (boundaries/element-types set to `"error"`)
- `eslint-plugin-boundaries` enforces dependency direction across package types (`types` → `contracts` → `schemas` → `ports` → `core` → `sdk` → `apps`); each package declares its layer in `package.json` under `"eslintBoundaries": { "type": "core" }`
- Lint command: `pnpm lint` (`eslint . --ext .ts,.tsx`)

**TypeScript:**

- Root `tsconfig.json` (base) is strict with: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`, `isolatedModules`, `verbatimModuleSyntax`, `esModuleInterop: false`, `target: ES2022`
- ESM only: every package.json sets `"type": "module"`; imports use explicit `.js`-free specifiers resolved via `moduleResolution: "Bundler"`

## Import Organization

**Order:**

1. External/workspace packages (`@mosaix/contracts`, `@mosaix/core`, `@mosaix/sdk`, `@mosaix/types`, `zod`, node builtins)
2. Blank line
3. Relative imports (`./user-repository`, `../events/identity-events`)

**Type-only imports:**

- Use `import type` for anything consumed only as a type (mandatory under `verbatimModuleSyntax`): `import type { TenantIdentity } from "@mosaix/contracts"` (`kernel.ts`)
- Mixed imports keep values and types in the same specifier list with inline `type` modifiers: `import { MosaixEventEnvelopeSchema, type ... }` — actually split: `import { ApplicationManifestSchema } from "@mosaix/schemas"` and `import type { ApplicationManifest } from "@mosaix/contracts"`
- Barrel files re-export with grouped `export { ... }` and `export type { ... }` blocks (`packages/schemas/src/index.ts`)

**Path Aliases:**

- Workspace packages resolved by pnpm `workspace:*` + vitest aliases in `vitest.config.ts` mapping `@mosaix/*` to each package's `src/index.ts` (tests run against source, not `dist`)

## Error Handling

**Patterns:**

- Every API boundary throws typed errors from a per-package hierarchy; base class carries a stable machine-readable `code` + structured `details`:
  ```ts
  export class KernelError extends Error {
    readonly code: string;
    readonly details: KernelErrorDetails;
    toJSON(): Record<string, unknown> { ... }
  }
  ```
  (`packages/core/src/kernel-errors.ts`)
- Subclass per failure condition and set `this.name` in the constructor (`MigrationConflictError`, `MigrationChecksumError` in `packages/migrations/src/errors.ts`; `ValidationError`, `UserNotFoundError` in `apps/identity/src/domain/errors.ts`)
- Identity errors additionally carry a typed `code` union (`IdentityErrorCode`) so consumers branch without string matching (`apps/identity/src/domain/errors.ts`)
- Normalize unknown thrown values at catch boundaries with a helper: `asKernelError(error)` (`kernel-errors.ts`); used in `kernel.ts` `start()`/`stop()`
- Validate external input with Zod `.safeParse` and throw a typed error joining issue paths:
  ```ts
  const parsed = ApplicationManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new RegistrationError(`Invalid application manifest ...`, { issues });
  }
  ```
  (`packages/core/src/kernel.ts` `register()`)
- Catch clauses type the parameter as `unknown`, then narrow with `error instanceof Error` / `error instanceof KernelError`
- Lookups return `undefined` for missing (`lookup()`, `resolve()`, `getStatus()`); mutations throw (`private requireUser()` throws `UserNotFoundError` in `user-service.ts`; `private require()` throws `ServiceNotInstalledError` in `kernel.ts`)
- Never throw raw strings or bare `Error` for domain failures; never leak which part of authentication failed (`InvalidCredentialsError` is the same error for unknown user, wrong password, disabled account — `user-service.ts` `authenticate()`)
- Non-fatal errors during shutdown/drain are caught, logged as warnings, and do not abort the loop (`kernel.ts` `stop()`, `bootstrap()`)

## Logging

**Framework:** Custom `Logger` interface in `packages/core/src/observability.ts` (OpenTelemetry-ready seams); default `ConsoleLogger` emits JSON records via `console.log`/`console.error`. SDK helpers log prefixed strings (`[INFO] [test] ...` in `packages/sdk/src/helpers.ts`).

**Patterns:**

- Signature is `logger.<level>(message, fields?)` — message first, structured fields object second: `this.logger.warn("Module shutdown failed: ...", { error: ... })` (`kernel.ts`)
- Levels: `debug` / `info` / `warn` / `error` (ordered severity map in `observability.ts`)
- Bound fields via `logger.child({ tenant: "acme" })`
- Never log credentials or PII payloads; log error message + context fields, not stack internals
- Production modules do not call `console.*` directly (only the `ConsoleLogger` implementation and SDK helpers do; tests spy on console)

## Comments

**When to Comment:**

- Every source file starts with a header JSDoc block: purpose, ADR/PRD references, dependency direction, and consumers (`kernel.ts`, `kernel-module.ts`, `identity-capabilities.ts`)
- Public methods and non-obvious members get JSDoc (`/** Register a capability declared by a specific application. */` in `kernel.ts`)
- Inline comments explain _why_, not what: e.g. the authenticate-equivalence note and the UUID v7 byte-lane wraparound note (`packages/types/src/uuid.ts`)
- Section separators use boxed comments: `// ─── Module System (ADR-0002) ────────────────────────────────`

**JSDoc/TSDoc:**

- Used pervasively on exported interfaces/methods; port interfaces document each method (`packages/ports/tracing/src/index.ts`)
- Cross-references to governance artifacts: `(PRD-0006 §33)`, `(R9)`, `(ADR-0002)`, `(ARCH-012)`, `(T-18)`

## Function Design

**Size:** Methods are small and single-purpose; classes keep one responsibility (e.g., `UserService` orchestration, `AppLifecycle` state machine, `SchemaBuilder` DSL builder).

**Parameters:**

- Constructor injection with parameter properties: `constructor(private readonly repository: UserRepository, options: UserServiceOptions = {})` (`user-service.ts`)
- Optional behavior injected as functions for testability: `now?: () => string`, `idGenerator?: () => string` with fallback `options.now ?? (() => new Date().toISOString())`

**Return Values:**

- Async methods return `Promise<...>` and use `async`/`await`; sync domain services return values or throw
- Result shapes are explicit typed objects: `{ user: UserSnapshot }`, `{ applied: readonly string[]; batchId: string }` (`identity-capabilities.ts`, `packages/migrations/src/cli.ts`)
- `unknown` used for capability input/output at generic boundaries: `type CapabilityExecutor = (input: unknown) => Promise<unknown> | unknown` (`kernel.ts`)

## Module Design

**Exports:**

- Barrel `index.ts` per package exposes the public API; `export type { ... }` for type-only re-exports (`packages/schemas/src/index.ts`)
- Errors live in dedicated `errors.ts` files per package
- Ports packages (`packages/ports/*`) export interfaces and types only — no implementation

**Barrel Files:** Single `index.ts` per package; package `main`/`types` point at `./dist/index.js` / `./dist/index.d.ts`; consumers import from the package name (`@mosaix/core`), never deep paths

**Layering:** Dependency direction is enforced by eslint-plugin-boundaries: `schemas` → `contracts` → `types` (downward); `core` may use `schemas/contracts/types/ports`; apps consume `core`, `sdk`, `ports`, `adapters`. BACs never import each other directly (cross-app flows live in `demo/`). A new package must register in `tsconfig.build.json` references + `eslint.config.mjs` element types + `pnpm-workspace.yaml` globs.

---

_Convention analysis: 2026-08-08_
