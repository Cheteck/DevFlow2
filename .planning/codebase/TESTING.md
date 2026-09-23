# Testing Patterns

**Analysis Date:** 2026-08-08

## Test Framework

**Runner:**

- Vitest ^3.0.0 (single root config: `vitest.config.ts`)
- Environment: `node`
- Include globs: `packages/**/*.test.ts`, `apps/**/*.test.ts`, `demo/**/*.test.ts`, `src/**/*.test.ts`
- 52 test files across the monorepo (heaviest: `packages/migrations/src/index.test.ts`, `packages/core/src/kernel.test.ts`, `packages/migrations/src/schema-builder.test.ts`)

**Assertion Library:**

- Built-in Vitest `expect` (no separate assertion lib): `toBe`, `toEqual`, `toThrow`, `toHaveLength`, `toBeUndefined`, `toBeInstanceOf`, `toContain`, `.resolves` / `.rejects`

**Run Commands:**

```bash
pnpm test               # vitest run (single pass)
pnpm test:watch         # vitest (watch mode)
pnpm test:coverage      # vitest run --coverage
pnpm check              # build + lint + test + prettier --check
```

**CI:** `.github/workflows/ci.yml` runs on push to `main` and PRs: `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm lint` → `pnpm test` → `pnpm exec prettier --check .` (Node 22, pnpm 11)

## Test File Organization

**Location:**

- Co-located with implementation: `packages/core/src/kernel.ts` → `packages/core/src/kernel.test.ts`; `apps/identity/src/domain/user-service.ts` → `apps/identity/src/domain/user-service.test.ts`
- App-level integration tests at the app barrel: `apps/identity/src/index.test.ts`
- Cross-app composition tests live in `demo/identity-sales.test.ts` (deliberately not in an app — BACs cannot import each other per eslint-plugin-boundaries)
- No separate `__tests__/` or `test/` directories; no shared fixtures directory

**Naming:**

- `*.test.ts` (never `*.spec.ts`); the test file mirrors the implementation filename (`uuid.ts` → `uuid.test.ts`)

**Structure:**

```
packages/core/src/kernel.test.ts     # co-located unit/integration
apps/identity/src/index.test.ts      # app integration (boots real kernel)
demo/identity-sales.test.ts          # cross-BAC composition test
```

## Test Structure

**Suite Organization:**

- `describe` title format: `"<package>: <subject> — <scenario>"`, e.g. `core: RuntimeKernel — registration & discovery`, `identity: UserService.create`, `migrations: SQLiteGrammar`
- Acceptance criteria referenced in describe titles: `core: RuntimeKernel — manifest validation (T-18)`
- `beforeEach` recreates fresh fixtures; tests never share mutable state
- `it("plain-language behavior", ...)` — one behavior per test

```typescript
describe("core: RuntimeKernel — registration & discovery", () => {
  let kernel: RuntimeKernel;

  beforeEach(() => {
    kernel = new RuntimeKernel();
  });

  it("registers an app in discovered state", () => {
    kernel.register(manifest("identity"));
    expect(kernel.has("identity")).toBe(true);
    expect(kernel.getStatus("identity")).toBe("discovered");
  });
});
```

(`packages/core/src/kernel.test.ts`)

**Patterns:**

- Per-file factory helpers construct fixtures concisely: `manifest(id, events?)`, `capability(id, ownerApp)`, `envelope(type, payload)` in `kernel.test.ts`; `createHarness()` in `user-service.test.ts`; `rawMigration(id, content, resources)` in `packages/adapters/database-sqlite/src/index.test.ts`
- Module-scope fixture constants at the top of the file: `const TENANT: TenantIdentity = { organizationId: "acme-corp", spaceId: "retail-chain" }`, `VALID_INPUT`, `MANIFEST`
- Non-null assertion `!` used for array/optional access under `noUncheckedIndexedAccess`: `store.query(TENANT)[0]!.envelope.type`
- `void runtime;` consumes unused destructured vars (`kernel.test.ts` manifest validation)
- Import ordering matches source conventions: workspace packages first, blank line, relative imports; `import type` for type-only imports

## Mocking

**Framework:** Vitest built-ins — `vi.fn()`, `vi.spyOn()`.

**Patterns:**

```typescript
// Handler mocks
const handler = vi.fn(async () => {
  throw new Error("handler boom");
});
bus.subscribe("order.created", handler, "sales");
expect(handler).toHaveBeenCalledTimes(2);

// Console spying (restored in the same test)
const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
logger.info("hello", { app: "identity" });
const record = JSON.parse(spy.mock.calls[0]![0] as string);
spy.mockRestore();
```

(`packages/core/src/event-bus.test.ts`, `packages/core/src/observability.test.ts`, `packages/sdk/src/helpers.test.ts`)

**What to Mock:**

- Cross-cutting side effects only: console output, async handlers that throw, permission-check callbacks (`allowAll()` stub in `event-bus.test.ts`)
- Functions whose behavior is irrelevant to the assertion

**What NOT to Mock:**

- Ports/adapters: use real in-memory implementations — `InMemoryUserRepository` (`apps/identity/src/infrastructure/in-memory-user-repository.ts`), `InMemoryMigrationStore`, or file-local fake port classes implementing the interface: `class FakeDatabasePort implements DatabasePort { ... }` (`packages/migrations/src/schema-builder.test.ts`)
- Time and IDs: injected via constructor options (`now: () => "2026-08-05T00:00:00.000Z"`, `idGenerator: () => "user-1"` in `createHarness()`) — deterministic without `vi.useFakeTimers` (no `vi.useFakeTimers` anywhere in the suite)
- Adapter tests run against the real implementation: `SQLiteDatabaseAdapter` uses `node:sqlite` (`packages/adapters/database-sqlite/src/index.test.ts`)

## Fixtures and Factories

**Test Data:**

```typescript
function createHarness() {
  let idSeq = 0;
  let clock = 0;
  const repository = new InMemoryUserRepository();
  const service = new UserService(repository, {
    now: () => `2026-08-05T00:00:${String(clock++).padStart(2, "0")}.000Z`,
    idGenerator: () => `user-${++idSeq}`,
  });
  return { service, repository };
}

const VALID_INPUT = {
  email: "Ada@Example.com",
  displayName: "Ada Lovelace",
  password: "correct-horse",
};
```

(`apps/identity/src/domain/user-service.test.ts`)

**Location:**

- Fixtures and factories are file-local — there is no shared fixtures/factory module; each test file defines what it needs inline

## Coverage

**Requirements:** No threshold enforced. Coverage is opt-in via `pnpm test:coverage`.

**Configuration** (`vitest.config.ts`):

- Provider: `v8`; reporters: `text`, `html`
- `include: ["packages/**/src/**/*.ts"]`, `exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.ts"]`
- Note: coverage includes `packages/**` source only — `apps/`, `demo/`, and `src/` are not counted

**View Coverage:**

```bash
pnpm test:coverage
```

## Test Types

**Unit Tests:**

- Domain services: `apps/identity/src/domain/user-service.test.ts`, `identity-capabilities.test.ts`, `events/identity-events.test.ts`
- Registries & bus: `packages/core/src/event-bus.test.ts`, `capability-registry.test.ts`, `event-schema-registry` (in `event-bus.test.ts`), `kernel-module.test.ts`, `invariants.test.ts`
- Migrations: `packages/migrations/src/schema-builder.test.ts`, `index.test.ts` (registry, planner, runner, store, checksum, grammar)
- Adapters: one test per adapter package (`packages/adapters/*/src/index.test.ts`) — e.g. database-sqlite exercises the full migrate pipeline against a real SQLite file
- Schemas: `packages/schemas/src/index.test.ts` validates Zod schemas via `safeParse` success/failure
- Types/config/sdk helpers: `packages/types/src/uuid.test.ts`, `packages/config/src/config.test.ts`, `packages/sdk/src/helpers.test.ts`, `packages/sdk/src/index.test.ts`

**Integration Tests:**

- `apps/identity/src/index.test.ts`: boots `createIdentityApp` on a real `RuntimeKernel`, calls `kernel.start()`, executes capabilities through the authorization boundary, verifies event publication with PII/aggregate metadata
- `apps/sales/src/index.test.ts`: same pattern for the Sales BAC

**E2E / Cross-app:**

- `demo/identity-sales.test.ts`: composition-layer test where Sales consumes `identity.user.created` and publishes `sales.order.created` on one shared kernel
- No browser/UI tests; no Playwright/Cypress

## Common Patterns

**Async Testing:**

```typescript
await expect(bus.publish(evt, "identity")).rejects.toThrow(/Permission denied/);
await expect(kernel.bus.publish(evt, "identity")).resolves.toBeUndefined();
```

(`packages/core/src/kernel.test.ts`, `event-bus.test.ts`)

**Error Testing:**

```typescript
// Match the class for typed errors
expect(() => service.create({ ...VALID_INPUT, email: "not-an-email" })).toThrow(
  ValidationError,
);
// And/or the message regex for message assertions
expect(() => service.create({ ...VALID_INPUT, password: "short" })).toThrow(
  /at least 8 characters/,
);
```

(`apps/identity/src/domain/user-service.test.ts`)

**Behavioral assertions:**

- State-machine history: `expect(entry.lifecycle.events().map((e) => e.to)).toEqual(["initializing", "active"])` (`kernel.test.ts`)
- Hook call tracking: `expect(states).toEqual(["identity:initializing", "identity:active"])`
- Dead-letter inspection: `expect(bus.deadLetters()[0]!.attempts).toBe(2)` (`event-bus.test.ts`)
- `expect(store.query(TENANT)).toHaveLength(1)` for side-effect counting

**Negative path coverage is expected:** every thrown error path has a test (duplicate registration, invalid manifest, unauthorized publish, unknown capability, missing executor, invalid lifecycle transitions).

---

_Testing analysis: 2026-08-08_
