/**
 * ThemeRuntime hot-switch benchmark (THEME-11, roadmap criterion #2).
 *
 * Demonstrates the ≤ 100 ms hot-switch requirement over 42 registered roots on
 * the CACHED path: a warm-up apply OUTSIDE the bench compiles + caches +
 * injects the ocean theme; every measured iteration then runs the full
 * runtime pipeline (resolve → cache-hit → inject → notify) against 42
 * CssStyleHost-style stub roots, forcing determinism with injector.flush().
 *
 * The 42-root setup exercises the ≥ INJECTOR_BATCH_THRESHOLD batching path;
 * Node has no requestAnimationFrame, so a guarded synchronous fallback is
 * installed ONLY when absent (documented harness — flush() still forces
 * synchronous application).
 *
 * Gate: bench report mean/p95 ≤ 100 ms (03-CONTEXT « specifics »).
 */

import { bench, describe } from "vitest";

import type { ThemeManifest, ThemeResolutionContext } from "@mosaix/contracts";
import { InMemoryThemeAssignmentsStore } from "../src/theme/in-memory-theme-assignments-store";
import { ThemeInjector } from "../src/theme/theme-injector";
import { createThemeRuntime } from "../src/theme/theme-runtime";
import { ThemeTargetRegistry } from "../src/theme/theme-target-registry";

// Node has no requestAnimationFrame — install a guarded synchronous fallback
// so the ≥ 40-root batching path defers to an immediate flush.
if (typeof globalThis.requestAnimationFrame === "undefined") {
  (
    globalThis as {
      requestAnimationFrame?: (cb: FrameRequestCallback) => number;
    }
  ).requestAnimationFrame = (cb) => {
    cb(0);
    return 0;
  };
}

const blockRegistration = {
  type: "block",
  capabilities: { userSelectable: true, adminConfigurable: false },
} as const;

const oceanManifest: ThemeManifest = {
  id: "ocean",
  name: "Ocean",
  version: "1.0.0",
  type: "theme",
  metadata: { name: "Ocean" },
  tokens: { colors: { primary: "#1e73e8" }, spacing: { md: "16px" } },
  modes: { dark: { colors: { primary: "#0a3d62" }, spacing: { md: "20px" } } },
};

const registry = new ThemeTargetRegistry([blockRegistration]);

const store = new InMemoryThemeAssignmentsStore();
store.assign({
  target: { type: "block", id: "top" },
  themeId: "ocean",
  version: "1.0.0",
  mode: "dark",
  source: "admin",
});

const injector = new ThemeInjector();
const roots = Array.from({ length: 42 }, () => ({
  style: {
    setProperty() {},
    removeProperty() {},
  },
}));
for (const root of roots) injector.register(root);

const runtime = createThemeRuntime({
  registry,
  store,
  loadManifest: () => oceanManifest,
  injector,
  permissionCheck: () => true,
});

const ctx: ThemeResolutionContext = { target: { type: "block", id: "top" } };

// Warm-up run OUTSIDE the bench: compiles + caches + injects the ocean theme.
await runtime.apply(ctx);
injector.flush();

describe("theme hot-switch", () => {
  bench("42 roots cached compile+inject (≤ 100 ms)", async () => {
    await runtime.apply(ctx);
    injector.flush();
  });
});
