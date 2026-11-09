/**
 * @apps/citadelle — MFA Guard Middleware
 *
 * Server-side MFA enforcement for protected routes.
 * Never relies on UI-only checks; always verifies server-side.
 *
 * Flow:
 * 1. User authenticates (password valid)
 * 2. If MFA is enabled for the user → 2FA_REQUIRED status, temporary MFA session
 * 3. User submits TOTP code → POST /api/auth/mfa/verify
 * 4. If valid → full session granted, MFA verified flag set
 * 5. Protected routes check MFA verified flag before allowing access
 *
 * Routes that bypass MFA check:
 * - /api/auth/mfa/* (MFA management routes)
 * - /api/auth/login, /api/auth/register (auth entry points)
 * - Public/read-only routes
 */

import type * as http from "node:http";
import type { URL } from "node:url";
import type { MfaService } from "../domain/mfa-service.js";
import type { UserService } from "../domain/user-service.js";
import type { SessionStore } from "@mosaix/ports-session-store";
import { MfaError } from "../domain/mfa-service.js";

export interface MfaGuardContext {
  mfaService: MfaService;
  userService: UserService;
  /** Authenticated user ID from session (may be undefined for anonymous) */
  currentUserId?: string;
  /** Tenant ID */
  tenantId: string;
  /** Routes that bypass MFA enforcement */
  mfaExemptRoutes?: string[];
  /** Session store for checking MFA-verified flag (required in production) */
  sessionStore: SessionStore;
  /** Session ID for the current request (used to look up MFA-verified flag) */
  sessionId?: string;
}

/**
 * Result of MFA guard check
 */
export interface MfaGuardResult {
  /** Whether the request should proceed */
  allowed: boolean;
  /** If not allowed, the HTTP status code */
  statusCode?: number;
  /** If not allowed, the error body */
  body?: unknown;
  /** If MFA is required but not yet verified */
  mfaRequired?: boolean;
}

/**
 * Check if MFA is required and verified for the current request.
 * Returns an MfaGuardResult that the caller uses to decide whether to proceed.
 */
export async function checkMfaGuard(
  pathname: string,
  ctx: MfaGuardContext,
): Promise<MfaGuardResult> {
  // 1. Check if route is exempt from MFA
  const exemptRoutes = ctx.mfaExemptRoutes ?? [
    "/api/auth/mfa/",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/logout",
    "/api/auth/refresh",
    "/api/health",
    "/healthz",
    "/health",
  ];

  for (const exempt of exemptRoutes) {
    if (pathname.startsWith(exempt)) {
      return { allowed: true };
    }
  }

  // 2. No authenticated user → allow (auth routes handle rejection)
  if (!ctx.currentUserId) {
    return { allowed: true };
  }

  // 3. Check if MFA is enabled for this user (scoped by tenant)
  const isEnabled = await ctx.mfaService.isMfaEnabled(ctx.currentUserId, ctx.tenantId);
  if (!isEnabled) {
    return { allowed: true };
  }

  // 4. MFA is enabled but we need to check if verified in this session
  // Session store verification only (no lastVerifiedAt fallback - security requirement).
  // Verify: session exists, identityId matches, session not expired/revoked,
  // and mfaVerified flag is true.
  if (!ctx.sessionStore || !ctx.sessionId || !ctx.currentUserId) {
    return {
      allowed: false,
      statusCode: 403,
      mfaRequired: true,
      body: {
        success: false,
        error: "MFA_SESSION_REQUIRED",
        message: "Session requise pour la verification MFA",
        mfaEnrollmentUrl: "/api/auth/mfa/enroll/totp",
        mfaVerifyUrl: "/api/auth/mfa/verify",
      },
    };
  }

  try {
    const session = await ctx.sessionStore.get(ctx.sessionId);
    if (!session) {
      return {
        allowed: false,
        statusCode: 403,
        mfaRequired: true,
        body: {
          success: false,
          error: "MFA_SESSION_INVALID",
          message: "Session invalide ou expirée",
          mfaEnrollmentUrl: "/api/auth/mfa/enroll/totp",
          mfaVerifyUrl: "/api/auth/mfa/verify",
        },
      };
    }

    // Verify session belongs to the authenticated user
    if (session.identityId !== ctx.currentUserId) {
      return {
        allowed: false,
        statusCode: 403,
        mfaRequired: true,
        body: {
          success: false,
          error: "MFA_SESSION_MISMATCH",
          message: "La session ne correspond pas à l'utilisateur authentifie",
          mfaEnrollmentUrl: "/api/auth/mfa/enroll/totp",
          mfaVerifyUrl: "/api/auth/mfa/verify",
        },
      };
    }

    // Verify session has not expired
    const now = new Date();
    const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;
    if (expiresAt && expiresAt <= now) {
      return {
        allowed: false,
        statusCode: 403,
        mfaRequired: true,
        body: {
          success: false,
          error: "MFA_SESSION_EXPIRED",
          message: "La session a expire",
          mfaEnrollmentUrl: "/api/auth/mfa/enroll/totp",
          mfaVerifyUrl: "/api/auth/mfa/verify",
        },
      };
    }

    // Verify MFA was completed in this session
    if (!session.attributes?.mfaVerified) {
      return {
        allowed: false,
        statusCode: 403,
        mfaRequired: true,
        body: {
          success: false,
          error: "MFA_REQUIRED",
          message: "L'authentification multifactorielle est requise pour accéder à cette ressource",
          mfaEnrollmentUrl: "/api/auth/mfa/enroll/totp",
          mfaVerifyUrl: "/api/auth/mfa/verify",
        },
      };
    }
  } catch {
    // Session store error: fail securely, do not allow access
    return {
      allowed: false,
      statusCode: 403,
      mfaRequired: true,
      body: {
        success: false,
        error: "MFA_SESSION_ERROR",
        message: "Erreur de verification de session. Veuillez reauthentifier.",
        mfaEnrollmentUrl: "/api/auth/mfa/enroll/totp",
        mfaVerifyUrl: "/api/auth/mfa/verify",
      },
    };
  }

  return { allowed: true };
}

/**
 * Express-style middleware wrapper for checkMfaGuard.
 * Use with route handlers that need MFA protection.
 */
export function createMfaGuardMiddleware(ctx: MfaGuardContext) {
  return async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedUrl: URL,
    next: () => Promise<void>,
  ): Promise<void> => {
    const result = await checkMfaGuard(parsedUrl.pathname, ctx);

    if (!result.allowed) {
      res.writeHead(result.statusCode ?? 403, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(result.body));
      return;
    }

    await next();
  };
}
