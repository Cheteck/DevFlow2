/**
 * @mosaix/contracts — Authentication contracts.
 *
 * This module declares the canonical types for authentication,
 * identity, session and provider contracts. It contains NO runtime
 * logic and depends only on @mosaix/types.
 */

export type { AuthenticationMethod } from "./authentication-method";
export type {
  AuthenticationContext,
  AuthenticationFactor,
} from "./authentication-context";
export type { AuthenticatedPrincipal } from "./authenticated-principal";
export type { AuthenticationRequest } from "./authentication-request";
export type {
  AuthenticationResult,
  AuthRedirect,
  AuthChallenge,
  AuthError,
} from "./authentication-result";
export type {
  Identity,
  ExternalIdentity,
  LinkExternalIdentityInput,
} from "./identity";
export type { Session } from "./session";
export type {
  Credential,
  CredentialType,
  SaveCredentialInput,
} from "./credential";
export type {
  AuthenticationProvider,
  VerificationRequest,
  VerificationResult,
  LogoutContext,
  RefreshContext,
  TokenType,
  TokenResult,
} from "./provider";
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
} from "./auth-events";
