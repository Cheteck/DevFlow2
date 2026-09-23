import { webcrypto } from "node:crypto";
import type { CryptoPort } from "@mosaix/ports-crypto";

/** Minimal `Crypto` surface the adapter relies on (subtle + getRandomValues). */
export interface CryptoLike {
  subtle: SubtleCrypto;
  getRandomValues<T extends Uint8Array>(array: T): T;
}

/**
 * Convert a string or Node `Buffer` into a `BufferSource` Web Crypto can
 * consume. Node's `Buffer` is typed `Buffer<ArrayBufferLike>`, which the DOM
 * `BufferSource` (requiring an `ArrayBuffer` view) rejects — a copy into a
 * plain `Uint8Array<ArrayBuffer>` keeps the boundary explicit.
 */
function toBufferSource(data: string | Buffer): BufferSource {
  if (typeof data === "string") return new TextEncoder().encode(data);
  return new Uint8Array(data);
}

export class WebCryptoAdapter implements CryptoPort {
  private readonly subtle: SubtleCrypto;
  private readonly cryptoRef: CryptoLike;

  constructor(customCrypto?: CryptoLike) {
    const defaultCrypto: CryptoLike =
      typeof crypto !== "undefined" ? crypto : (webcrypto as CryptoLike);
    this.cryptoRef = customCrypto ?? defaultCrypto;
    this.subtle = this.cryptoRef.subtle;
  }

  async hash(
    data: string | Buffer,
    algorithm: string = "sha-256",
  ): Promise<string> {
    const buffer = toBufferSource(data);
    // Map standard "sha256" to Web Crypto "SHA-256"
    const webAlgorithm =
      algorithm.toLowerCase() === "sha256"
        ? "SHA-256"
        : algorithm.toUpperCase();

    const digest = await this.subtle.digest(webAlgorithm, buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async hmac(
    data: string | Buffer,
    secret: string,
    algorithm: string = "sha-256",
  ): Promise<string> {
    const webAlgorithm =
      algorithm.toLowerCase() === "sha256"
        ? "SHA-256"
        : algorithm.toUpperCase();

    const secretBuffer = new TextEncoder().encode(secret);
    const key = await this.subtle.importKey(
      "raw",
      secretBuffer,
      { name: "HMAC", hash: { name: webAlgorithm } },
      false,
      ["sign"],
    );

    const signature = await this.subtle.sign(
      "HMAC",
      key,
      toBufferSource(data),
    );

    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async encrypt(
    data: string | Buffer,
    key: Buffer,
  ): Promise<{ ciphertext: Buffer; iv: Buffer; tag?: Buffer }> {
    const iv = this.randomBytes(12); // Recommendation for AES-GCM
    const cryptoKey = await this.subtle.importKey(
      "raw",
      toBufferSource(key),
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const encrypted = await this.subtle.encrypt(
      { name: "AES-GCM", iv: toBufferSource(iv) },
      cryptoKey,
      toBufferSource(data),
    );

    // Web Crypto appends auth tag to ciphertext automatically
    return {
      ciphertext: Buffer.from(encrypted),
      iv: Buffer.from(iv),
    };
  }

  async decrypt(ciphertext: Buffer, key: Buffer, iv: Buffer): Promise<Buffer> {
    const cryptoKey = await this.subtle.importKey(
      "raw",
      toBufferSource(key),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const decrypted = await this.subtle.decrypt(
      { name: "AES-GCM", iv: toBufferSource(iv) },
      cryptoKey,
      toBufferSource(ciphertext),
    );

    return Buffer.from(decrypted);
  }

  async sign(data: string | Buffer, privateKeyPEM: string): Promise<Buffer> {
    // Import PEM Private Key into Web Crypto
    const privateKey = await this.importPrivateKey(privateKeyPEM);

    const signature = await this.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      toBufferSource(data),
    );

    return Buffer.from(signature);
  }

  async verify(
    data: string | Buffer,
    signature: Buffer,
    publicKeyPEM: string,
  ): Promise<boolean> {
    const publicKey = await this.importPublicKey(publicKeyPEM);

    return await this.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      toBufferSource(signature),
      toBufferSource(data),
    );
  }

  randomBytes(length: number): Buffer {
    const bytes = new Uint8Array(length);
    this.cryptoRef.getRandomValues(bytes);
    return Buffer.from(bytes);
  }

  async verifyPassword(password: string, expectedHash: string, _salt: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const digest = Array.from(new Uint8Array(await this.subtle.digest("SHA-256", data)));
    const hash = digest.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hash === expectedHash;
  }

  private async importPrivateKey(pem: string): Promise<CryptoKey> {
    const binaryDer = new Uint8Array(this.pemToBinary(pem, "PRIVATE KEY"));
    return await this.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );
  }

  private async importPublicKey(pem: string): Promise<CryptoKey> {
    const binaryDer = new Uint8Array(this.pemToBinary(pem, "PUBLIC KEY"));
    return await this.subtle.importKey(
      "spki",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["verify"],
    );
  }

  private pemToBinary(pem: string, label: string): Uint8Array {
    const lines = pem.split("\n");
    const body = lines
      .filter(
        (line) =>
          !line.startsWith(`-----BEGIN ${label}-----`) &&
          !line.startsWith(`-----END ${label}-----`),
      )
      .map((line) => line.trim())
      .join("");

    // Base64 decode to binary string
    const binaryString = atob(body);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}
