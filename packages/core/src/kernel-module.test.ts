import { describe, it, expect } from "vitest";
import {
  RuntimeKernel,
  RegistrationError,
  ServiceNotInstalledError,
  CapabilityError,
  KernelError,
  EventsModule,
  CapabilitiesModule,
  PermissionsModule,
  defaultModules,
  DomainEventBus,
  EventStore,
  EventSchemaRegistry,
  PermissionRegistry,
  AuthorizationEngine,
  CapabilityRegistry,
  KERNEL_SERVICE_NAMES,
} from "@mosaix/core";
import type { KernelContext, KernelModule } from "@mosaix/core";
import type { ApplicationManifest, TenantIdentity } from "@mosaix/contracts";

const TENANT: TenantIdentity = {
  organizationId: "acme-corp",
  spaceId: "retail-chain",
};

function manifest(id: string): ApplicationManifest {
  return {
    type: "application",
    id,
    name: id,
    version: "1.0.0",
    metadata: { name: id },
    domain: { entities: [], events: [] },
    runtime: {
      entrypoint: `/${id}.js`,
      isolation: "sandbox",
      engine: "web-worker",
    },
  };
}

function installedOrderModule(name: string, events: string[]): KernelModule {
  return {
    name,
    version: "1.0.0",
    register(ctx: KernelContext) {
      events.push(`register:${name}`);
      void ctx.logger;
      void ctx.tracer;
    },
    initialize() {
      events.push(`initialize:${name}`);
      return Promise.resolve();
    },
    shutdown() {
      events.push(`shutdown:${name}`);
      return Promise.resolve();
    },
  };
}

describe("core: RuntimeKernel — module system (ADR-0002)", () => {
  it("installs default modules providing the facade services", () => {
    const kernel = new RuntimeKernel();
    expect(kernel.listModules().sort()).toEqual([
      "capabilities",
      "events",
      "permissions",
    ]);
    expect(kernel.store).toBeDefined();
    expect(kernel.permissions).toBeDefined();
    expect(kernel.bus).toBeDefined();
    expect(kernel.authz).toBeDefined();
    expect(kernel.capabilities).toBeDefined();
    expect(kernel.eventSchemas).toBeDefined();
  });

  it("installs custom modules and runs them in order (start) / reverse (stop)", async () => {
    const order: string[] = [];
    const kernel = new RuntimeKernel(
      {},
      {
        modules: [
          installedOrderModule("one", order),
          installedOrderModule("two", order),
        ],
      },
    );

    expect(order).toEqual(["register:one", "register:two"]);
    await kernel.start();
    expect(order).toEqual([
      "register:one",
      "register:two",
      "initialize:one",
      "initialize:two",
    ]);

    await kernel.stop();
    expect(order).toEqual([
      "register:one",
      "register:two",
      "initialize:one",
      "initialize:two",
      "shutdown:two",
      "shutdown:one",
    ]);
  });

  it("rejects duplicate module installation", () => {
    const kernel = new RuntimeKernel();
    expect(() => kernel.install(new PermissionsModule())).toThrow(
      RegistrationError,
    );
    expect(() => kernel.install(new PermissionsModule())).toThrow(
      /Module already installed/,
    );
  });

  it("rejects installing a module after start()", async () => {
    const kernel = new RuntimeKernel();
    await kernel.start();
    expect(() =>
      kernel.install({
        name: "late",
        version: "1.0.0",
        register: () => {},
      }),
    ).toThrow(RegistrationError);
  });

  it("a module can provide services through the context", () => {
    const kernel = new RuntimeKernel({}, { modules: [] });
    kernel.install(new PermissionsModule());
    kernel.install(new CapabilitiesModule());
    kernel.install(new EventsModule());

    expect(kernel.permissions).toBeDefined();
    expect(kernel.capabilities).toBeDefined();
    expect(kernel.bus).toBeDefined();
  });

  it("throws ServiceNotInstalledError when a service is missing", () => {
    const kernel = new RuntimeKernel({}, { modules: [] });
    expect(() => kernel.permissions).toThrow(ServiceNotInstalledError);
  });

  it("a module cannot override an already-provided service", () => {
    const kernel = new RuntimeKernel();
    const bad: KernelModule = {
      name: "dup-capabilities",
      version: "1.0.0",
      register(ctx: KernelContext) {
        ctx.setService("capabilities", kernel.capabilities);
      },
    };
    expect(() => kernel.install(bad)).toThrow(RegistrationError);
  });

  it("a custom module can provide an extension service read by another module (T-EXT-01)", async () => {
    interface SearchService {
      query(q: string): string[];
    }
    const searchImpl: SearchService = {
      query: (q) => [`result:${q}`],
    };

    // Module A provides a brand-new domain of service — never touched core.
    const provider: KernelModule = {
      name: "search-provider",
      version: "1.0.0",
      register(ctx: KernelContext) {
        ctx.setService("search", searchImpl);
      },
    };
    // Module B consumes the extension service through getService<T>.
    let consumed: string[] | undefined;
    const consumer: KernelModule = {
      name: "search-consumer",
      version: "1.0.0",
      register(ctx: KernelContext) {
        const search = ctx.getService<SearchService>("search");
        consumed = search?.query("acme");
      },
    };

    const kernel = new RuntimeKernel(
      {},
      { modules: [...defaultModules(), provider, consumer] },
    );
    expect(consumed).toEqual(["result:acme"]);
    // The 6 canonical getters stay typed and available.
    expect(kernel.store).toBeDefined();
    expect(kernel.bus).toBeDefined();
    expect(kernel.capabilities).toBeDefined();
  });

  it("getService returns undefined for a missing extension service (T-EXT-01)", async () => {
    const kernel = new RuntimeKernel({}, { modules: [] });
    const ctx = kernel.moduleContext;
    expect(ctx.getService("search")).toBeUndefined();
    // But a missing known service still throws (canonical contract).
    expect(() => ctx.getService("events")).toThrow(ServiceNotInstalledError);
  });

  it("setService rejects an extension service name that is already provided (T-EXT-01)", () => {
    const kernel = new RuntimeKernel({}, { modules: [] });
    const dup: KernelModule = {
      name: "dup-search",
      version: "1.0.0",
      register(ctx: KernelContext) {
        ctx.setService("search", { query: () => [] });
        ctx.setService("search", { query: () => [] });
      },
    };
    expect(() => kernel.install(dup)).toThrow(RegistrationError);
  });

  it("start() bootstraps registered apps to active", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity"));
    kernel.register(manifest("sales"));
    await kernel.start();
    expect(kernel.getStatus("identity")).toBe("active");
    expect(kernel.getStatus("sales")).toBe("active");
  });

  it("stop() drains ready/active apps to disabled", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity"));
    await kernel.start();
    expect(kernel.getStatus("identity")).toBe("active");
    await kernel.stop();
    expect(kernel.getStatus("identity")).toBe("disabled");
    expect(kernel.phaseState).toBe("stopped");
  });

  it("executeCapability records an ok trace and a metric", async () => {
    const kernel = new RuntimeKernel();
    kernel.register({
      ...manifest("identity"),
      capabilities: [
        {
          id: "user.lookup",
          version: "1.0.0",
          provider: { applicationId: "identity" },
          operations: [{ name: "invoke", input: "in", output: "out" }],
        },
      ],
    });
    kernel.permissions.grant(
      "identity:user.lookup:execute:tenant",
      TENANT,
      "sales",
    );
    kernel.registerCapabilityExecutor("user.lookup", async (input) => ({
      found: true,
      input,
    }));

    await kernel.executeCapability("user.lookup", "sales", TENANT, { id: "u" });

    const traces = kernel.tracing.list();
    expect(traces).toHaveLength(1);
    expect(traces[0]!.action).toBe("capability.execute");
    expect(traces[0]!.status).toBe("ok");
    expect(traces[0]!.actor).toBe("sales");
    expect(kernel.metrics.snapshot()["capability.execute"]).toBe(1);
  });

  it("errors are serializable KernelErrors with stable codes", async () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity"));
    try {
      await kernel.executeCapability("nope", "sales", TENANT, {});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CapabilityError);
      expect(error).toBeInstanceOf(KernelError);
      const asJson = (error as CapabilityError).toJSON();
      expect(asJson.code).toBe("CAPABILITY_ERROR");
      expect(asJson.message).toMatch(/Unknown capability/);
    }
  });

  it("rejects duplicate app registration with RegistrationError", () => {
    const kernel = new RuntimeKernel();
    kernel.register(manifest("identity"));
    expect(() => kernel.register(manifest("identity"))).toThrow(
      RegistrationError,
    );
    expect(() => kernel.register(manifest("identity"))).toThrow(
      /already registered/,
    );
  });

  it("seeds observable seams that modules can consume during register (T-EXT-02)", () => {
    const seen: string[] = [];
    const probe: KernelModule = {
      name: "probe",
      version: "1.0.0",
      register(ctx: KernelContext) {
        seen.push(`logger:${ctx.logger.constructor.name}`);
        seen.push(`metrics:${ctx.metrics.constructor.name}`);
        seen.push(`tracer:${ctx.tracer.constructor.name}`);
      },
    };
    const kernel = new RuntimeKernel(
      {},
      { modules: [...defaultModules(), probe] },
    );
    expect(seen).toEqual([
      "logger:ConsoleLogger",
      "metrics:InMemoryMetrics",
      "tracer:InMemoryTracer",
    ]);
    // The kernel facade exposes the same seams post-wiring.
    expect(kernel.logger.constructor.name).toBe("ConsoleLogger");
    expect(kernel.metrics.constructor.name).toBe("InMemoryMetrics");
    expect(kernel.tracing.constructor.name).toBe("InMemoryTracer");
  });

  it("substitutes observability seams via options.observability (T-EXT-02)", () => {
    const customLogger = { debug() {}, info() {}, warn() {}, error() {} };
    const customMetrics = {
      snapshot: () => ({}),
      record: () => {},
      increment: () => {},
      startTimer: () => () => {},
    };
    const customTracer = {
      startSpan: () => ({ end: () => {} }),
      list: () => [],
    };
    const kernel = new RuntimeKernel(
      {},
      {
        observability: {
          logger: customLogger,
          metrics: customMetrics,
          tracer: customTracer,
        },
      },
    );
    expect(kernel.logger).toBe(customLogger);
    expect(kernel.metrics).toBe(customMetrics);
    expect(kernel.tracing).toBe(customTracer);
    // The seams remain readable through the context for later modules.
    expect(kernel.moduleContext.logger).toBe(customLogger);
    expect(kernel.moduleContext.metrics).toBe(customMetrics);
    expect(kernel.moduleContext.tracer).toBe(customTracer);
  });
});

describe("core: RuntimeKernel — canonical service validation at install (T-EXT-11)", () => {
  /** A manifest declaring a capability so `register()` consumes canonical services. */
  function manifestWithCapability(id: string): ApplicationManifest {
    return {
      ...manifest(id),
      capabilities: [
        {
          id: "user.lookup",
          version: "1.0.0",
          provider: { applicationId: id },
          operations: [{ name: "invoke", input: "in", output: "out" }],
        },
      ],
    };
  }

  /** Full canonical surface provided through the open escape hatch (no built-in module). */
  function customCanonicalModule(): KernelModule {
    const store = new EventStore();
    const schemas = new EventSchemaRegistry();
    const permissions = new PermissionRegistry();
    const capabilities = new CapabilityRegistry();
    const bus = new DomainEventBus(store, (p, t, a) =>
      permissions.check(p, t, a),
    );
    return {
      name: "custom-canonical",
      version: "1.0.0",
      register(ctx: KernelContext) {
        ctx.setService("eventStore", store);
        ctx.setService("eventSchemas", schemas);
        ctx.setService("events", bus);
        ctx.setService("permissions", permissions);
        ctx.setService("authorization", new AuthorizationEngine(permissions));
        ctx.setService("capabilities", capabilities);
      },
    };
  }

  it("fails fast at first use with an install-attributed error listing every missing canonical service", () => {
    const kernel = new RuntimeKernel({}, { modules: [] });

    let error: unknown;
    try {
      void kernel.permissions;
      expect.unreachable();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ServiceNotInstalledError);
    const asKernel = error as ServiceNotInstalledError;
    expect(asKernel.message).toMatch(/installation incomplete/);
    expect(asKernel.details.missingServices).toEqual([...KERNEL_SERVICE_NAMES]);
    // Every missing canonical service is spelled out, not just the requested one.
    for (const name of KERNEL_SERVICE_NAMES) {
      expect(asKernel.message).toContain(name);
    }
  });

  it("surfaces the error at the first register() entry point, not deep inside a registry", () => {
    const kernel = new RuntimeKernel({}, { modules: [] });

    // register() consumes capabilities + eventSchemas → fails fast, aggregated.
    let error: unknown;
    try {
      kernel.register(manifestWithCapability("identity"));
      expect.unreachable();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ServiceNotInstalledError);
    expect((error as Error).message).toMatch(/installation incomplete/);
    expect((error as Error).message).toContain("capabilities");
  });

  it("keeps the legacy per-service error when exactly one canonical service is missing", () => {
    const kernel = new RuntimeKernel(
      {},
      { modules: [new PermissionsModule(), new EventsModule()] },
    );

    // permissions/authorization/events/eventStore/eventSchemas present —
    // only capabilities is consumed & missing → single-service legacy message.
    expect(() => kernel.capabilities).toThrow(
      /Service "capabilities" is not installed/,
    );
  });

  it("accepts a custom module providing canonical services via setService (escape hatch)", () => {
    const kernel = new RuntimeKernel(
      {},
      { modules: [customCanonicalModule()] },
    );

    // The completeness validation passes: every canonical gate resolves.
    expect(kernel.store).toBeDefined();
    expect(kernel.bus).toBeDefined();
    expect(kernel.eventSchemas).toBeDefined();
    expect(kernel.permissions).toBeDefined();
    expect(kernel.authz).toBeDefined();
    expect(kernel.capabilities).toBeDefined();
  });

  it("treats a single canonical service provided via setService as installed (targeted check)", () => {
    const capabilities = new CapabilityRegistry();
    const kernel = new RuntimeKernel(
      {},
      {
        modules: [
          {
            name: "custom-caps",
            version: "1.0.0",
            register(ctx: KernelContext) {
              ctx.setService("capabilities", capabilities);
            },
          },
        ],
      },
    );

    expect(kernel.capabilities).toBe(capabilities);
    // The un-provided service stays a clear per-consumption error — nothing else
    // is required because the kernel does not consume it here.
    expect(() => kernel.permissions).toThrow(ServiceNotInstalledError);
  });

  it("keeps the legacy default-modules behavior fully green", () => {
    const kernel = new RuntimeKernel();

    expect(kernel.listModules().sort()).toEqual([
      "capabilities",
      "events",
      "permissions",
    ]);
    expect(kernel.store).toBeDefined();
    expect(kernel.bus).toBeDefined();
    expect(kernel.eventSchemas).toBeDefined();
    expect(kernel.permissions).toBeDefined();
    expect(kernel.authz).toBeDefined();
    expect(kernel.capabilities).toBeDefined();
  });
});

describe("Kernel Module Dependency Ordering & Topological Startup (Phase 1.3)", () => {
  it("initializes modules in topological order and shuts down in reverse", async () => {
    const executionOrder: string[] = [];

    const moduleA: KernelModule = {
      name: "moduleA",
      version: "1.0.0",
      dependencies: ["moduleB"],
      register: () => {},
      initialize: async () => { executionOrder.push("init:A"); },
      shutdown: async () => { executionOrder.push("shutdown:A"); },
    };

    const moduleB: KernelModule = {
      name: "moduleB",
      version: "1.0.0",
      register: () => {},
      initialize: async () => { executionOrder.push("init:B"); },
      shutdown: async () => { executionOrder.push("shutdown:B"); },
    };

    const kernel = new RuntimeKernel({}, { modules: [moduleA, moduleB] });

    await kernel.initialize();
    expect(executionOrder).toEqual(["init:B", "init:A"]);

    await kernel.stop();
    expect(executionOrder).toEqual(["init:B", "init:A", "shutdown:A", "shutdown:B"]);
  });

  it("propagates platformId, environment, and runtimeId on KernelContext", () => {
    const kernel = new RuntimeKernel({}, {
      config: {
        platformId: "test-platform",
        environment: "staging",
        runtimeId: "rt-test-1",
      },
    });

    expect(kernel.moduleContext.platformId).toBe("test-platform");
    expect(kernel.moduleContext.environment).toBe("staging");
    expect(kernel.moduleContext.runtimeId).toBe("rt-test-1");
  });
});
