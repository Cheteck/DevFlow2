/**
 * @mosaix/theme — ThemeRuntime
 */

import type {
  CompiledTheme,
  ThemeAssignmentsStore,
  ThemeChangedPayload,
  ThemeManifest,
  ThemeMode,
  ThemeResolutionContext,
  MosaixEventEnvelope,
  TenantIdentity,
} from "@mosaix/contracts";
import type { PermissionString } from "@mosaix/types";
import { uuidV7 } from "@mosaix/types";
import { themeChangedEvent } from "@mosaix/contracts";
import {
  MosaixEventEnvelopeSchema,
  ThemeChangedPayloadSchema,
  ThemeManifestSchema,
} from "@mosaix/schemas";

import { compile } from "./theme-compiler.js";
import { ThemeCache } from "./theme-cache.js";
import { ThemeValidationError } from "./theme-errors.js";
import type { ThemeMutationListener } from "./in-memory-theme-assignments-store.js";
import { ThemeInjector } from "./theme-injector.js";
import {
  createThemeResolver,
  type ThemeInheritanceResolverLike,
  type ThemeResolutionOutcome,
  type ThemeResolver,
} from "./theme-resolver.js";
import type {
  ThemeTargetRegistration,
  ThemeTargetRegistry,
} from "./theme-target-registry.js";
import { EventStore, DomainEventBus } from "@mosaix/core";
import { EventSchemaRegistry } from "@mosaix/core";

export const THEME_CHANGED_EVENT_VERSION = "1.0.0";
export const THEME_RUNTIME_OWNER_APP = "mosaix/theme";
export const THEME_RUNTIME_DEFAULT_TENANT: TenantIdentity = {
  organizationId: "mosaix",
};

export interface ThemeChangedPublisher {
  (payload: ThemeChangedPayload): Promise<void> | void;
}

export interface ThemeApplyOutcome {
  readonly resolution: ThemeResolutionOutcome;
  readonly compiled?: CompiledTheme;
  readonly appliedAt?: string;
}

export interface ThemeRuntimeOptions {
  readonly registry: ThemeTargetRegistry;
  readonly store: ThemeAssignmentsStore;
  readonly loadManifest?: (themeId: string) => ThemeManifest | undefined;
  readonly inheritance?: ThemeInheritanceResolverLike;
  readonly defaultMode?: ThemeMode;
  readonly onMutation?: ThemeMutationListener;
  readonly cache?: ThemeCache;
  readonly injector?: ThemeInjector;
  readonly publish?: ThemeChangedPublisher;
  readonly tenant?: TenantIdentity;
}

export class ThemeRuntime {
  private readonly registry: ThemeTargetRegistry;
  private readonly cache: ThemeCache;
  private readonly injector: ThemeInjector;
  private readonly publish: ThemeChangedPublisher;
  private readonly resolver: ThemeResolver;
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

  registerTarget(registration: ThemeTargetRegistration): void {
    this.registry.register(registration);
  }

  registerTheme(manifest: ThemeManifest): void {
    const result = ThemeManifestSchema.safeParse(manifest);
    if (!result.success) {
      throw new ThemeValidationError(result.error.issues);
    }
    this.catalog.set(manifest.id, manifest);
  }

  getTheme(themeId: string): ThemeManifest | undefined {
    return this.catalog.get(themeId);
  }

  listThemes(): ThemeManifest[] {
    return Array.from(this.catalog.values());
  }

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

export interface ThemeRuntimeEventWiring {
  readonly schemas?: EventSchemaRegistry;
  readonly eventStore?: EventStore;
  readonly permissionCheck?: (
    permission: PermissionString,
    tenant: TenantIdentity,
    app: string,
  ) => boolean;
  readonly owner?: string;
}

export interface ThemeRuntimeFactoryOptions
  extends ThemeRuntimeOptions, ThemeRuntimeEventWiring {}

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
