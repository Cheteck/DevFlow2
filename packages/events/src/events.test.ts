import { describe, it, expect } from "vitest";
import { EventDispatcher } from "./dispatcher";

describe("EventDispatcher", () => {
  it("should register a listener and dispatch events correctly", async () => {
    const dispatcher = new EventDispatcher();
    let received: string | undefined;

    dispatcher.listen<string>("greeting", (payload) => {
      received = payload;
    });

    expect(dispatcher.hasListeners("greeting")).toBe(true);
    expect(dispatcher.hasListeners("other")).toBe(false);

    await dispatcher.dispatch("greeting", "hello world");
    expect(received).toBe("hello world");
  });

  it("should call multiple listeners in order", async () => {
    const dispatcher = new EventDispatcher();
    const calls: string[] = [];

    dispatcher.listen("click", () => {
      calls.push("first");
    });

    dispatcher.listen("click", () => {
      calls.push("second");
    });

    await dispatcher.dispatch("click");
    expect(calls).toEqual(["first", "second"]);
  });

  it("should forget listeners for an event", async () => {
    const dispatcher = new EventDispatcher();
    let count = 0;

    dispatcher.listen("ping", () => {
      count++;
    });

    await dispatcher.dispatch("ping");
    expect(count).toBe(1);

    dispatcher.forget("ping");
    expect(dispatcher.hasListeners("ping")).toBe(false);

    await dispatcher.dispatch("ping");
    expect(count).toBe(1); // did not change
  });

  it("should support event subscribers", async () => {
    const dispatcher = new EventDispatcher();
    let loginFired = false;
    let logoutFired = false;

    const subscriber = {
      subscribe(d: EventDispatcher) {
        d.listen("user.login", () => {
          loginFired = true;
        });
        d.listen("user.logout", () => {
          logoutFired = true;
        });
      },
    };

    dispatcher.subscribe(subscriber);

    await dispatcher.dispatch("user.login");
    await dispatcher.dispatch("user.logout");

    expect(loginFired).toBe(true);
    expect(logoutFired).toBe(true);
  });
});
