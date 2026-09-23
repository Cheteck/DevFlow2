/**
 * ThemeRuntime — co-located vitest suite (THEME-11, D-20/D-21/D-12, T3-12/13/14).
 *
 * Gates the facade separating EXPLICIT bootstrap (registerTarget / registerTheme)
 * from the runtime path (resolve → compile → cache → inject → notify):
 *   A. bootstrap is explicit — registerTarget feeds the registry; registerTheme
 *      feeds the internal catalog consulted FIRST by the runtime's loadManifest
 *      (the injected fallback is only consulted on a catalog miss);
 *   B. registerTheme validates via ThemeManifestSchema → ThemeValidationError on
 *      a schema breach (D-21), never a bare Zod TypeError (T3-14);
 *   C. never-registers invariant (CONTEXT "Resolution path contains no register
 *      call"): a counting registry wrapper proves apply() performs zero register
 *      calls while resolution still succeeds;
 *   D. fail-open passthrough (D-20): an unassigned target returns a bare
 *      { resolution } outcome — no compile, no inject, no publish;
 *   E. cache-first (03-02 key_link, roadmap #2): repeat apply() with the SAME
 *      themeId:version:mode returns the SAME CompiledTheme reference and the
 *      compiler runs exactly once (module-level compile wrapper);
 *   F. inject failure propagates as ThemeInjectionError (THEME-12) and no
 *      publish occurs — notify is strictly AFTER inject (ordering, T3-13);
 *   G. theme.changed is published after injection with the schema-validated
 *      payload { theme, mode, version, appliedAt, target? }; the root's
 *      inject-time timestamp precedes the payload's appliedAt; exactly ONE
 *      publish per apply (T3-15);
 *   H. D-12 wiring: createThemeRuntime registers theme.changed@1.0.0 with
 *      ThemeChangedPayloadSchema (EventsModule mirror, single-owner rule) and
 *      appends the envelope to the EventStore; a schema-tampered payload makes
 *      publish throw EventError via validatePayload (T3-12).
 *
 * The compiler is module-mocked (wrapper delegating to the real implementation)
 * so test E can COUNT compile invocations across the cache-miss path.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ThemeAssignment,
  ThemeChangedPayload,
  ThemeManifest,
  ThemeMode,
  ThemeResolutionContext,
  ThemeTarget,
} from "@mosaix/contracts";
import { themeChangedEvent } from "@mosaix/contracts";
import { ThemeChangedPayloadSchema } from "@mosaix/schemas";

import { EventError } from "../kernel-errors";
import { EventStore } from "../event-bus";
import { EventSchemaRegistry } from "../event-schema-registry";
import { InMemoryThemeAssignmentsStore } from "./in-memory-theme-assignments-store";
import { compile } from "./theme-compiler";
import { ThemeInjectionError, ThemeValidationError } from "./theme-errors";
import { ThemeInjector, type ThemeRoot } from "./theme-injector";
import type { ThemeTargetRegistration } from "./theme-target-registry";
import { ThemeTargetRegistry } from "./theme-target-registry";
import {
  THEME_CHANGED_EVENT_VERSION,
  THEME_RUNTIME_DEFAULT_TENANT,
  THEME_RUNTIME_OWNER_APP,
  ThemeRuntime,
  createThemeRuntime,
  type ThemeChangedPublisher,
  type ThemeRuntimeFactoryOptions,
  type ThemeRuntimeOptions,
} from "./theme-runtime";

// ─── Compiler wrapper: count compile invocations (test E) ───────────────
vi.mock("./theme-compiler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./theme-compiler")>();
  return {
    ...actual,
    compile: vi.fn((manifest: ThemeManifest, mode: ThemeMode) =>
      actual.compile(manifest, mode),
    ),
  };
});

// ─── Fixtures ───────────────────────────────────────────────────────────

const blockRegistration: ThemeTargetRegistration = {
  type: "block",
  capabilities: { userSelectable: true, adminConfigurable: false },
};

const topTarget: ThemeTarget = { type: "block", id: "top" };
const forestTarget: ThemeTarget = { type: "block", id: "forest" };
const ghostTarget: ThemeTarget = { type: "block", id: "ghost" };

function oceanManifest(): ThemeManifest {
  return {
    id: "ocean",
    name: "Ocean",
    version: "1.0.0",
    type: "theme",
    metadata: { name: "Ocean" },
    tokens: { colors: { primary: "#1e73e8" }, spacing: { md: "16px" } },
    modes: { dark: { colors: { primary: "#0a3d62" } } },
  };
}

function forestManifest(): ThemeManifest {
  return {
    id: "forest",
    name: "Forest",
    version: "2.0.0",
    type: "theme",
    metadata: { name: "Forest" },
    tokens: { colors: { primary: "#3a7d44" } },
  };
}

function assignment(): ThemeAssignment {
  return {
    target: topTarget,
    themeId: "ocean",
    version: "1.0.0",
    mode: "dark",
    source: "admin",
    updatedAt: "2026-08-10T01:00:00.000Z",
    updatedBy: "alice",
  };
}

function makeStore(): InMemoryThemeAssignmentsStore {
  return new InMemoryThemeAssignmentsStore();
}

/** Structural stub root whose style writes record the inject-time timestamp. */
function makeRecordedRoot() {
  const root: {
    style: {
      setProperty: ReturnType<typeof vi.fn>;
      removeProperty: ReturnType<typeof vi.fn>;
    };
    appliedAt: number;
  } = {
    style: { setProperty: vi.fn(), removeProperty: vi.fn() },
    appliedAt: 0,
  };
  root.style.setProperty.mockImplementation(() => {
    root.appliedAt = Date.now();
  });
  return root;
}

/** Default runtime harness: block target + ocean catalog + no fallback provider. */
function makeRuntime(overrides: Partial<ThemeRuntimeOptions> = {}): {
  runtime: ThemeRuntime;
  registry: ThemeTargetRegistry;
  store: InMemoryThemeAssignmentsStore;
} {
  const registry = new ThemeTargetRegistry();
  const store = makeStore();
  const runtime = new ThemeRuntime({ registry, store, ...overrides });
  runtime.registerTarget(blockRegistration);
  runtime.registerTheme(oceanManifest());
  return { runtime, registry, store };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeRuntime (THEME-11)", () => {
  it("A: bootstrap explicit — registerTarget feeds registry; registerTheme feeds the catalog first (fallback only on miss)", async () => {
    const fallback = vi.fn((themeId: string): ThemeManifest | undefined =>
      themeId === "forest" ? forestManifest() : undefined,
    );
    const { runtime, registry, store } = makeRuntime({
      loadManifest: fallback,
      publish: vi.fn(),
    });

    expect(registry.get("block")).toBeDefined();

    store.assign(assignment());

    const ctx: ThemeResolutionContext = { target: topTarget };
    const outcome = await runtime.apply(ctx);
    expect(outcome.compiled).toBeDefined();
    expect(fallback).not.toHaveBeenCalled();

    store.assign({
      target: forestTarget,
      themeId: "forest",
      version: "2.0.0",
      mode: "light",
      source: "admin",
    });
    const forestOutcome = await runtime.apply({ target: forestTarget });
    expect(fallback).toHaveBeenCalledWith("forest");
    expect(forestOutcome.compiled).toBeDefined();
  });

  it("B: registerTheme validates via ThemeManifestSchema → ThemeValidationError (never bare Zod) ", () => {
    const { runtime } = makeRuntime();
    expect(() =>
      runtime.registerTheme({ ...oceanManifest(), version: "1.0" }),
    ).toThrow(ThemeValidationError);
    expect(() =>
      runtime.registerTheme({ ...oceanManifest(), version: "1.0" }),
    ).not.toThrow(TypeError);
  });

  it("C: never-registers invariant — apply() performs zero register calls on a counting registry", async () => {
    class CountingRegistry extends ThemeTargetRegistry {
      public registerCalls = 0;
      override register(registration: ThemeTargetRegistration): void {
        this.registerCalls += 1;
        super.register(registration);
      }
    }
    const registry = new CountingRegistry();
    const store = makeStore();
    const runtime = new ThemeRuntime({ registry, store, publish: vi.fn() });
    runtime.registerTarget(blockRegistration);
    runtime.registerTheme(oceanManifest());
    expect(registry.registerCalls).toBe(1);

    store.assign(assignment());
    registry.registerCalls = 0;

    const outcome = await runtime.apply({ target: topTarget });
    expect(registry.registerCalls).toBe(0);
    expect(outcome.resolution.resolved).toBeDefined();
    expect(outcome.compiled).toBeDefined();
  });

  it("D: fail-open passthrough — unassigned target returns bare { resolution }, no publish", async () => {
    const publish = vi.fn();
    const { runtime } = makeRuntime({ publish });

    const outcome = await runtime.apply({ target: ghostTarget });
    expect(outcome.resolution.resolved).toBeUndefined();
    expect(outcome.resolution.error).toBeUndefined();
    expect(outcome.compiled).toBeUndefined();
    expect(outcome.appliedAt).toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });

  it("E: cache-first — repeat apply returns the SAME CompiledTheme; compiler runs exactly once", async () => {
    const { runtime, store } = makeRuntime({ publish: vi.fn() });
    store.assign(assignment());
    vi.mocked(compile).mockClear();

    const ctx: ThemeResolutionContext = { target: topTarget };
    const first = await runtime.apply(ctx);
    const second = await runtime.apply(ctx);

    expect(first.compiled).toBeDefined();
    expect(second.compiled).toBe(first.compiled); // SAME reference (03-02 key_link)
    expect(compile).toHaveBeenCalledTimes(1); // compile only on the cache miss
  });

  it("F: inject failure raises ThemeInjectionError and no publish occurs (inject before notify)", async () => {
    const publish = vi.fn();
    const injector = new ThemeInjector();
    injector.register({} as ThemeRoot); // no style surface → fail-closed at flush
    const { runtime, store } = makeRuntime({ injector, publish });
    store.assign(assignment());

    const raised = await runtime.apply({ target: topTarget }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(raised).toBeInstanceOf(ThemeInjectionError);
    expect((raised as ThemeInjectionError).code).toBe("THEME_INJECTION");
    expect(publish).not.toHaveBeenCalled();
  });

  it("G: theme.changed after injection — schema-validated payload, notify strictly after inject, exactly one publish", async () => {
    const publish = vi.fn<ThemeChangedPublisher>();
    const injector = new ThemeInjector();
    const root = makeRecordedRoot();
    injector.register(root);
    const { runtime, store } = makeRuntime({ injector, publish });
    store.assign(assignment());

    const ctx: ThemeResolutionContext = { target: topTarget };
    const outcome = await runtime.apply(ctx);

    expect(publish).toHaveBeenCalledTimes(1);
    const payload = publish.mock.calls[0]![0] as ThemeChangedPayload;
    expect(payload).toEqual({
      theme: "ocean",
      mode: "dark",
      version: "1.0.0",
      appliedAt: expect.any(String),
      target: topTarget,
    });
    expect(payload.appliedAt).toBe(outcome.appliedAt);
    // root writes happened synchronously during inject, BEFORE publish
    expect(root.appliedAt).toBeLessThanOrEqual(Date.parse(payload.appliedAt));
  });

  it("H: D-12 wiring — registry entry + stored envelope; tampered payload throws EventError via validatePayload", async () => {
    const schemas = new EventSchemaRegistry();
    const eventStore = new EventStore();
    const registry = new ThemeTargetRegistry();
    const store = makeStore();
    const runtime = createThemeRuntime({
      registry,
      store,
      schemas,
      eventStore,
    } satisfies ThemeRuntimeFactoryOptions);
    runtime.registerTarget(blockRegistration);
    runtime.registerTheme(oceanManifest());
    store.assign(assignment());

    const outcome = await runtime.apply({ target: topTarget });
    expect(outcome.appliedAt).toBeDefined();

    const entry = schemas.get(themeChangedEvent, THEME_CHANGED_EVENT_VERSION);
    expect(entry).toBeDefined();
    expect(entry!.ownerApp).toBe(THEME_RUNTIME_OWNER_APP);
    expect(entry!.payloadSchema).toBe(ThemeChangedPayloadSchema);

    const stored = eventStore.query(
      THEME_RUNTIME_DEFAULT_TENANT,
      themeChangedEvent,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.envelope.payload).toMatchObject({
      theme: "ocean",
      mode: "dark",
      version: "1.0.0",
    });
    expect(stored[0]!.envelope.source.application).toBe(
      THEME_RUNTIME_OWNER_APP,
    );

    // Tamper the registered payload contract: the (valid) payload must now be
    // rejected by validatePayload → EventError from publish, before append.
    schemas.register({
      type: themeChangedEvent,
      version: THEME_CHANGED_EVENT_VERSION,
      ownerApp: THEME_RUNTIME_OWNER_APP,
      schema: {},
      payloadSchema: {
        safeParse: () => ({
          success: false as const,
          error: { issues: [{ path: ["mode"], message: "tampered" }] },
        }),
      },
    });
    const raised = await runtime.apply({ target: topTarget }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(raised).toBeInstanceOf(EventError);
    expect(
      eventStore.query(THEME_RUNTIME_DEFAULT_TENANT, themeChangedEvent),
    ).toHaveLength(1);
  });

  it("hot-switch ≤ 100 ms — cached path, 42 roots (THEME-09 criterion #2)", async () => {
    // 42 roots >= INJECTOR_BATCH_THRESHOLD → batching path; deterministic
    // synchronous rAF (no wall-clock sleeps, 03-03 verification note).
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    try {
      const injector = new ThemeInjector();
      const roots = Array.from({ length: 42 }, () => ({
        style: { setProperty: vi.fn(), removeProperty: vi.fn() },
      }));
      for (const root of roots) injector.register(root);
      const { runtime, store } = makeRuntime({ injector, publish: vi.fn() });
      store.assign(assignment());
      const ctx: ThemeResolutionContext = { target: topTarget };

      // Warm-up run EXCLUDED from timing: compiles + caches + injects.
      await runtime.apply(ctx);
      injector.flush();

      const t0 = performance.now();
      await runtime.apply(ctx);
      injector.flush();
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(100);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
