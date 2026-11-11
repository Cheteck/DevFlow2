import { describe, expect, it } from "vitest";
import { PluginEngine } from "./runtime/index.js";
import { SolaraContentModeratorPlugin } from "@mosaix-plugin/solara-content-moderator";
import type { PluginManifest } from "@mosaix/contracts";

describe("Plugin Engine Modernization E2E Suite", () => {
  it("executes registered hooks and rejects moderated content", async () => {
    const engine = new PluginEngine();

    const manifest: PluginManifest = {
      id: "@mosaix-plugin/solara-content-moderator",
      name: "Solara Content Moderator",
      version: "0.1.0",
      entrypoint: "./src/index.ts",
      extension: {
        target: "solara",
        point: "solara.post.beforeCreate",
      },
    };

    engine.lifecycle.validate(manifest);
    engine.registerHook(
      "solara.post.beforeCreate",
      SolaraContentModeratorPlugin.hookHandler,
      { pluginId: manifest.id }
    );

    // Clean content -> success
    const cleanRes = await engine.runHook("solara.post.beforeCreate", {
      content: "Hello MosaiX world!",
    });
    expect(cleanRes.results).toBeDefined();

    // Spam content -> rejected: the engine collects hook errors (default
    // parallel mode, stopOnError: false) instead of throwing — moderation
    // blocks the content via errors[], results stay empty.
    const spamRes = await engine.runHook("solara.post.beforeCreate", {
      content: "Buy cheap spam products!",
    });
    expect(spamRes.results).toHaveLength(0);
    expect(spamRes.errors).toHaveLength(1);
    expect(spamRes.errors[0]?.pluginId).toBe(
      "@mosaix-plugin/solara-content-moderator",
    );
    expect(spamRes.errors[0]?.error.message).toContain("mot proscrit [spam]");
  });

  it("calculates discounts dynamically via commerce.checkout.calculateDiscount hook", async () => {
    const engine = new PluginEngine();

    engine.registerHook(
      "commerce.checkout.calculateDiscount",
      (args: { total: number }) => args.total * 0.85,
      { priority: 10 }
    );

    const res = await engine.runHook<{ total: number }, number>(
      "commerce.checkout.calculateDiscount",
      { total: 100 }
    );

    expect(res.results[0]).toBe(85);
  });
});
