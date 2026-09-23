import { describe, expect, it, vi } from "vitest";
import { MosaixMessageBusAdapter } from "./index";

describe("MosaixMessageBusAdapter", () => {
  it("can publish and subscribe to in-memory topics", async () => {
    const bus = new MosaixMessageBusAdapter();
    const received: string[] = [];

    const unsub = bus.subscribe<string>("test_topic", (msg) => {
      received.push(msg);
    });

    await bus.publish("test_topic", "hello");
    expect(received).toEqual(["hello"]);

    unsub();
    await bus.publish("test_topic", "ignored");
    expect(received).toEqual(["hello"]);
  });

  it("notifies handler errors via the injected callback without breaking other handlers", async () => {
    const errors: Array<{ error: unknown; topic: string }> = [];
    const bus = new MosaixMessageBusAdapter({
      onHandlerError: (error, context) => {
        errors.push({ error, topic: context.topic });
      },
    });

    const received: string[] = [];
    bus.subscribe<string>("topic", async () => {
      throw new Error("boom");
    });
    bus.subscribe<string>("topic", (msg) => {
      received.push(msg);
    });

    await bus.publish("topic", "hello");

    expect(errors).toHaveLength(1);
    expect(errors[0]?.topic).toBe("topic");
    expect(errors[0]?.error).toBeInstanceOf(Error);
    expect(received).toEqual(["hello"]);
  });

  it("logs handler errors via console.error by default without breaking other handlers", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const bus = new MosaixMessageBusAdapter();
      bus.subscribe<string>("topic", async () => {
        throw new Error("boom");
      });
      bus.subscribe<string>("topic", () => {});

      await bus.publish("topic", "hello");

      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
