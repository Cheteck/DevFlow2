/**
 * Artifact signature — integrity and provenance of a Mosaix artifact.
 */

export type SignatureAlgorithm = "ed25519" | "ecdsa-p256" | "rsa-pss-4096";

export interface ArtifactSignature {
  algorithm: SignatureAlgorithm;
  /** Public key identifier (key id / fingerprint). */
  keyId: string;
  /** Base64-encoded digest of the canonical manifest bytes. */
  digest: string;
  /** Base64-encoded signature. */
  signature: string;
  /** ISO 8601 UTC signing time. */
  signedAt: string;
}
