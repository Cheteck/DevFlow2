# Kernel Architecture

## Overview

The `RuntimeKernel` (`packages/core/src/kernel.ts`) is the orchestration core of MosaiX.

**Responsibilities** (ADR-0002):
1. Installs modules (`install` / `registerModule`)
2. Drives lifecycle with 7-state machine
3. Enforces execution boundary (permission → contract → execution)
4. Exposes backward-compatible facade

**Does NOT own**: EventStore, PermissionRegistry, DomainEventBus, AuthorizationEngine, CapabilityRegistry — these are provided by modules.

---

## Kernel State Machine

```
CREATED ──→ INITIALIZING ──→ READY ──→ RUNNING ──→ STOPPING ──→ STOPPED
                      │              │
                      │              └──→ (auto-initialize on start)
                      │
                      └──→ FAILED
```

### Valid Transitions

| From | To | Trigger |
|------|-----|---------|
| CREATED | INITIALIZING | `kernel.initialize()` |
| READY | RUNNING | `kernel.start()` |
| RUNNING | STOPPING | `kernel.stop()` |
| STOPPED | INITIALIZING | `kernel.initialize()` (reboot) |
| FAILED | INITIALIZING | `kernel.initialize()` (retry) |
| READY | INITIALIZING | `kernel.start()` (auto-init) |

### Constructor

```typescript
new RuntimeKernel(hooksOrConfig?: KernelConfig & KernelHooks, options?: KernelOptions)
```

Default modules installed: `PermissionsModule`, `CapabilitiesModule`, `EventsModule`

---

## Module System

### KernelModule Interface

```typescript
interface KernelModule {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: readonly string[];

  register(ctx: KernelContext): void;
  boot?(ctx: KernelContext): void | Promise<void>;
  start?(ctx: KernelContext): void | Promise<void>;
  stop?(ctx: KernelContext): void | Promise<void>;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

### Lifecycle Order

1. `register()` — synchronous, during construction
2. `boot()` — during `initialize()`, topologically sorted
3. `start()` — during `start()`, topologically sorted
4. `stop()` — during `stop()`, reverse order

### Topological Sort with Cycle Detection

```typescript
private getOrderedModules(): KernelModule[] {
  const resolved: KernelModule[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (mod: KernelModule): void => {
    if (visited.has(mod.name)) return;
    if (visiting.has(mod.name)) {
      throw new LifecycleError(`Circular module dependency detected: ${mod.name}`);
    }
    visiting.add(mod.name);
    // ... visit dependencies ...
    visiting.delete(mod.name);
    visited.add(mod.name);
    resolved.push(mod);
  };
}
```

---

## KernelContext

Stable contract that modules and applications depend on.

```typescript
class KernelContext implements KernelServices {
  readonly config: KernelConfig;
  readonly platformId: string;
  readonly environment: string;
  readonly runtimeId: string;
  readonly container: Container;
  readonly apps: AppRegistry;

  // Canonical services (throw ServiceNotInstalledError if missing)
  get permissions(): PermissionRegistry;
  get authorization(): AuthorizationEngine;
  get capabilities(): CapabilityRegistry;
  get events(): DomainEventBus;
  get eventStore(): EventStore;
  get eventSchemas(): EventSchemaRegistry;

  // Extension services (return undefined if missing)
  get logger(): Logger;
  get metrics(): Metrics;
  get tracer(): Trace;

  setService(name: string, service: unknown): void;
  getService(name: string): unknown;
  hasService(name: string): boolean;
}
```

### Canonical Services

| Service | Module | Interface |
|---------|--------|-----------|
| `permissions` | PermissionsModule | `PermissionRegistry` |
| `authorization` | PermissionsModule | `AuthorizationEngine` |
| `capabilities` | CapabilitiesModule | `CapabilityRegistry` |
| `events` | EventsModule | `DomainEventBus` |
| `eventStore` | EventsModule | `EventStore` |
| `eventSchemas` | EventsModule | `EventSchemaRegistry` |

### Extension Services

| Service | Module | Default |
|---------|--------|---------|
| `logger` | ObservabilityModule | ConsoleLogger |
| `metrics` | ObservabilityModule | InMemoryMetrics |
| `tracer` | ObservabilityModule | InMemoryTracer |

---

## KernelConfig

```typescript
interface KernelConfig {
  platformId?: string;
  environment?: string;
  runtimeId?: string;
  logLevel?: LogLevel;
  grants?: PermissionGrant[];
  onAppStateChanged?: (appId: string, status: string) => void;
}
```

### KernelOptions

```typescript
interface KernelOptions {
  modules?: KernelModule[];
  config?: Partial<KernelConfig>;
  observability?: {
    logger?: Logger;
    metrics?: Metrics;
    tracer?: Trace;
  };
}
```

---

## Application Registration

```typescript
kernel.register(manifest: ApplicationManifest, callbacks?: LifecycleCallbacks): void
```

Process:
1. Validate manifest invariants (id, semver, entrypoint, no wildcard scopes)
2. Zod validation with legacy manifest fallback
3. Register with `AppRegistry`
4. Derive capabilities from manifest
5. Register event schemas

### Manifest Support

- **New shape**: Full Zod validation via `ApplicationManifestSchema`
- **Legacy shape**: Silent fallback for existing apps (permissions as string[], capabilities without provider/operations)

---

## Application Lifecycle (AppLifecycle)

```
discovered → registered → ready → active
                ↓            ↓       ↓
              degraded    degraded  degraded
                           ↓         ↓
                        draining   disabled
```

### Lifecycle Callbacks

```typescript
interface LifecycleCallbacks {
  onInitializing?: () => Promise<void> | void;
  onActive?: () => Promise<void> | void;
  onDegraded?: (error: unknown) => Promise<void> | void;
  onDisabled?: () => Promise<void> | void;
  onReady?: () => Promise<void> | void;
  onDraining?: () => Promise<void> | void;
}
```

---

## Capability Execution (Flow B)

```typescript
async executeCapability(
  capabilityId: string,
  callerApp: string,
  tenant: TenantIdentity,
  input: unknown
): Promise<unknown>
```

### Execution Pipeline

1. **Resolve** capability entry
2. **Permission check**: `<ownerApp>:<capId>:execute:tenant`
3. **Input validation** against `inputValidator` (if present)
4. **Execute** via registered executor
5. **Output validation** against `outputValidator` (if present)
6. **Trace** execution span
7. **Record metrics** (capability.execute counter)

### Capability API

```typescript
registerCapability(ownerApp: string, entry: Omit<CapabilityEntry, "ownerApp">): void
resolveCapability(id: string, version?: string): CapabilityEntry | undefined
registerCapabilityExecutor(capabilityId: string, executor: CapabilityExecutor): void
bindCapabilityContract(capabilityId: string, ownerApp: string, contract: { inputValidator?, outputValidator? }): void
```

---

## Event System

```typescript
// Publishing
await kernel.bus.publish(envelope, publisher): Promise<void>

// Subscribing
const unsubscribe = kernel.bus.subscribe(type, handler, subscriber): () => void
```

### Event Validation Pipeline

1. Schema check (event type registered and owned)
2. Payload validation (if payloadSchema registered)
3. Permission check: `*:event:<type>:publish:tenant`
4. Store append (idempotent by envelope.id)
5. Notify subscribers (permission: `*:event:<type>:consume:tenant`)
6. Dead letter queue on handler failure

---

## Error Hierarchy

```
KernelError
├── RegistrationError     (module/app/capability already exists, invalid state)
├── LifecycleError        (invalid state transition, circular dependency)
├── AuthorizationError    (permission denied)
├── CapabilityError      (unknown capability, contract violation, no executor)
├── EventError           (schema/payload validation, publish denied)
├── ValidationError      (input validation)
└── ServiceNotInstalledError (missing canonical service)
```

### Error Utilities

```typescript
asKernelError(error: unknown): KernelError
// Wraps non-KernelError values preserving message

error.toJSON(): Record<string, unknown>
// Serialization for logging/API
```

---

## Backward-Compatibility Facade

```typescript
class RuntimeKernel {
  // State accessors
  get stateMachineState(): RuntimeKernelState;
  get stateValue(): RuntimeKernelState;
  get stateDetail(): RuntimeKernelState;
  get phaseState(): string;  // deprecated (lowercase)

  // Module services (facade)
  get store(): EventStore;
  get eventStore(): EventStore;
  get permissions(): PermissionRegistry;
  get bus(): DomainEventBus;
  get events(): DomainEventBus;
  get authz(): AuthorizationEngine;
  get authorization(): AuthorizationEngine;
  get capabilities(): CapabilityRegistry;
  get eventSchemas(): EventSchemaRegistry;

  // Container & observability
  get container(): Container;
  get logger(): Logger;
  get metrics(): Metrics;
  get tracing(): Trace;
  get moduleContext(): KernelContext;
}
```

---

## Health & Diagnostics

```typescript
getModuleHealth(): Record<string, { name: string; status: "OK" | "FAIL"; details?: string }>

getAllModuleHealth(): Record<string, {
  status: string;
  lastCheck: number;
  details?: Record<string, unknown>;
}>

getModuleDiagnostics(moduleName: string): Record<string, unknown> | undefined
```

---

## Routing

```typescript
mountRouter(prefix: string, router: unknown): void
```

Extracts routes from:
- `router.routes` array
- `router.getRoutes()` method
- `router.listRoutes()` method
- Single `router.path` property

---

## Related

- [kernel-duplications.md](./kernel-duplications.md)
- [ADR-0002: Kernel Module System](../decisions/)
