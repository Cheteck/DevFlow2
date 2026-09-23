/**
 * IdGeneratorPort — Decouples ID generation from the domain.
 */
export interface IdGeneratorPort {
  /** Generates a new unique identifier string. */
  generate(): string;
  /** Generates secure random bytes. */
  randomBytes(length: number): Buffer;
}
