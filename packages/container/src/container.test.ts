import { describe, it, expect } from "vitest";
import { Container } from "./container";

describe("Container", () => {
  it("should bind and resolve a simple value", () => {
    const container = new Container();
    container.bind("foo", () => "bar");

    expect(container.has("foo")).toBe(true);
    expect(container.make("foo")).toBe("bar");
  });

  it("should support binding raw objects or values", () => {
    const container = new Container();
    container.bind("foo", "bar");

    expect(container.make("foo")).toBe("bar");
  });

  it("should bind and resolve singletons only once", () => {
    const container = new Container();
    let count = 0;
    container.singleton("counter", () => {
      count++;
      return { count };
    });

    const first = container.make<{ count: number }>("counter");
    const second = container.make<{ count: number }>("counter");

    expect(first.count).toBe(1);
    expect(second.count).toBe(1);
    expect(first).toBe(second);
  });

  it("should handle transient bindings separately", () => {
    const container = new Container();
    let count = 0;
    container.bind("counter", () => {
      count++;
      return { count };
    });

    const first = container.make<{ count: number }>("counter");
    const second = container.make<{ count: number }>("counter");

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(first).not.toBe(second);
  });

  it("should resolve bound instances", () => {
    const container = new Container();
    const instance = { name: "Mosaix" };
    container.instance("config", instance);

    expect(container.make("config")).toBe(instance);
  });

  it("should support hierarchical scopes and resolve from parent", () => {
    const parent = new Container();
    parent.bind("foo", () => "parent-val");

    const child = parent.createChild();
    expect(child.has("foo")).toBe(true);
    expect(child.make("foo")).toBe("parent-val");
  });

  it("should support child container override bindings", () => {
    const parent = new Container();
    parent.bind("foo", () => "parent-val");

    const child = parent.createChild();
    child.bind("foo", () => "child-val");

    expect(parent.make("foo")).toBe("parent-val");
    expect(child.make("foo")).toBe("child-val");
  });

  it("should support scoped (tenant-scoped) singletons in hierarchical containers", () => {
    const parent = new Container();
    let count = 0;
    parent.scoped("tenantService", () => {
      count++;
      return { id: count };
    });

    const childA = parent.createChild();
    const childB = parent.createChild();

    const a1 = childA.make<{ id: number }>("tenantService");
    const a2 = childA.make<{ id: number }>("tenantService");
    const b1 = childB.make<{ id: number }>("tenantService");

    expect(a1.id).toBe(1);
    expect(a2.id).toBe(1); // cached in childA scope
    expect(b1.id).toBe(2); // resolved separately in childB scope

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b1);
  });

  it("should throw error if target is not bound", () => {
    const container = new Container();
    expect(() => container.make("non-existent")).toThrowError(
      "Target [non-existent] is not bound in the container.",
    );
  });

  it("should wrap caught errors when factory throws", () => {
    const container = new Container();
    container.bind("failing", () => {
      throw new Error("inner failure");
    });

    expect(() => container.make("failing")).toThrowError(
      "Failed to resolve [failing]: inner failure",
    );
  });
});

describe("Official IoC Container Enhancements (Phase 2)", () => {
  it("supports Symbol tokens and class constructors", () => {
    const container = new Container();
    const TOKEN = Symbol("SERVICE_TOKEN");

    class TestService {
      constructor(public name = "test") {}
    }

    container.bind(TOKEN, () => new TestService("symbol-service"));
    const resolvedSymbol = container.resolve<TestService>(TOKEN);
    expect(resolvedSymbol.name).toBe("symbol-service");

    const resolvedCtor = container.resolve(TestService);
    expect(resolvedCtor).toBeInstanceOf(TestService);
    expect(resolvedCtor.name).toBe("test");
  });
});
