/**
 * @mosaix/core — ThemeRuntime (THEME-11)
 *
 * The facade separating EXPLICIT bootstrap (`registerTarget` / `registerTheme`)
 * from the runtime path (`resolve → compile → cache → inject → notify`).
 * Publishes `theme.changed` AFTER injection through the kernel `DomainEventBus`
 * (D-11/D-12 — Phase 3 IS the wiring point; schema from `@mosaix/schemas`).
 *
 * Composition (03-CONTEXT « OpenCode's Discretion », decided): the runtime OWNS
 * its composition — it constructs its resolver via the existing
 * `createThemeResolver` factory from the injected `registry`/`store`, and
 * builds or accepts `cache`/`injector` with sensible defaults, mirroring the
 * 02-04 "factory wires, class stays simple" split and the `EventsModule`
 * bus-wiring shape. The class imports the bus-vendored `publish` seam
 * (narrow `ThemeChangedPublisher`) — it never imports event-bus itself.
 *
 * Invariants (locked by tests + grep gates):
 * - Bootstrap-only registration (D-16, roadmap #5): `registerTarget`/
 *   `registerTheme` are the ONLY registration surfaces; the `apply()` body
 *   contains NO `register` call (never-registers invariant test) — the
 *   resolution path consumes the registry/store read-only (D-17).
 * - Fail-open passthrough (D-20): an unresolved outcome (error or no
 *   resolved theme) returns a bare `{ resolution }` — no compile, no inject,
 *   no publish.
 * - Cache-first (03-02 key_link, roadmap #2): `cache.get(themeId, version,
 *   mode)` is consulted before `compile` (the costly step, 03-01); a cache
 *   hit returns the SAME `CompiledTheme` reference.
 * - Inject-before-notify (T3-13): `injector.inject(compiled)` runs strictly
 *   before the payload timestamp is captured and the event published; an
 *   inject failure propagates as `ThemeInjectionError` (THEME-12) and no
 *   publish occurs.
 * - Exactly ONE publish per apply (T3-15): a single `bus.publish` per apply —
 *   notification fan-out to N roots is the bus's domain.
 * - D-21 validator wrapping: `registerTheme` validates via
 *   `ThemeManifestSchema.safeParse` → `ThemeValidationError(issues)` — never a
 *   bare Zod TypeError (T3-14).
 *
 * Depends on: @mosaix/contracts (type-only + `themeChangedEvent` const),
 *   @mosaix/schemas, @mosaix/types (uuid), core-internal theme + event modules.
 * Consumed by: Phase-4 SDK `theme.*`, Shell bridge (Phase 5).
 */

import type {
  CompiledTheme,
  ThemeAssignmentsStore,
  ThemeChangedPayload,
  ThemeManifest,
  ThemeMode,
  ThemeResolutionContext,
} from "@mosaix/contracts";
import { themeChangedEvent } from "@mosaix/contracts";
import {
  MosaixEventEnvelopeSchema,
  ThemeChangedPayloadSchema,
  ThemeManifestSchema,
} from "@mosaix/schemas";
import type {
  MosaixEventEnvelope,
  PermissionString,
  TenantIdentity,
} from "@mosaix/types";
import { uuidV7 } from "@mosaix/types";

import { DomainEventBus, EventStore } from "../event-bus";
import { EventSchemaRegistry } from "../event-schema-registry";
import { compile } from "./theme-compiler";
import { ThemeCache } from "./theme-cache";
import { ThemeValidationError } from "./theme-errors";
import type { ThemeMutationListener } from "./in-memory-theme-assignments-store";
import { ThemeInjector } from "./theme-injector";
import {
  createThemeResolver,
  type ThemeInheritanceResolverLike,
  type ThemeResolutionOutcome,
  type ThemeResolver,
} from "./theme-resolver";
import type {
  ThemeTargetRegistration,
  ThemeTargetRegistry,
} from "./theme-target-registry";

/** Registered event version of `theme.changed` (D-12 wiring). */
export const THEME_CHANGED_EVENT_VERSION = "1.0.0";

/** Publishing owner app — single-owner rule (roadmap §4.1). */
export const THEME_RUNTIME_OWNER_APP = "mosaix/core";

/** Envelope tenant default — Phase-4 SDK injects the real tenant. */
export const THEME_RUNTIME_DEFAULT_TENANT: TenantIdentity = {
  organizationId: "mosaix",
};

/** Narrow publisher seam — the class never imports event-bus; the factory wires it. */
export interface ThemeChangedPublisher {
  (payload: ThemeChangedPayload): Promise<void> | void;
}

export interface ThemeApplyOutcome {
  /** Resolver outcome passthrough (fail-open preserved, D-20). */
  readonly resolution: ThemeResolutionOutcome;
  /** Present when resolved+compiled. Cache-hit returns the SAME reference. */
  readonly compiled?: CompiledTheme;
  /** ISO timestamp captured AFTER injection, BEFORE publish. */
  readonly appliedAt?: string;
}

export interface ThemeRuntimeOptions {
  readonly registry: ThemeTargetRegistry;
  readonly store: ThemeAssignmentsStore;
  /** Catalog provider fallback — consulted AFTER the runtime's own registerTheme map. */
  readonly loadManifest?: (themeId: string) => ThemeManifest | undefined;
  readonly inheritance?: ThemeInheritanceResolverLike;
  readonly defaultMode?: ThemeMode;
  /** Forwarded to createThemeResolver (02-04 store mutation wiring). */
  readonly onMutation?: ThemeMutationListener;
  readonly cache?: ThemeCache;
  readonly injector?: ThemeInjector;
  /** Default no-op; createThemeRuntime supplies the real bus. */
  readonly publish?: ThemeChangedPublisher;
  /** Envelope tenant; default THEME_RUNTIME_DEFAULT_TENANT (Phase-4 SDK injects the real one). */
  readonly tenant?: TenantIdentity;
}

export class ThemeRuntime {
  private readonly registry: ThemeTargetRegistry;
  private readonly cache: ThemeCache;
  private readonly injector: ThemeInjector;
  private readonly publish: ThemeChangedPublisher;
  private readonly resolver: ThemeResolver;
  /** Bootstrap catalog — registered manifests, consulted FIRST by loadManifest. */
  private readonly catalog = new Map<string, ThemeManifest>();

  constructor(options: ThemeRuntimeOptions) {
    this.registry = options.registry;
    this.cache = options.cache ?? new ThemeCache();
    this.injector = options.injector ?? new ThemeInjector();
    this.publish = options.publish ?? (() => undefined);

    this.resolver = createThemeResolver({
      registry: this.registry,
      store: options.store,
      loadManifest: (themeId: string): ThemeManifest | undefined =>
        this.catalog.get(themeId) ?? options.loadManifest?.(themeId),
      ...(options.inheritance !== undefined
        ? { inheritance: options.inheritance }
        : {}),
      ...(options.defaultMode !== undefined
        ? { defaultMode: options.defaultMode }
        : {}),
      ...(options.onMutation !== undefined
        ? { onMutation: options.onMutation }
        : {}),
    });
  }

  // ── Bootstrap — ALL explicit (CONTEXT) ────────────────────

  /** Declare a themeable target type: → registry.register (last-write-wins). */
  registerTarget(registration: ThemeTargetRegistration): void {
    this.registry.register(registration);
  }

  /**
   * Declare a theme manifest into the runtime catalog (D-21): validates via
   * ThemeManifestSchema → ThemeValidationError on failure. The catalog is
   * consulted FIRST by the runtime's loadManifest; the injected fallback
   * (options.loadManifest) only on a miss.
   */
  registerTheme(manifest: ThemeManifest): void {
    const result = ThemeManifestSchema.safeParse(manifest);
    if (!result.success) {
      throw new ThemeValidationError(result.error.issues);
    }
    this.catalog.set(manifest.id, manifest);
  }

  // ── Runtime path — resolve → compile → cache → inject → notify ──

  /**
   * Resolve, compile (cache-first), inject and notify for ctx.target.
   * Flow:
   *   1) await resolver.resolve(ctx) — fail-open passthrough (D-20)
   *   2) outcome.resolved undefined → return { resolution } (no compile/inject/publish)
   *   3) cache.get(themeId, version, mode) ?? (compile + cache.set)
   *   4) injector.inject(compiled) — ThemeInjectionError propagates (THEME-12)
   *   5) appliedAt = now; publish({ theme, mode, version, appliedAt, target? })
   *   6) return { resolution, compiled, appliedAt }
   * The resolution path NEVER registers (D-16, invariant #5) — registration
   * lives exclusively in registerTarget/registerTheme.
   */
  async apply(ctx: ThemeResolutionContext): Promise<ThemeApplyOutcome> {
    const resolution = await this.resolver.resolve(ctx);
    if (resolution.resolved === undefined) {
      return { resolution };
    }
    const { themeId, version, mode, manifest } = resolution.resolved;

    let compiled = this.cache.get(themeId, version, mode);
    if (compiled === undefined) {
      compiled = compile(manifest, mode);
      this.cache.set(themeId, version, mode, compiled);
    }

    // Injection BEFORE notify — ordering locked by test G (T3-13).
    this.injector.inject(compiled);

    const appliedAt = new Date().toISOString();
    const payload: ThemeChangedPayload = {
      theme: themeId,
      mode,
      version,
      appliedAt,
      ...(ctx.target ? { target: ctx.target } : {}),
    };
    await this.publish(payload);

    return { resolution, compiled, appliedAt };
  }
}

// ── D-12 event wiring (Phase 3 IS the wiring point, CONTEXT) ──

export interface ThemeRuntimeEventWiring {
  readonly schemas?: EventSchemaRegistry;
  readonly eventStore?: EventStore;
  /** Default allow-all (no auth stack in theme bootstrap) — Phase-5 governance replaces it. */
  readonly permissionCheck?: (
    permission: PermissionString,
    tenant: TenantIdentity,
    app: string,
  ) => boolean;
  readonly owner?: string;
}

export interface ThemeRuntimeFactoryOptions
  extends ThemeRuntimeOptions, ThemeRuntimeEventWiring {}

/**
 * `createThemeRuntime` — composition factory (02-04 spirit): wires the
 * `theme.changed` event into an EventSchemaRegistry + DomainEventBus with
 * EventsModule-shaped checks, then hands the runtime a bus-backed publish seam.
 *
 *   1. schemas.register({ type: themeChangedEvent, version:
 *      THEME_CHANGED_EVENT_VERSION, ownerApp: owner, schema: {},
 *      payloadSchema: ThemeChangedPayloadSchema })
 *   2. bus = new DomainEventBus(eventStore, permissionCheck ?? allowAll,
 *      (env) => MosaixEventEnvelopeSchema.safeParse(env).success &&
 *        schemas.validateEnvelope(env),
 *      (env) => schemas.validatePayload(env))            // EventsModule mirror
 *   3. publish = (payload) => bus.publish({ id: uuidV7(), type,
 *      version, source: { application: owner }, tenant,
 *      timestamp: payload.appliedAt, correlationId: uuidV7(),
 *      payload, security: { classification: "internal" } }, owner)
 *   4. return new ThemeRuntime({ ...options, publish })
 */
export function createThemeRuntime(
  options: ThemeRuntimeFactoryOptions,
): ThemeRuntime {
  const schemas = options.schemas ?? new EventSchemaRegistry();
  const eventStore = options.eventStore ?? new EventStore();
  const owner = options.owner ?? THEME_RUNTIME_OWNER_APP;
  const tenant = options.tenant ?? THEME_RUNTIME_DEFAULT_TENANT;
  const permissionCheck =
    options.permissionCheck ??
    ((_permission: PermissionString, _tenant: TenantIdentity, _app: string) =>
      true);

  schemas.register({
    type: themeChangedEvent,
    version: THEME_CHANGED_EVENT_VERSION,
    ownerApp: owner,
    schema: {},
    payloadSchema: ThemeChangedPayloadSchema,
  });

  const bus = new DomainEventBus(
    eventStore,
    permissionCheck,
    (envelope: MosaixEventEnvelope): boolean =>
      MosaixEventEnvelopeSchema.safeParse(envelope).success &&
      schemas.validateEnvelope(envelope),
    (envelope: MosaixEventEnvelope): boolean =>
      schemas.validatePayload(envelope),
  );

  const publish: ThemeChangedPublisher = async (payload) => {
    const envelope: MosaixEventEnvelope = {
      id: uuidV7(),
      type: themeChangedEvent,
      version: THEME_CHANGED_EVENT_VERSION,
      source: { application: owner },
      tenant,
      timestamp: payload.appliedAt,
      correlationId: uuidV7(),
      payload,
      security: { classification: "internal" },
    };
    await bus.publish(envelope, owner);
  };

  return new ThemeRuntime({ ...options, publish });
}
