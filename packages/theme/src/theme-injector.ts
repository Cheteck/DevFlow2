/**
 * @mosaix/theme — ThemeInjector
 */

import type { CompiledTheme } from "@mosaix/contracts";
import { ThemeInjectionError } from "./theme-errors.js";

export const INJECTOR_BATCH_THRESHOLD = 40;

export interface CssStyleHost {
  readonly style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
}

export type ThemeRoot = HTMLElement | ShadowRoot | CssStyleHost;

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

function resolveStyleHost(root: ThemeRoot): CssStyleHost {
  if (hasStyleSurface(root)) return root;
  if (typeof root === "object" && root !== null && "host" in root) {
    const nested = (root as { host: unknown }).host;
    if (hasStyleSurface(nested)) return nested;
  }
  throw new ThemeInjectionError("no style surface on root");
}

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
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        this.rafScheduled = false;
        this.flush();
      });
    } else {
      this.rafScheduled = false;
      this.flush();
    }
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
