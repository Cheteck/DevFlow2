/**
 * @mosaix/core — ThemeInjector (THEME-10)
 *
 * Diff-based, Shadow-DOM-safe theme injection: a CompiledTheme is applied to
 * registered roots through the minimal CSSOM surface ({ setProperty,
 * removeProperty }) on the root's `style` — or on `root.host.style` for
 * ShadowRoot-like hosts (custom properties set on the shadow host inherit
 * into the shadow tree).
 *
 * Roadmap criterion #3: no global scope, rAF batching above 40 roots,
 * diff-based updates (only changed variables written, only removed ones
 * unset). Registered roots are tracked by reference identity in an explicit
 * Set — register()/unregister() only; pending holds a single latest theme.
 *
 * Dependency direction: core → @mosaix/contracts (type-only, CompiledTheme);
 * core → ./theme-errors (value, ThemeInjectionError). Consumers: ThemeRuntime
 * (03-04) and the 03-04 hot-switch benchmark (42 roots through this path).
 *
 * Invariant: this module NEVER touches document/window/global scope — root
 * style access is purely structural (typeof/in narrows, never instanceof DOM
 * classes); requestAnimationFrame resolves as a free global binding at
 * inject() call time (per-test stubbed via vi.stubGlobal, never imported).
 */

import type { CompiledTheme } from "@mosaix/contracts";
import { ThemeInjectionError } from "./theme-errors";

/** rAF batching threshold — roadmap #3: > 40 roots batched (CONTEXT: >= 40). */
export const INJECTOR_BATCH_THRESHOLD = 40;

/** Minimal structural style surface — the ONLY DOM API the injector touches. */
export interface CssStyleHost {
  readonly style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
}

/** Accepted roots: real HTMLElement, ShadowRoot, or structural stubs in tests. */
export type ThemeRoot = HTMLElement | ShadowRoot | CssStyleHost;

/** Pure diff helper — exported for isolated testing (THEME-10 diff-based). */
export function diffCompiledTheme(
  previous: CompiledTheme | undefined,
  next: CompiledTheme,
): { changed: Array<[string, string]>; removed: string[] } {
  const removed = previous
    ? Object.keys(previous)
        .filter((key) => !(key in next))
        .sort()
    : [];
  const changed: Array<[string, string]> = [];
  for (const key of Object.keys(next).sort()) {
    if (previous !== undefined && previous[key] === next[key]) continue;
    changed.push([key, next[key] as string]);
  }
  return { changed, removed };
}

/** Structural style-surface predicate — never instanceof (node env has no DOM). */
function hasStyleSurface(value: unknown): value is CssStyleHost {
  if (value === null || typeof value !== "object") return false;
  const style = (value as { style?: unknown }).style;
  if (style === null || typeof style !== "object") return false;
  const surface = style as CssStyleHost["style"];
  return (
    typeof surface.setProperty === "function" &&
    typeof surface.removeProperty === "function"
  );
}

/**
 * Resolve the style host for a registered root (fail-closed):
 * - root itself carries the surface (real HTMLElement OR test stub), or
 * - root is ShadowRoot-like: its own `host` carries the surface.
 * Anything else → ThemeInjectionError before any write (T3-10 mitigation).
 */
function resolveStyleHost(root: ThemeRoot): CssStyleHost {
  if (hasStyleSurface(root)) return root;
  if (typeof root === "object" && root !== null && "host" in root) {
    const nested = (root as { host: unknown }).host;
    if (hasStyleSurface(nested)) return nested;
  }
  throw new ThemeInjectionError("no style surface on root");
}

/**
 * ThemeInjector — applies CompiledTheme into registered roots, diff-based,
 * rAF-batched above 40 roots, zero global-scope usage.
 * - register(root) adds to an internal Set (reference identity).
 * - inject(compiled): stores as pending; below threshold applies synchronously
 *   via flush(); at threshold schedules ONE rAF flush (coalesced); diff vs
 *   previous run.
 * - flush(): applies pending to ALL registered roots, then commits pending as
 *   previous. Idempotent (no pending → no-op). Exposed for tests + sync callers.
 * - Any root that fails style application → ThemeInjectionError (fail-closed,
 *   THEME-12); previous is NOT advanced on failure (T3-11 pending-flood guard:
 *   one rAF flush per frame, single latest pending).
 */
export class ThemeInjector {
  private readonly roots = new Set<ThemeRoot>();
  private previous: CompiledTheme | undefined;
  private pending: CompiledTheme | undefined;
  private rafScheduled = false;

  register(root: ThemeRoot): void {
    this.roots.add(root);
  }

  unregister(root: ThemeRoot): void {
    this.roots.delete(root);
  }

  has(root: ThemeRoot): boolean {
    return this.roots.has(root);
  }

  /** Number of registered roots. */
  get size(): number {
    return this.roots.size;
  }

  inject(compiled: CompiledTheme): void {
    this.pending = compiled;
    if (this.roots.size < INJECTOR_BATCH_THRESHOLD) {
      this.flush();
      return;
    }
    if (this.rafScheduled) return;
    this.rafScheduled = true;
    requestAnimationFrame(() => {
      this.rafScheduled = false;
      this.flush();
    });
  }

  flush(): void {
    if (this.pending === undefined) return;
    const diff = diffCompiledTheme(this.previous, this.pending);
    for (const root of [...this.roots]) {
      const host = resolveStyleHost(root);
      for (const [name, value] of diff.changed) {
        try {
          host.style.setProperty(name, value);
        } catch (error) {
          throw new ThemeInjectionError("root style application failed", error);
        }
      }
      for (const name of diff.removed) {
        try {
          host.style.removeProperty(name);
        } catch (error) {
          throw new ThemeInjectionError("root style application failed", error);
        }
      }
    }
    this.previous = this.pending;
    this.pending = undefined;
  }
}
