/**
 * CryptoPort — Decouples application hashing, encryption, decryption, HMAC, signatures, and entropy.
 */
export interface CryptoPort {
  hash(data: string | Buffer, algorithm?: string): Promise<string>;
  hmac(data: string | Buffer, secret: string, algorithm?: string): Promise<string>;
  encrypt(data: string | Buffer, key: Buffer): Promise<{ ciphertext: Buffer; iv: Buffer; tag?: Buffer }>;
  decrypt(ciphertext: Buffer, key: Buffer, iv: Buffer, tag?: Buffer): Promise<Buffer>;
  sign(data: string | Buffer, privateKey: string): Promise<Buffer>;
  verify(data: string | Buffer, signature: Buffer, publicKey: string): Promise<boolean>;
  randomBytes(length: number): Buffer;
  verifyPassword(password: string, expectedHash: string, salt?: string): Promise<boolean>;
}
