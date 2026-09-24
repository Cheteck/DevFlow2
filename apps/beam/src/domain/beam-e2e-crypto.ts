import * as crypto from "node:crypto";

export interface EncryptedMessagePayload {
  algorithm: "AES-256-GCM";
  ivHex: string;
  ciphertextHex: string;
  authTagHex: string;
  senderPublicKeyHex: string;
}

export interface UserKeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * End-to-End Encryption Engine for Beam Messaging
 * Built on standard ECDH (secp256k1) and AES-256-GCM
 */
export class BeamE2EEncryptionEngine {
  static generateKeyPair(): UserKeyPair {
    const ecdh = crypto.createECDH("secp256k1");
    ecdh.generateKeys();
    return {
      publicKey: ecdh.getPublicKey("hex"),
      privateKey: ecdh.getPrivateKey("hex"),
    };
  }

  static computeSharedSecret(myPrivateKeyHex: string, theirPublicKeyHex: string): Buffer {
    const ecdh = crypto.createECDH("secp256k1");
    ecdh.setPrivateKey(myPrivateKeyHex, "hex");
    const rawSecret = ecdh.computeSecret(theirPublicKeyHex, "hex");
    // Derive a 256-bit AES key using HKDF or SHA-256
    return crypto.createHash("sha256").update(rawSecret).digest();
  }

  static encrypt(plaintext: string, myPrivateKeyHex: string, theirPublicKeyHex: string): EncryptedMessagePayload {
    const sharedKey = this.computeSharedSecret(myPrivateKeyHex, theirPublicKeyHex);
    const iv = crypto.randomBytes(12); // 96 bits standard for GCM

    const cipher = crypto.createCipheriv("aes-256-gcm", sharedKey, iv);
    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    const ecdh = crypto.createECDH("secp256k1");
    ecdh.setPrivateKey(myPrivateKeyHex, "hex");
    const senderPublicKey = ecdh.getPublicKey("hex");

    return {
      algorithm: "AES-256-GCM",
      ivHex: iv.toString("hex"),
      ciphertextHex: ciphertext,
      authTagHex: authTag.toString("hex"),
      senderPublicKeyHex: senderPublicKey,
    };
  }

  static decrypt(payload: EncryptedMessagePayload, myPrivateKeyHex: string): string {
    const sharedKey = this.computeSharedSecret(myPrivateKeyHex, payload.senderPublicKeyHex);
    const iv = Buffer.from(payload.ivHex, "hex");
    const authTag = Buffer.from(payload.authTagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", sharedKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}
