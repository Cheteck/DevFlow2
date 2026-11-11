import { AsyncLocalStorage } from "node:async_hooks";
import type { SpaceProfile } from "../../shell/profiles.js";
import type { ResolvedTheme } from "../services/theme-resolution.service.js";

export interface RenderContext {
  space?: SpaceProfile | null;
  theme: ResolvedTheme;
}

export const renderContext = new AsyncLocalStorage<RenderContext>();

export function getRenderContext(): RenderContext {
  const ctx = renderContext.getStore();
  if (!ctx) {
    throw new Error("Render context not initialized – this endpoint requires a resolved Space context");
  }
  return ctx;
}

export function tryGetRenderContext(): RenderContext | null {
  return renderContext.getStore() ?? null;
}
