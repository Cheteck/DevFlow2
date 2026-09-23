import { getRandomValues, randomBytes } from "node:crypto";
import type { IdGeneratorPort } from "@mosaix/ports-id";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = 32;

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = Math.floor(now / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  const randomBytesArr = new Uint8Array(len);
  getRandomValues(randomBytesArr);
  let str = "";
  for (let i = 0; i < len; i++) {
    const byte = randomBytesArr[i] ?? 0;
    str += ENCODING.charAt(byte % ENCODING_LEN);
  }
  return str;
}

export class UlidGeneratorAdapter implements IdGeneratorPort {
  generate(): string {
    const now = Date.now();
    return encodeTime(now, 10) + encodeRandom(16);
  }

  randomBytes(length: number): Buffer {
    return Buffer.from(randomBytes(length));
  }
}
