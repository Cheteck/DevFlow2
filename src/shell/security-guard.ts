/**
 * @mosaix/shell — Production Security Guard
 *
 * Enforces cryptographic secret entropy and fail-fast checks in production.
 *
 * Migration Lot 2 / Étape 1 — Configuration centralisée (ConfigService).
 * Cette classe reçoit désormais sa configuration via le constructeur
 * (injection explicite, pas de singleton global, aucun accès direct à
 * `process.env` lorsqu'une configuration est fournie).
 *
 * Un constructeur sans argument conserve la lecture de `process.env` pour
 * la rétrocompatibilité pendant la migration lot par lot des 41 fichiers
 * restants. Une fois tous les appelants migrés, ce fallback pourra être
 * supprimé.
 */

import type { ReadonlyAppConfig } from "@mosaix/core";

export class SecurityGuard {
  private readonly config: ReadonlyAppConfig | undefined;

  constructor(config?: ReadonlyAppConfig) {
    this.config = config;
  }

  /**
   * Production is detected via either flag (S-05): MOSAIX_ENV is canonical,
   * NODE_ENV is the legacy alias. Both are accepted by validateEnv().
   *
   * Préfère la valeur de la configuration centralisée lorsqu'elle est
   * disponible, sinon retourne sur `process.env` (rétrocompatibilité).
   */
  isProductionEnvironment(): boolean {
    if (this.config?.env?.isProduction !== undefined) {
      return this.config.env.isProduction;
    }
    const source = process.env as Record<string, string | undefined>;
    return (
      (source.MOSAIX_ENV ?? source.NODE_ENV ?? "development") === "production"
    );
  }

  static isProductionEnvironment(
    source: Record<string, string | undefined> = process.env as Record<
      string,
      string | undefined
    >,
  ): boolean {
    return (
      (source.MOSAIX_ENV ?? source.NODE_ENV ?? "development") === "production"
    );
  }

  /**
   * Valide l'environnement de production et retourne les erreurs / avertissements.
   *
   * Les secrets sont lus depuis la configuration centralisée lorsqu'elle est
   * disponible, sinon depuis `process.env` (rétrocompatibilité).
   */
  validateEnvironment(): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const isProduction = this.isProductionEnvironment();
    const warnings: string[] = [];
    const errors: string[] = [];

    const jwtSecret =
      this.config?.security?.jwtSecret ??
      process.env.MOSAIX_AUTH_JWT_SECRET ??
      process.env.JWT_SECRET;
    const sessionSecret =
      this.config?.security?.sessionSecret ?? process.env.MOSAIX_SESSION_SECRET;

    if (isProduction) {
      if (
        !jwtSecret ||
        jwtSecret.length < 32 ||
        jwtSecret.includes("dev-secret") ||
        jwtSecret.includes("secret123")
      ) {
        errors.push(
          "FATAL_SECURITY: Production JWT secret is missing, insecure or has insufficient entropy (< 256 bits).",
        );
      }
      if (!sessionSecret || sessionSecret.length < 32) {
        warnings.push(
          "SECURITY_WARN: Session secret should have at least 32 characters in production.",
        );
      }
    } else {
      if (!jwtSecret) {
        warnings.push(
          "DEV_NOTICE: Using fallback development JWT secret. Do not use in production.",
        );
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  static validateEnvironment(
    source: Record<string, string | undefined> = process.env as Record<
      string,
      string | undefined
    >,
  ): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const isProduction = SecurityGuard.isProductionEnvironment(source);
    const warnings: string[] = [];
    const errors: string[] = [];

    const jwtSecret =
      source.MOSAIX_AUTH_JWT_SECRET ?? source.JWT_SECRET;
    const sessionSecret = source.MOSAIX_SESSION_SECRET;

    if (isProduction) {
      if (
        !jwtSecret ||
        jwtSecret.length < 32 ||
        jwtSecret.includes("dev-secret") ||
        jwtSecret.includes("secret123")
      ) {
        errors.push(
          "FATAL_SECURITY: Production JWT secret is missing, insecure or has insufficient entropy (< 256 bits).",
        );
      }
      if (!sessionSecret || sessionSecret.length < 32) {
        warnings.push(
          "SECURITY_WARN: Session secret should have at least 32 characters in production.",
        );
      }
    } else {
      if (!jwtSecret) {
        warnings.push(
          "DEV_NOTICE: Using fallback development JWT secret. Do not use in production.",
        );
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Applique les contraintes de production. Lance une erreur si la validation
   * échoue en production.
   *
   * Utilise la configuration centralisée de l'instance lorsqu'elle est
   * disponible, sinon retourne sur `process.env`.
   */
  enforceProductionConstraints(): void {
    const check = this.validateEnvironment();
    if (!check.valid) {
      const errorMsg = `[SECURITY BREACH PREVENTION] Cannot start server:\n${check.errors.join("\n")}`;
      console.error(errorMsg);
      if (this.isProductionEnvironment()) {
        throw new Error(errorMsg);
      }
    }
    for (const w of check.warnings) {
      console.warn(`[SecurityGuard] ${w}`);
    }
  }

  static enforceProductionConstraints(): void {
    const guard = new SecurityGuard();
    guard.enforceProductionConstraints();
  }
}
