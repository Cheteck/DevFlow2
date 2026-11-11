import type { AuthenticationMethod } from "./authentication-method.js";

export interface AuthenticationFactor {
  type: "password" | "otp" | "webauthn" | "sms" | "email" | "custom";
  verified: boolean;
  timestamp: string;
}

export interface AuthenticationContext {
  provider: string;
  method: AuthenticationMethod;
  authenticatedAt: string;
  assuranceLevel?: string;
  factors?: AuthenticationFactor[];
}
