import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { NodeCryptoAdapter } from "./index.js";

describe("NodeCryptoAdapter", () => {
  it("can hash, encrypt/decrypt with AES-GCM, and sign/verify", async () => {
    const adapter = new NodeCryptoAdapter();

    // Hashing
    const hash = await adapter.hash("Hello MosaiX");
    expect(hash).toBe(
      "e0ce65df21d73247650d817162a1db0b86a40a9ceb840501cb492609711d23a0",
    );

    // Symmetric Encryption
    const key = adapter.randomBytes(32);
    const secretMessage = "My Confidential Secret";
    const { ciphertext, iv, tag } = await adapter.encrypt(secretMessage, key);

    expect(ciphertext).toBeDefined();
    expect(iv).toHaveLength(12);

    const decrypted = await adapter.decrypt(ciphertext, key, iv, tag);
    expect(decrypted.toString("utf-8")).toBe(secretMessage);

    // Asymmetric Signatures
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const signature = await adapter.sign("Document content", privateKey);
    const isValid = await adapter.verify(
      "Document content",
      signature,
      publicKey,
    );
    expect(isValid).toBe(true);

    const isInvalid = await adapter.verify(
      "Altered document content",
      signature,
      publicKey,
    );
    expect(isInvalid).toBe(false);
  });

  describe("timingSafeEqual", () => {
    const adapter = new NodeCryptoAdapter();

    it("returns true for identical string values", () => {
      expect(adapter.timingSafeEqual("123456", "123456")).toBe(true);
    });

    it("returns true for identical buffers", () => {
      const buf = Buffer.from("abcde");
      expect(adapter.timingSafeEqual(buf, buf)).toBe(true);
      expect(adapter.timingSafeEqual(buf, Buffer.from("abcde"))).toBe(true);
    });

    it("returns false for different strings of the same length", () => {
      expect(adapter.timingSafeEqual("123456", "654321")).toBe(false);
      expect(adapter.timingSafeEqual("123456", "123457")).toBe(false);
    });

    it("returns false for different lengths without throwing", () => {
      expect(adapter.timingSafeEqual("123", "123456")).toBe(false);
      expect(adapter.timingSafeEqual("123456", "123")).toBe(false);
      expect(adapter.timingSafeEqual("", "abc")).toBe(false);
    });

    it("handles string vs Buffer inputs", () => {
      expect(adapter.timingSafeEqual("abc", Buffer.from("abc"))).toBe(true);
      expect(adapter.timingSafeEqual(Buffer.from("abc"), "abc")).toBe(true);
      expect(adapter.timingSafeEqual("abc", Buffer.from("xyz"))).toBe(false);
    });

    it("returns false for two empty strings", () => {
      expect(adapter.timingSafeEqual("", "")).toBe(true);
    });

    it("is safe for HMAC digest comparison", async () => {
      const secret = "hmac-key-12345";
      const hash1 = await adapter.hmac("data-abc", secret);
      const hash2 = await adapter.hmac("data-abc", secret);
      const hash3 = await adapter.hmac("data-xyz", secret);

      expect(adapter.timingSafeEqual(hash1, hash2)).toBe(true);
      expect(adapter.timingSafeEqual(hash1, hash3)).toBe(false);
    });
  });
});
