export const AUTH_EVENT_VERSION = "1.0.0";

export const authenticationSucceededEvent =
  "auth.authentication.succeeded" as const;
export const authenticationFailedEvent = "auth.authentication.failed" as const;
export const sessionCreatedEvent = "auth.session.created" as const;
export const sessionRevokedEvent = "auth.session.revoked" as const;
export const identityLinkedEvent = "auth.identity.linked" as const;
export const identityUnlinkedEvent = "auth.identity.unlinked" as const;
export const passwordChangedEvent = "auth.password.changed" as const;
export const passwordResetEvent = "auth.password.reset" as const;
export const accountLockedEvent = "auth.account.locked" as const;
export const accountUnlockedEvent = "auth.account.unlocked" as const;

export type AuthEventType =
  | typeof authenticationSucceededEvent
  | typeof authenticationFailedEvent
  | typeof sessionCreatedEvent
  | typeof sessionRevokedEvent
  | typeof identityLinkedEvent
  | typeof identityUnlinkedEvent
  | typeof passwordChangedEvent
  | typeof passwordResetEvent
  | typeof accountLockedEvent
  | typeof accountUnlockedEvent;

export interface AuthenticationSucceededPayload {
  identityId: string;
  tenantId: string;
  provider: string;
  method: string;
  sessionId: string;
}

export interface AuthenticationFailedPayload {
  tenantId: string;
  provider: string;
  reason: string;
}

export interface SessionCreatedPayload {
  sessionId: string;
  identityId: string;
  tenantId: string;
}

export interface SessionRevokedPayload {
  sessionId: string;
  identityId: string;
  tenantId: string;
}

export interface IdentityLinkedPayload {
  identityId: string;
  provider: string;
  externalId: string;
}

export interface IdentityUnlinkedPayload {
  identityId: string;
  provider: string;
  externalId: string;
}

export interface PasswordChangedPayload {
  identityId: string;
}

export interface PasswordResetPayload {
  identityId: string;
}

export interface AccountLockedPayload {
  identityId: string;
  reason: string;
}

export interface AccountUnlockedPayload {
  identityId: string;
}

export interface AuthEvent {
  type: AuthEventType;
  version: string;
  payload:
    | AuthenticationSucceededPayload
    | AuthenticationFailedPayload
    | SessionCreatedPayload
    | SessionRevokedPayload
    | IdentityLinkedPayload
    | IdentityUnlinkedPayload
    | PasswordChangedPayload
    | PasswordResetPayload
    | AccountLockedPayload
    | AccountUnlockedPayload;
}
