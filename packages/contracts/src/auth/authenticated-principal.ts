import type { AuthenticationContext } from "./authentication-context";

export interface AuthenticatedPrincipal {
  subject: string;
  tenantId: string;
  identityId: string;
  authentication: AuthenticationContext;
  attributes: Record<string, unknown>;
}
