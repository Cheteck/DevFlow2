import type { AuthenticationRequest } from "./authentication-request";
import type { AuthenticationResult } from "./authentication-result";

export interface VerificationRequest {
  sessionId: string;
  tenantId: string;
  factor: Record<string, unknown>;
}

export interface VerificationResult {
  valid: boolean;
  principal?: import("./authenticated-principal").AuthenticatedPrincipal;
}

export interface LogoutContext {
  sessionId: string;
  tenantId: string;
}

export interface RefreshContext {
  sessionId: string;
  tenantId: string;
  refreshToken: string;
}

export type TokenType = "access" | "refresh" | "id" | "opaque";

export interface TokenResult {
  accessToken: string;
  tokenType: TokenType;
  expiresIn?: number;
  refreshToken?: string;
}

export interface AuthenticationProvider {
  readonly id: string;
  readonly capabilities: string[];

  authenticate(request: AuthenticationRequest): Promise<AuthenticationResult>;

  verify?(request: VerificationRequest): Promise<VerificationResult>;

  logout?(context: LogoutContext): Promise<void>;

  refresh?(context: RefreshContext): Promise<TokenResult>;
}
