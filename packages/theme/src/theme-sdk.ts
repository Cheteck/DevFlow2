/**
 * @mosaix/theme — 3-Level Progressive Theme SDK
 */

import type {
  CompiledTheme,
  ThemeAssignment,
  ThemeChangedPayload,
  ThemeManifest,
  ThemeResolutionContext,
  ThemeTarget,
} from "@mosaix/contracts";
import type { ThemeTargetRegistration } from "./theme-target-registry.js";
import type { ThemeApplyOutcome, ThemeRuntime } from "./theme-runtime.js";
import { ThemeDiscovery, type DiscoveredThemeInfo } from "./theme-discovery.js";

export type ThemeWatcher = (payload: ThemeChangedPayload) => void;

export class ThemeSDK {
  private readonly watchers = new Map<string, Set<ThemeWatcher>>();

  constructor(private readonly runtime: ThemeRuntime) {}

  private targetKey(target: ThemeTarget): string {
    return `${target.type}:${target.id}`;
  }

  // ── Level 1: Basic Consumer API ──

  async get(target: ThemeTarget): Promise<ThemeApplyOutcome> {
    return this.runtime.apply({ target });
  }

  watch(target: ThemeTarget, listener: ThemeWatcher): () => void {
    const key = this.targetKey(target);
    let set = this.watchers.get(key);
    if (!set) {
      set = new Set();
      this.watchers.set(key, set);
    }
    set.add(listener);

    return () => {
      set!.delete(listener);
    };
  }

  notifyWatchers(payload: ThemeChangedPayload): void {
    if (!payload.target) return;
    const key = this.targetKey(payload.target);
    const set = this.watchers.get(key);
    if (set) {
      for (const listener of set) {
        try {
          listener(payload);
        } catch {
          // Guard against listener failure
        }
      }
    }
  }

  // ── Level 2: Resolution Context Engine ──

  async resolve(context: ThemeResolutionContext): Promise<ThemeApplyOutcome> {
    return this.runtime.apply(context);
  }

  // ── Level 3: Admin & Governance API ──

  readonly targets = {
    register: (registration: ThemeTargetRegistration): void => {
      this.runtime.registerTarget(registration);
    },
    get: (type: string) => {
      return (this.runtime as any).registry?.get(type);
    },
    list: (): ThemeTargetRegistration[] => {
      return (this.runtime as any).registry?.list() ?? [];
    },
  };

  readonly catalog = {
    list: (): ThemeManifest[] => {
      return this.runtime.listThemes();
    },
    get: (themeId: string): ThemeManifest | undefined => {
      return this.runtime.getTheme(themeId);
    },
    discover: (themesRootDir: string): DiscoveredThemeInfo[] => {
      const themes = ThemeDiscovery.discoverThemes(themesRootDir);
      for (const theme of themes) {
        try {
          this.runtime.registerTheme(theme.manifest);
        } catch {
          // Already registered or duplicate
        }
      }
      return themes;
    },
  };

  async assign(assignment: ThemeAssignment): Promise<ThemeApplyOutcome> {
    ((this.runtime as any).resolver?.store as any)?.assign?.(assignment);
    return this.get(assignment.target);
  }

  async unassign(target: ThemeTarget): Promise<ThemeApplyOutcome> {
    ((this.runtime as any).resolver?.store as any)?.unassign?.(target);
    return this.get(target);
  }
}
