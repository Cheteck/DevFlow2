import {
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  createSign,
  createVerify,
  randomBytes,
} from "node:crypto";
import type { CryptoPort } from "@mosaix/ports-crypto";

export class NodeCryptoAdapter implements CryptoPort {
  async hash(
    data: string | Buffer,
    algorithm: string = "sha256",
  ): Promise<string> {
    const hash = createHash(algorithm);
    hash.update(data);
    return hash.digest("hex");
  }

  async hmac(
    data: string | Buffer,
    secret: string,
    algorithm: string = "sha256",
  ): Promise<string> {
    const hmac = createHmac(algorithm, secret);
    hmac.update(data);
    return hmac.digest("base64url");
  }

  async encrypt(
    data: string | Buffer,
    key: Buffer,
  ): Promise<{ ciphertext: Buffer; iv: Buffer; tag?: Buffer }> {
    const iv = this.randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const buffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return { ciphertext, iv, tag };
  }

  async decrypt(
    ciphertext: Buffer,
    key: Buffer,
    iv: Buffer,
    tag?: Buffer,
  ): Promise<Buffer> {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    if (tag) {
      decipher.setAuthTag(tag);
    }

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  async sign(data: string | Buffer, privateKey: string): Promise<Buffer> {
    const sign = createSign("SHA256");
    sign.update(data);
    return sign.sign(privateKey);
  }

  async verify(
    data: string | Buffer,
    signature: Buffer,
    publicKey: string,
  ): Promise<boolean> {
    const verify = createVerify("SHA256");
    verify.update(data);
    return verify.verify(publicKey, signature);
  }

  randomBytes(length: number): Buffer {
    return randomBytes(length);
  }

  async verifyPassword(password: string, expectedHash: string, _salt: string): Promise<boolean> {
    const hash = createHash("sha256").update(password).digest("hex");
    return hash === expectedHash;
  }
}
