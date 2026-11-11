/**
 * @mosaix/contracts — Authentication contracts.
 *
 * This module declares the canonical types for authentication,
 * identity, session and provider contracts. It contains NO runtime
 * logic and depends only on @mosaix/types.
 */

export type { AuthenticationMethod } from "./authentication-method.js";
export type {
  AuthenticationContext,
  AuthenticationFactor,
} from "./authentication-context.js";
export type { AuthenticatedPrincipal } from "./authenticated-principal.js";
export type { AuthenticationRequest } from "./authentication-request.js";
export type {
  AuthenticationResult,
  AuthRedirect,
  AuthChallenge,
  AuthError,
} from "./authentication-result.js";
export type {
  Identity,
  ExternalIdentity,
  LinkExternalIdentityInput,
} from "./identity.js";
export type { Session } from "./session.js";
export type {
  Credential,
  CredentialType,
  SaveCredentialInput,
} from "./credential.js";
export type {
  AuthenticationProvider,
  VerificationRequest,
  VerificationResult,
  LogoutContext,
  RefreshContext,
  TokenType,
  TokenResult,
} from "./provider.js";
export type {
  AuthEvent,
  AuthEventType,
  AuthenticationSucceededPayload,
  AuthenticationFailedPayload,
  SessionCreatedPayload,
  SessionRevokedPayload,
  IdentityLinkedPayload,
  IdentityUnlinkedPayload,
  PasswordChangedPayload,
  PasswordResetPayload,
  AccountLockedPayload,
  AccountUnlockedPayload,
} from "./auth-events.js";
