import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { NodeCryptoAdapter } from "./index";

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
});
