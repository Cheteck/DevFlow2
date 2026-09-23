/**
 * @mosaix/auth — ChallengeManager tests.
 */

import { describe, it, expect } from "vitest";
import { ChallengeManager } from "./challenge-manager";

describe("ChallengeManager", () => {
  it("creates a challenge with default TTL", () => {
    const manager = new ChallengeManager();
    const challenge = manager.create("password");

    expect(challenge.id).toBeTruthy();
    expect(challenge.type).toBe("password");
    expect(challenge.attempts).toBe(0);
    expect(challenge.maxAttempts).toBe(3);
    expect(manager.get(challenge.id)).toBeDefined();
  });

  it("creates a challenge with custom TTL and max attempts", () => {
    const manager = new ChallengeManager({
      defaultTtlSeconds: 600,
      maxAttempts: 5,
    });
    const challenge = manager.create("otp", { code: "123456" }, 600);

    expect(challenge.maxAttempts).toBe(5);
    expect(challenge.data).toEqual({ code: "123456" });
  });

  it("returns undefined for expired challenge", () => {
    const manager = new ChallengeManager({ defaultTtlSeconds: 0 });
    const challenge = manager.create("password");

    expect(manager.get(challenge.id)).toBeUndefined();
  });

  it("increments attempts", () => {
    const manager = new ChallengeManager();
    const challenge = manager.create("password");

    const updated = manager.incrementAttempt(challenge.id);
    expect(updated?.attempts).toBe(1);
  });

  it("consumes challenge and removes it", () => {
    const manager = new ChallengeManager();
    const challenge = manager.create("password");

    const consumed = manager.consume(challenge.id);
    expect(consumed?.id).toBe(challenge.id);
    expect(manager.get(challenge.id)).toBeUndefined();
  });

  it("does not consume challenge when max attempts reached", () => {
    const manager = new ChallengeManager({ maxAttempts: 1 });
    const challenge = manager.create("password");

    manager.incrementAttempt(challenge.id);
    const consumed = manager.consume(challenge.id);
    expect(consumed).toBeUndefined();
  });

  it("revokes a challenge", () => {
    const manager = new ChallengeManager();
    const challenge = manager.create("password");

    manager.revoke(challenge.id);
    expect(manager.get(challenge.id)).toBeUndefined();
  });

  it("clears all challenges", () => {
    const manager = new ChallengeManager();
    manager.create("password");
    manager.create("otp");

    manager.clear();
    expect(manager.list()).toHaveLength(0);
  });

  it("cleans up expired challenges", () => {
    const manager = new ChallengeManager({ defaultTtlSeconds: 0 });
    manager.create("password");

    expect(manager.list()).toHaveLength(0);
  });
});
