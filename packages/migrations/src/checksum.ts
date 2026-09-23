/**
 * Checksum calculator — computes a content digest at load time (ADR-0006 §3,
 * R2). Purely deterministic, runtime-agnostic (works in Node and the browser
 * without external dependencies).
 *
 * NOTE (spike scope): FNV-1a 64-bit is a fast non-cryptographic hash,
 * sufficient to detect accidental modification of an applied migration. A
 * cryptographic hash (SHA-256) can be swapped in during Phase 0 without
 * changing the contract.
 */

const OFFSET_BASIS = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

/** Computes the FNV-1a 64-bit checksum of a string, hex-encoded. */
export function computeChecksum(content: string): string {
  let hash = OFFSET_BASIS;
  for (let i = 0; i < content.length; i++) {
    hash ^= BigInt(content.charCodeAt(i));
    hash = (hash * PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
}
