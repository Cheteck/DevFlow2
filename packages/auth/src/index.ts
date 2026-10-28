/**
 * @mosaix/auth — Authentication bounded context for MosaiX.
 *
 * Provides a capability-based authentication layer built on top of the
 * Kernel and existing MosaiX abstractions (ports, contracts, Zod,
 * capabilities, events, DI, pipeline, multi-tenant).
 *
 * @mosaix/auth does NOT know:
 * - PostgreSQL / Redis / S3
 * - Twilio / SES / Kafka / HTTP
 * - Express / Fastify / React
 * - any particular IAM provider
 *
 * It only knows MosaiX ports.
 */

export { AuthManager } from "./auth-manager.js";
export type { AuthManagerOptions, AuthenticationOutcome } from "./auth-manager.js";

export { ProviderRegistry } from "./provider-registry.js";
export type { ProviderRegistryOptions } from "./provider-registry.js";

export { SessionManager } from "./session-manager.js";
export type { SessionManagerOptions } from "./session-manager.js";

export { SessionResolver } from "./session-resolver.js";
export type { PlatformSessionContext } from "./session-resolver.js";

export { ChallengeManager } from "./challenge-manager.js";
export type { ChallengeManagerOptions, Challenge } from "./challenge-manager.js";

export { TokenManager } from "./token-manager.js";
export type { TokenManagerOptions } from "./token-manager.js";

export {
  JwtService,
  resolveJwtSecret,
  resolveJwtPreviousSecrets,
  resolveJwtSecrets,
} from "./jwt-service.js";
export type { PlatformJwtPayload, JwtServiceOptions } from "./jwt-service.js";

export * from "./oidc-bridge.js";
export * from "./oauth/oauth-types.js";
export * from "./oauth/social-auth-provider.js";
export * from "./oauth/social-auth-service.js";
export * from "./oauth/providers/google-provider.js";
export * from "./oauth/providers/apple-provider.js";
export * from "./oauth/providers/microsoft-provider.js";
export * from "./oauth/providers/github-provider.js";
export * from "./oauth/providers/facebook-provider.js";
