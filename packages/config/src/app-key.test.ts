import { describe, it, expect } from "vitest";
import {
  generateAppKey,
  decodeAppKey,
  parseAppKey,
  isValidAppKey,
  generateSecret,
  parsePreviousKeys,
  resolveKeysWithRotation,
  requireAppKey,
  MissingAppKeyError,
  InvalidAppKeyError,
  APP_KEY_PREFIX,
} from "./app-key";

describe("app-key (Laravel-style)", () => {
  it("generates base64: keys decoding to 32 bytes", () => {
    const key = generateAppKey();
    expect(key.startsWith(APP_KEY_PREFIX)).toBe(true);
    expect(decodeAppKey(key).length).toBe(32);
  });

  it("generates unique keys", () => {
    expect(generateAppKey()).not.toBe(generateAppKey());
  });

  it("parses AES-256 keys, rejects wrong lengths", () => {
    const key = generateAppKey(32);
    expect(parseAppKey(key, "AES-256-CBC").length).toBe(32);
    expect(() => parseAppKey(generateAppKey(16), "AES-256-CBC")).toThrow(
      InvalidAppKeyError,
    );
    expect(parseAppKey(generateAppKey(16), "AES-128-CBC").length).toBe(16);
  });

  it("rejects missing prefix and garbage", () => {
    expect(() => decodeAppKey("plain-secret")).toThrow(InvalidAppKeyError);
    expect(() => decodeAppKey("")).toThrow(MissingAppKeyError);
    expect(() => decodeAppKey("base64:!!!")).toThrow(InvalidAppKeyError);
  });

  it("isValidAppKey is a safe boolean", () => {
    expect(isValidAppKey(generateAppKey())).toBe(true);
    expect(isValidAppKey(undefined)).toBe(false);
    expect(isValidAppKey("nope")).toBe(false);
  });

  it("generateSecret enforces minimum entropy", () => {
    expect(generateSecret().length).toBeGreaterThanOrEqual(64); // 32 bytes hex
    expect(() => generateSecret({ bytes: 8 })).toThrow(InvalidAppKeyError);
  });

  it("rotation helpers order current first, dedupe", () => {
    expect(parsePreviousKeys("a, b,,a")).toEqual(["a", "b", "a"]);
    expect(resolveKeysWithRotation("new", "old1, old2")).toEqual([
      "new",
      "old1",
      "old2",
    ]);
    expect(resolveKeysWithRotation("same", ["same", "old"])).toEqual([
      "same",
      "old",
    ]);
    expect(resolveKeysWithRotation(undefined, "old")).toEqual(["old"]);
  });

  it("requireAppKey throws MissingAppKeyError when empty", () => {
    expect(() => requireAppKey({})).toThrow(MissingAppKeyError);
    expect(() => requireAppKey({ MOSAIX_APP_KEY: "bad" })).toThrow(
      InvalidAppKeyError,
    );
    expect(() =>
      requireAppKey({ MOSAIX_APP_KEY: generateAppKey() }),
    ).not.toThrow();
  });
});
