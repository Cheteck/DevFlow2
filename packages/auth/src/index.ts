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

export { AuthManager } from "./auth-manager";
export type { AuthManagerOptions, AuthenticationOutcome } from "./auth-manager";

export { ProviderRegistry } from "./provider-registry";
export type { ProviderRegistryOptions } from "./provider-registry";

export { SessionManager } from "./session-manager";
export type { SessionManagerOptions } from "./session-manager";

export { ChallengeManager } from "./challenge-manager";
export type { ChallengeManagerOptions, Challenge } from "./challenge-manager";

export { TokenManager } from "./token-manager";
export type { TokenManagerOptions } from "./token-manager";

export { JwtService, resolveJwtSecret } from "./jwt-service";
export type { PlatformJwtPayload, JwtServiceOptions } from "./jwt-service";

export * from "./oidc-bridge";
export * from "./oauth/oauth-types";
export * from "./oauth/social-auth-provider";
export * from "./oauth/social-auth-service";
export * from "./oauth/providers/google-provider";
export * from "./oauth/providers/apple-provider";
export * from "./oauth/providers/microsoft-provider";
export * from "./oauth/providers/github-provider";
export * from "./oauth/providers/facebook-provider";

