/**
 * @mosaix/core — PluginRegistry (T-EXT-04)
 *
 * The open registry that turns `PluginManifest` contracts into executable
 * state: register (validated against `PluginManifestSchema`), activate /
 * deactivate lifecycle, list, and an OPEN extension-point surface.
 *
 * Keying follows the ecosystem convention `owner:id` (like capabilities are
 * owned by an application). For a plugin the owner is the target artifact it
 * extends (`extension.target`) — the plugin has no business domain of its own.
 *
 * Extension points are OPEN strings (T-EXT-04): a plugin contributes to any
 * declared point, and targeting an unknown point yields `undefined`, NEVER an
 * error (theme-target D-17 analogy — see `theme-target-registry.ts`).
 *
 * V1 scope is registration + validation + activation lifecycle. No sandbox /
 * trust / WASM (roadmap Phase 5), no hook execution. Duplicate registration
 * throws `PluginRegistrationError`; unknown activation targets throw
 * `PluginLifecycleError`.
 *
 * Dependency direction: core → schemas (validation), contracts (types).
 * Consumed by: PluginModule, SDK `MosaixApp.plugins`, hosting kernels.
 */

import type { PluginManifest } from "@mosaix/contracts";
import { PluginManifestSchema } from "@mosaix/schemas";
import { PluginLifecycleError, PluginRegistrationError } from "./plugin-errors";

/** A registered plugin together with its lifecycle state. */
export interface PluginEntry {
  /** Registry key — `${owner}:${plugin.id}`. */
  readonly key: string;
  /** Owner of the extension point — the target artifact being extended. */
  readonly owner: string;
  readonly manifest: PluginManifest;
  /** Whether the plugin is currently activated. */
  active: boolean;
}

/** Identity of a declared extension point — `${target}:${point}`. */
export function extensionPointKey(target: string, point: string): string {
  return `${target}:${point}`;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginEntry>();
  private readonly extensionPoints = new Map<string, Set<string>>();

  /**
   * Validate and register a plugin manifest. Returns its registry key.
   * Duplicate `owner:id` → `PluginRegistrationError`.
   */
  register(manifest: PluginManifest): string {
    const parsed = PluginManifestSchema.safeParse(manifest);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ");
      throw new PluginRegistrationError(
        `Invalid plugin manifest for "${manifest.id}": ${issues}`,
        { pluginId: manifest.id, issues: parsed.error.issues },
      );
    }

    const owner = manifest.extension.target;
    const key = `${owner}:${manifest.id}`;
    if (this.plugins.has(key)) {
      throw new PluginRegistrationError(`Plugin already registered: ${key}`, {
        key,
      });
    }

    this.plugins.set(key, { key, owner, manifest, active: false });
    for (const point of toPoints(manifest.extension.point)) {
      const pointKey = extensionPointKey(owner, point);
      const keys = this.extensionPoints.get(pointKey) ?? new Set<string>();
      keys.add(key);
      this.extensionPoints.set(pointKey, keys);
    }
    return key;
  }

  /** Look up a registered plugin by its `owner:id` key, or undefined. */
  get(key: string): PluginEntry | undefined {
    return this.plugins.get(key);
  }

  /** Whether a `owner:id` key is registered. */
  has(key: string): boolean {
    return this.plugins.has(key);
  }

  /** Activate a registered plugin. Unknown key → `PluginLifecycleError`. */
  activate(key: string): void {
    this.requireEntry(key).active = true;
  }

  /** Deactivate a registered plugin. Unknown key → `PluginLifecycleError`. */
  deactivate(key: string): void {
    this.requireEntry(key).active = false;
  }

  /** All registered plugins as a snapshot copy. */
  list(): PluginEntry[] {
    return Array.from(this.plugins.values());
  }

  /** Number of registered plugins. */
  get size(): number {
    return this.plugins.size;
  }

  /**
   * Plugins contributing to a declared extension point, or `undefined` when
   * the point is unknown — never an error (D-17 analogy).
   */
  extensionsAt(target: string, point: string): PluginEntry[] | undefined {
    const keys = this.extensionPoints.get(extensionPointKey(target, point));
    if (keys === undefined) return undefined;
    return Array.from(keys)
      .map((key) => this.plugins.get(key))
      .filter((entry): entry is PluginEntry => entry !== undefined);
  }

  /**
   * All currently declared extension point keys (`target:point`) — snapshot
   * copy of the open registry.
   */
  extensionPointsKeys(): string[] {
    return Array.from(this.extensionPoints.keys());
  }

  private requireEntry(key: string): PluginEntry {
    const entry = this.plugins.get(key);
    if (entry === undefined) {
      throw new PluginLifecycleError(`Unknown plugin: ${key}`, { key });
    }
    return entry;
  }
}

function toPoints(point: PluginManifest["extension"]["point"]): string[] {
  return Array.isArray(point) ? point : [point];
}
