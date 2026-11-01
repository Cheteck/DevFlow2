/**
 * @src/shell/theme/theme-bridge-concurrency.test.ts — SSR Concurrency Audit
 *
 * Demonstrates cross-request theme contamination in the current
 * theme-bridge.ts implementation.
 *
 * CRITICAL BUG: applyThemeMode() writes to global mutable state
 * (currentMode, currentCompiledTheme) which is shared across ALL
 * concurrent requests. This causes race conditions where Request A
 * receives Request B's theme/mode.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initThemeBridge,
  applyThemeMode,
  getCompiledTheme,
  getThemeMode,
  setActiveThemeId,
  getActiveThemeId,
  getResolvedTheme,
  runWithThemeContext,
} from "./theme-bridge.js";
import { renderContext, type RenderContext } from "../../server/context/render-context.js";
import { ThemeDiscovery } from "@mosaix/theme";
import type { ThemeManifest, CompiledTheme } from "@mosaix/contracts";
import * as path from "node:path";

describe("SSR Concurrency — Theme Contamination", () => {
  const themeA = "aurora";
  const themeB = "cobalt";
  const modeA: "dark" = "dark";
  const modeB: "light" = "light";

  let manifestA: ThemeManifest | undefined;
  let manifestB: ThemeManifest | undefined;
  let runtime: any;

  beforeEach(() => {
    runtime = initThemeBridge({ defaultMode: "light" });
    
    const themesDir = path.resolve(process.cwd(), "themes");
    const discovered = ThemeDiscovery.discoverThemes(themesDir);
    
    for (const theme of discovered) {
      runtime.registerTheme(theme.manifest);
      if (theme.id === themeA) manifestA = theme.manifest;
      if (theme.id === themeB) manifestB = theme.manifest;
    }
  });

  afterEach(() => {
    try {
      renderContext.exit();
    } catch {
      // Ignore if no active context
    }
  });

  it("DEMONSTRATES BUG: global currentMode is contaminated across concurrent requests", async () => {
    /**
     * This test proves the race condition:
     * 
     * Timeline:
     * 1. Request A calls applyThemeMode("dark") → writes currentMode = "dark"
     * 2. Request A awaits runtime.apply() [ASYNC - yields control]
     * 3. Request B calls applyThemeMode("light") → writes currentMode = "light"
     * 4. Request B awaits runtime.apply() [ASYNC - yields control]
     * 5. Request A resumes → currentMode is now "light" (contaminated!)
     * 6. Request A returns compiled theme for aurora/dark BUT getThemeMode() = "light"
     * 
     * Result: Request A's response claims mode="light" when it should be "dark"
     */

    const capturedDuringRequest: Array<{
      requestId: string;
      requestedMode: string;
      capturedMode: string;
      capturedThemeId: string;
      compiledTheme: CompiledTheme | null;
    }> = [];

    // Request A: aurora + dark mode
    const promiseA = (async () => {
      const ctx: RenderContext = {
        theme: {
          themeId: themeA,
          source: "space",
          manifest: manifestA!,
        },
      };

      await runWithThemeContext(async () => {
        await renderContext.run(ctx, async () => {
          // Step 1: Write to isolated store (currentMode = "dark")
          const compiled = await applyThemeMode(modeA);

          // Step 2: Capture isolated state AFTER await
          const capturedMode = getThemeMode(); 
          const capturedThemeId = getActiveThemeId();
          const capturedCompiled = getCompiledTheme();

          capturedDuringRequest.push({
            requestId: "A",
            requestedMode: modeA,
            capturedMode,
            capturedThemeId,
            compiledTheme: capturedCompiled,
          });
        });
      });
    })();

    // Request B: cobalt + light mode — starts WHILE Request A is awaiting
    const promiseB = (async () => {
      const ctx: RenderContext = {
        theme: {
          themeId: themeB,
          source: "space",
          manifest: manifestB!,
        },
      };

      await runWithThemeContext(async () => {
        await renderContext.run(ctx, async () => {
          const compiled = await applyThemeMode(modeB);

          const capturedMode = getThemeMode();
          const capturedThemeId = getActiveThemeId();
          const capturedCompiled = getCompiledTheme();

          capturedDuringRequest.push({
            requestId: "B",
            requestedMode: modeB,
            capturedMode,
            capturedThemeId,
            compiledTheme: capturedCompiled,
          });
        });
      });
    })();

    // Execute concurrently — this is where the race happens
    await Promise.all([promiseA, promiseB]);

    // Sort by request ID for predictable assertions
    capturedDuringRequest.sort((a, b) => a.requestId.localeCompare(b.requestId));

    const resultA = capturedDuringRequest.find((r) => r.requestId === "A");
    const resultB = capturedDuringRequest.find((r) => r.requestId === "B");

    // Request A: requested "dark", but global currentMode may be "light" (contaminated by B)
    expect(resultA).toBeDefined();
    expect(resultA!.requestedMode).toBe(modeA);
    
    // THIS IS THE BUG: capturedMode will often be "light" instead of "dark"
    // because Request B overwrote currentMode during Request A's await
    if (resultA!.capturedMode !== resultA!.requestedMode) {
      console.error(
        `CONTAMINATION DETECTED: Request A requested mode="${resultA!.requestedMode}" ` +
        `but captured mode="${resultA!.capturedMode}"`
      );
    }
    
    // In a correct implementation, these would always pass:
    expect(resultA!.capturedMode).toBe(resultA!.requestedMode);
    expect(resultA!.capturedThemeId).toBe(themeA);

    // Request B: same issue
    expect(resultB).toBeDefined();
    expect(resultB!.requestedMode).toBe(modeB);
    expect(resultB!.capturedMode).toBe(resultB!.requestedMode);
    expect(resultB!.capturedThemeId).toBe(themeB);
  });

  it("DEMONSTRATES BUG: getResolvedTheme TOCTOU with concurrent access", async () => {
    /**
     * getResolvedTheme() has a Time-Of-Check-Time-Of-Use bug:
     * 
     * Line 209-219 (theme-bridge.ts):
     *   if (currentCompiledTheme && currentMode === mode && compiledForThemeId === getEffectiveThemeId()) {
     *     return currentCompiledTheme;  // CHECK
     *   }
     *   const compiled = compile(getActiveManifest(), mode);
     *   currentCompiledTheme = compiled;  // USE (write)
     *   currentMode = mode;
     *   compiledForThemeId = getEffectiveThemeId();
     * 
     * Between the CHECK and the USE, another request can overwrite the globals.
     */

    setActiveThemeId(themeA);

    const compileCalls: Array<{ mode: string; themeId: string; timestamp: number }> = [];
    const originalCompile = await import("@mosaix/theme").then((m) => m.compile);
    
    // Spy on compile calls to track how many times each mode is compiled
    const results: Array<{
      requestedMode: string;
      returnedMode: string;
      compiledForTheme: string;
    }> = [];

    // Spawn 20 concurrent requests alternating between light/dark
    const promises = Array.from({ length: 20 }).map((_, i) => {
      const mode: "light" | "dark" = i % 2 === 0 ? "light" : "dark";
      
      return renderContext.run({
        theme: {
          themeId: themeA,
          source: "test",
          manifest: manifestA!,
        },
      }, async () => {
        // Add random delay to maximize interleaving
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        
        const compiled = getResolvedTheme(mode);
        
        results.push({
          requestedMode: mode,
          returnedMode: getThemeMode(), // Reads global
          compiledForTheme: getActiveThemeId(),
        });
        
        return compiled;
      });
    });

    await Promise.all(promises);

    // In a correct implementation:
    // - Each request should see its own mode
    // - compile() should be called exactly twice (once for light, once for dark)
    
    const lightResults = results.filter((r) => r.requestedMode === "light" && r.returnedMode === "light");
    const darkResults = results.filter((r) => r.requestedMode === "dark" && r.returnedMode === "dark");
    
    // Contaminated results (requested light but got dark, or vice versa)
    const contaminatedLight = results.filter((r) => r.requestedMode === "light" && r.returnedMode === "dark");
    const contaminatedDark = results.filter((r) => r.requestedMode === "dark" && r.returnedMode === "light");

    if (contaminatedLight.length > 0 || contaminatedDark.length > 0) {
      console.error(
        `TOCTOU CONTAMINATION: ` +
        `${contaminatedLight.length} light requests got dark, ` +
        `${contaminatedDark.length} dark requests got light`
      );
    }

    // This assertion will FAIL if globals are contaminated
    expect(lightResults.length).toBe(10); // All 10 light requests should see "light"
    expect(darkResults.length).toBe(10);  // All 10 dark requests should see "dark"
  });
});
