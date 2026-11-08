import { describe, expect, it } from "vitest";
import { generateKeyPairSync, webcrypto } from "node:crypto";
import { WebCryptoAdapter } from "./index.js";

describe("WebCryptoAdapter", () => {
  it("can hash, encrypt/decrypt with AES-GCM, and sign/verify", async () => {
    const adapter = new WebCryptoAdapter();

    // Hashing
    const hash = await adapter.hash("Hello MosaiX");
    expect(hash).toBe(
      "e0ce65df21d73247650d817162a1db0b86a40a9ceb840501cb492609711d23a0",
    );

    // Symmetric Encryption
    const key = adapter.randomBytes(32);
    const secretMessage = "My Confidential Secret";
    const { ciphertext, iv } = await adapter.encrypt(secretMessage, key);

    expect(ciphertext).toBeDefined();
    expect(iv).toHaveLength(12);

    const decrypted = await adapter.decrypt(ciphertext, key, iv);
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

  it("accepts an explicitly injected CryptoLike instance", async () => {
    const adapter = new WebCryptoAdapter(webcrypto);
    const hash = await adapter.hash("Hello MosaiX");
    expect(hash).toBe(
      "e0ce65df21d73247650d817162a1db0b86a40a9ceb840501cb492609711d23a0",
    );
    expect(adapter.randomBytes(16)).toHaveLength(16);
  });

  describe("timingSafeEqual", () => {
    const adapter = new WebCryptoAdapter();

    it("returns true for identical strings", () => {
      expect(adapter.timingSafeEqual("123456", "123456")).toBe(true);
    });

    it("returns true for identical buffers", () => {
      const buf = Buffer.from("abcde");
      expect(adapter.timingSafeEqual(buf, buf)).toBe(true);
      expect(adapter.timingSafeEqual(buf, Buffer.from("abcde"))).toBe(true);
    });

    it("returns false for different strings of same length", () => {
      expect(adapter.timingSafeEqual("123456", "654321")).toBe(false);
    });

    it("returns false for different lengths", () => {
      expect(adapter.timingSafeEqual("123", "123456")).toBe(false);
    });

    it("handles string vs Buffer inputs", () => {
      expect(adapter.timingSafeEqual("abc", Buffer.from("abc"))).toBe(true);
      expect(adapter.timingSafeEqual(Buffer.from("abc"), "abc")).toBe(true);
      expect(adapter.timingSafeEqual("abc", Buffer.from("xyz"))).toBe(false);
    });
  });
});
