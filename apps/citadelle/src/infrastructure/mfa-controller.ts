/**
 * @apps/citadelle — MFA Controller
 *
 * HTTP controller for Multi-Factor Authentication routes.
 * Delegates to MfaService for business logic.
 * Follows the same pattern as IdentityController.
 */

import type { HttpRequest, HttpResponse } from "./identity-controller.js";
import type { MfaService } from "../domain/mfa-service.js";
import type { UserService } from "../domain/user-service.js";
import type { AuthManager } from "@mosaix/auth";
import { MfaError } from "../domain/mfa-service.js";

export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly userService: UserService,
    private readonly authManager: AuthManager,
    private readonly tenantId: string,
  ) {}

  // -----------------------------------------------------------------------
  // GET /api/auth/mfa/status — Get MFA status
  // -----------------------------------------------------------------------
  async getStatus(req: HttpRequest): Promise<HttpResponse> {
    const userId = this.extractUserId(req);
    if (!userId) {
      return { statusCode: 401, body: { success: false, error: "UNAUTHENTICATED", message: "Authentification requise" } };
    }

    const isEnabled = await this.mfaService.isMfaEnabled(userId, this.tenantId);
    const state = await this.mfaService.getMfaState(userId, this.tenantId);

    return {
      statusCode: 200,
      body: {
        success: true,
        mfaEnabled: isEnabled,
        factors: state?.factors ?? [],
        enrolledAt: state?.enrolledAt,
        lastVerifiedAt: state?.lastVerifiedAt,
        recoveryCodesRemaining: state?.recoveryCodes.filter((rc) => !rc.used).length ?? 0,
      },
    };
  }

  // -----------------------------------------------------------------------
  // POST /api/auth/mfa/enroll/totp — Start TOTP enrollment
  // -----------------------------------------------------------------------
  async enrollTotp(req: HttpRequest): Promise<HttpResponse> {
    const userId = this.extractUserId(req);
    if (!userId) {
      return { statusCode: 401, body: { success: false, error: "UNAUTHENTICATED", message: "Authentification requise" } };
    }

    const body = req.body as { accountName?: string; issuer?: string } | undefined;
    if (!body?.accountName || !body?.issuer) {
      return { statusCode: 400, body: { success: false, error: "MISSING_PARAMETERS", message: "accountName et issuer requis" } };
    }

    try {
      const result = await this.mfaService.enrollTotp({
        userId,
        tenantId: this.tenantId,
        accountName: body.accountName,
        issuer: body.issuer,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          provisioningUri: result.provisioningUri,
          secret: result.secret,
        },
      };
    } catch (err) {
      if (err instanceof MfaError) {
        return { statusCode: 400, body: { success: false, error: err.code, message: err.message } };
      }
      return { statusCode: 500, body: { success: false, error: "INTERNAL_ERROR", message: "Erreur lors de l'inscription TOTP" } };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/auth/mfa/enroll/totp/verify — Complete enrollment
  // -----------------------------------------------------------------------
  async completeEnrollment(req: HttpRequest): Promise<HttpResponse> {
    const userId = this.extractUserId(req);
    if (!userId) {
      return { statusCode: 401, body: { success: false, error: "UNAUTHENTICATED", message: "Authentification requise" } };
    }

    const body = req.body as { code?: string; secret?: string } | undefined;
    if (!body?.code || !body?.secret) {
      return { statusCode: 400, body: { success: false, error: "MISSING_PARAMETERS", message: "code et secret requis" } };
    }

    try {
      const result = await this.mfaService.completeTotpEnrollment({
        userId,
        tenantId: this.tenantId,
        code: body.code,
        secret: body.secret,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          message: "MFA activée avec succès",
          recoveryCodes: result.recoveryCodes,
        },
      };
    } catch (err) {
      if (err instanceof MfaError) {
        return { statusCode: 400, body: { success: false, error: err.code, message: err.message } };
      }
      return { statusCode: 500, body: { success: false, error: "INTERNAL_ERROR", message: "Erreur lors de l'activation MFA" } };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/auth/mfa/verify — Verify TOTP during login challenge
  // -----------------------------------------------------------------------
  async verifyTotp(req: HttpRequest): Promise<HttpResponse> {
    const body = req.body as { userId?: string; code?: string; tenantId?: string } | undefined;
    if (!body?.userId || !body?.code) {
      return { statusCode: 400, body: { success: false, error: "MISSING_PARAMETERS", message: "userId et code requis" } };
    }

    try {
      await this.mfaService.verifyTotpLogin({
        userId: body.userId,
        tenantId: body.tenantId ?? this.tenantId,
        code: body.code,
      });

      // Create a session after successful MFA verification
      const session = await this.authManager.createSession(body.userId, body.tenantId ?? this.tenantId, {
        mfaVerified: true,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          message: "Vérification MFA réussie",
          mfaVerified: true,
          token: session.id,
          session,
        },
      };
    } catch (err) {
      if (err instanceof MfaError) {
        return { statusCode: 401, body: { success: false, error: err.code, message: err.message } };
      }
      return { statusCode: 500, body: { success: false, error: "INTERNAL_ERROR", message: "Erreur lors de la vérification MFA" } };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/auth/mfa/verify/recovery — Verify recovery code
  // -----------------------------------------------------------------------
  async verifyRecovery(req: HttpRequest): Promise<HttpResponse> {
    const userId = this.extractUserId(req);
    if (!userId) {
      return { statusCode: 401, body: { success: false, error: "UNAUTHENTICATED", message: "Authentification requise" } };
    }

    const body = req.body as { code?: string } | undefined;
    if (!body?.code) {
      return { statusCode: 400, body: { success: false, error: "MISSING_PARAMETERS", message: "code requis" } };
    }

    try {
      await this.mfaService.verifyRecoveryCode({
        userId,
        tenantId: this.tenantId,
        code: body.code,
      });

      return {
        statusCode: 200,
        body: { success: true, message: "Code de récupération validé", mfaVerified: true },
      };
    } catch (err) {
      if (err instanceof MfaError) {
        return { statusCode: 401, body: { success: false, error: err.code, message: err.message } };
      }
      return { statusCode: 500, body: { success: false, error: "INTERNAL_ERROR", message: "Erreur lors de la vérification du code de récupération" } };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/auth/mfa/disable — Disable MFA
  // -----------------------------------------------------------------------
  async disableMfa(req: HttpRequest): Promise<HttpResponse> {
    const userId = this.extractUserId(req);
    if (!userId) {
      return { statusCode: 401, body: { success: false, error: "UNAUTHENTICATED", message: "Authentification requise" } };
    }

    const body = req.body as { totpCode?: string } | undefined;
    if (!body?.totpCode) {
      return { statusCode: 400, body: { success: false, error: "MISSING_PARAMETERS", message: "totpCode requis" } };
    }

    try {
      await this.mfaService.disableMfa({
        userId,
        tenantId: this.tenantId,
        totpCode: body.totpCode,
      });

      return {
        statusCode: 200,
        body: { success: true, message: "MFA désactivée" },
      };
    } catch (err) {
      if (err instanceof MfaError) {
        return { statusCode: 400, body: { success: false, error: err.code, message: err.message } };
      }
      return { statusCode: 500, body: { success: false, error: "INTERNAL_ERROR", message: "Erreur lors de la désactivation MFA" } };
    }
  }

  // -----------------------------------------------------------------------
  // POST /api/auth/mfa/recovery/regenerate — Regenerate recovery codes
  // -----------------------------------------------------------------------
  async regenerateRecovery(req: HttpRequest): Promise<HttpResponse> {
    const userId = this.extractUserId(req);
    if (!userId) {
      return { statusCode: 401, body: { success: false, error: "UNAUTHENTICATED", message: "Authentification requise" } };
    }

    const body = req.body as { totpCode?: string } | undefined;
    if (!body?.totpCode) {
      return { statusCode: 400, body: { success: false, error: "MISSING_PARAMETERS", message: "totpCode requis" } };
    }

    try {
      const result = await this.mfaService.regenerateRecoveryCodes({
        userId,
        tenantId: this.tenantId,
        totpCode: body.totpCode,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          message: "Codes de régénération générés",
          recoveryCodes: result.recoveryCodes,
        },
      };
    } catch (err) {
      if (err instanceof MfaError) {
        return { statusCode: 400, body: { success: false, error: err.code, message: err.message } };
      }
      return { statusCode: 500, body: { success: false, error: "INTERNAL_ERROR", message: "Erreur lors de la régénération des codes" } };
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private extractUserId(req: HttpRequest): string | undefined {
    const headerId = req.headers?.["x-user-id"];
    if (typeof headerId === "string") return headerId;
    return (req.body as { userId?: string } | undefined)?.userId;
  }
}
