import { randomUUID, randomBytes } from "node:crypto";
import type { IdGeneratorPort } from "@mosaix/ports-id";

export class UuidGeneratorAdapter implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }

  randomBytes(length: number): Buffer {
    return Buffer.from(randomBytes(length));
  }
}
