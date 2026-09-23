import type { AuthenticatedPrincipal } from "./authenticated-principal";
import type { Session } from "./session";

export interface AuthRedirect {
  url: string;
  method?: "GET" | "POST";
  query?: Record<string, string>;
}

export interface AuthChallenge {
  type: "password" | "otp" | "webauthn" | "saml" | "oidc";
  message: string;
  fields?: Array<{
    name: string;
    type: "text" | "password" | "hidden" | "select";
    required?: boolean;
  }>;
  expiresAt?: string;
  data?: Record<string, unknown>;
}

export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AuthenticationResult =
  | {
      status: "authenticated";
      principal: AuthenticatedPrincipal;
      session: Session;
    }
  | {
      status: "redirect";
      redirect: AuthRedirect;
    }
  | {
      status: "challenge";
      challenge: AuthChallenge;
    }
  | {
      status: "failed";
      error: AuthError;
    };
