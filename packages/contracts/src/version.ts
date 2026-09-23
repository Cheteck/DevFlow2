/**
 * Versioning strategy for the MosaiX contract layer.
 *
 * The contract surface is versioned independently of individual artifacts.
 * A major bump signals breaking changes across the contract layer
 * (e.g. manifest shape, envelope format, permission grammar).
 *
 *   @mosaix/contracts@1.x → application manifest v1, theme manifest v1, event contract v1
 *   @mosaix/contracts@2.x → breaking changes
 */
export const CONTRACT_VERSION = "1.0";
