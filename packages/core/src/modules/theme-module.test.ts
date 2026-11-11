import { describe, it, expect } from "vitest";
import { KernelContext } from "../kernel-module.js";
import { ThemeModule, THEME_SERVICE } from "./theme-module.js";
import {
  ThemeRuntime,
  ThemeTargetRegistry,
  InMemoryThemeAssignmentsStore,
} from "@mosaix/theme";

describe("ThemeModule (OCP)", () => {
  it("provides module metadata", () => {
    const mod = new ThemeModule();
    expect(mod.name).toBe("theme");
    expect(mod.version).toBe("1.0.0");
  });

  it("registers ThemeRuntime into KernelContext as theme service", () => {
    const ctx = new KernelContext();
    const mod = new ThemeModule();

    mod.register(ctx);

    const service = ctx.getService<ThemeRuntime>(THEME_SERVICE);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ThemeRuntime);
    expect(mod.getRuntime()).toBe(service);
  });

  it("accepts a custom assignments store", () => {
    const customStore = new InMemoryThemeAssignmentsStore();
    const ctx = new KernelContext();
    const mod = new ThemeModule({ store: customStore });

    mod.register(ctx);

    const service = ctx.getService<ThemeRuntime>(THEME_SERVICE);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ThemeRuntime);
  });

  it("allows injecting a pre-existing ThemeRuntime instance", () => {
    const customStore = new InMemoryThemeAssignmentsStore();
    const ctx = new KernelContext();
    const preExisting = new ThemeRuntime({
      registry: new ThemeTargetRegistry(),
      store: customStore,
    });
    const mod = new ThemeModule({ runtime: preExisting });

    mod.register(ctx);

    const service = ctx.getService<ThemeRuntime>(THEME_SERVICE);
    expect(service).toBe(preExisting);
    expect(mod.getRuntime()).toBe(preExisting);
  });
});
