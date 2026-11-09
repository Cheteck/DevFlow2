/**
 * @mosaix/core — Configuration Loader Tests
 *
 * Tests du socle de configuration centralisée (Lot 1).
 * Lecture seule de process.env via injection — aucun fichier de production
 * n'est modifié par ces tests.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { loadConfig, type ReadonlyAppConfig } from "./config-loader.js";

// Sauvegarde/restauration de process.env entre les tests
const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

function buildEnv(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return { ...overrides };
}

// ─── 1. Variables obligatoires absentes (fail-fast) ───

describe("ConfigLoader — variables obligatoires absentes", () => {
  it("lève une erreur explicite si MOSAIX_AUTH_JWT_SECRET est absent en production", () => {
    const env = buildEnv({
      NODE_ENV: "production",
      MOSAIX_AUTH_JWT_SECRET: undefined,
      MOSAIX_SESSION_SECRET: "a".repeat(32),
    });

    expect(() => loadConfig(env, { isProduction: true })).toThrow(
      /FATAL_SECURITY/,
    );
  });

  it("lève une erreur si le JWT secret fait moins de 32 caractères en production", () => {
    const env = buildEnv({
      NODE_ENV: "production",
      MOSAIX_AUTH_JWT_SECRET: "short",
      MOSAIX_SESSION_SECRET: "a".repeat(32),
    });

    // Zod valide d'abord la longueur minimale (>= 32) avant le fail-fast métier
    expect(() => loadConfig(env, { isProduction: true })).toThrow(
      /Configuration invalide/,
    );
  });

  it("n'échoue pas en développement si le JWT secret est absent", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_AUTH_JWT_SECRET: undefined,
    });

    expect(() => loadConfig(env, { isProduction: false })).not.toThrow();
  });
});

// ─── 2. Valeurs invalides ───

describe("ConfigLoader — valeurs invalides", () => {
  it("rejette un NODE_ENV invalide", () => {
    const env = buildEnv({
      NODE_ENV: "staging" as unknown as string,
    });

    expect(() => loadConfig(env, { isProduction: false })).toThrow(
      /Configuration invalide/,
    );
  });

  it("rejette un MOSAIX_REQUEST_TIMEOUT_MS non numérique", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_REQUEST_TIMEOUT_MS: "abc",
    });

    expect(() => loadConfig(env, { isProduction: false })).toThrow(
      /Configuration invalide/,
    );
  });

  it("rejette un MOSAIX_MAINTENANCE_MODE invalide", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_MAINTENANCE_MODE: "oui",
    });

    expect(() => loadConfig(env, { isProduction: false })).toThrow(
      /Configuration invalide/,
    );
  });
});

// ─── 3. Valeurs facultatives absentes ───

describe("ConfigLoader — valeurs facultatives absentes", () => {
  it("retourne une config valide sans variables optionnelles", () => {
    const env = buildEnv({
      NODE_ENV: "development",
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config).toBeDefined();
    expect(config.env.isDevelopment).toBe(true);
    expect(config.env.isProduction).toBe(false);
    expect(config.env.isTest).toBe(false);
  });

  it("retourne des valeurs undefined pour les secrets absents", () => {
    const env = buildEnv({
      NODE_ENV: "development",
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.security.jwtSecret).toBeUndefined();
    expect(config.security.sessionSecret).toBeUndefined();
  });
});

// ─── 4. Valeurs par défaut ───

describe("ConfigLoader — valeurs par défaut", () => {
  it("applique la valeur par défaut de MOSAIX_DEFAULT_BAC", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_DEFAULT_BAC: undefined,
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.platform.defaultBacId).toBe("solara");
  });

  it("applique la valeur par défaut de MOSAIX_COMPOSITION", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_COMPOSITION: undefined,
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.platform.compositionId).toBe("community-platform");
  });

  it("applique la valeur par défaut de MOSAIX_REQUEST_TIMEOUT_MS", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_REQUEST_TIMEOUT_MS: undefined,
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.platform.requestTimeoutMs).toBe(30000);
  });

  it("applique la valeur par défaut de MOSAIX_DB_CONTAINER", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_DB_CONTAINER: undefined,
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.infrastructure.dbContainer).toBe("mosaix-db-1");
  });
});

// ─── 5. Activation et désactivation conditionnelle d'adaptateurs ───

describe("ConfigLoader — activation/désactivation conditionnelle", () => {
  it("désactive le mode maintenance par défaut", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_MAINTENANCE_MODE: undefined,
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.platform.maintenanceMode).toBe(false);
  });

  it("active le mode maintenance quand MOSAIX_MAINTENANCE_MODE=true", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      MOSAIX_MAINTENANCE_MODE: "true",
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.platform.maintenanceMode).toBe(true);
  });

  it("détecte l'environnement de production via MOSAIX_ENV", () => {
    const env = buildEnv({
      MOSAIX_ENV: "production",
      NODE_ENV: "development",
      MOSAIX_AUTH_JWT_SECRET: "a".repeat(32),
      MOSAIX_SESSION_SECRET: "b".repeat(32),
    });

    const config = loadConfig(env, { isProduction: true });
    expect(config.env.isProduction).toBe(true);
  });

  it("détecte l'environnement de production via NODE_ENV", () => {
    const env = buildEnv({
      MOSAIX_ENV: undefined,
      NODE_ENV: "production",
      MOSAIX_AUTH_JWT_SECRET: "a".repeat(32),
      MOSAIX_SESSION_SECRET: "b".repeat(32),
    });

    const config = loadConfig(env, { isProduction: true });
    expect(config.env.isProduction).toBe(true);
  });
});

// ─── 6. Absence de fuite de secrets ───

describe("ConfigLoader — absence de fuite de secrets", () => {
  it("ne logue pas les secrets en clair", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const env = buildEnv({
      NODE_ENV: "production",
      MOSAIX_AUTH_JWT_SECRET: "a".repeat(32),
      MOSAIX_SESSION_SECRET: "b".repeat(32),
      PSP_WEBHOOK_SECRET: "c".repeat(16),
      SATIM_WEBHOOK_SECRET: "d".repeat(16),
    });

    const config = loadConfig(env, { isProduction: true });

    // Les warnings produits ne doivent pas contenir les valeurs des secrets
    const warnCalls = warnSpy.mock.calls.map((args) => args.join(" "));
    const allWarnings = warnCalls.join(" ");
    expect(allWarnings).not.toContain(config.security.jwtSecret ?? "");
    expect(allWarnings).not.toContain(config.security.sessionSecret ?? "");
    expect(allWarnings).not.toContain(config.security.pspWebhookSecret ?? "");
    expect(allWarnings).not.toContain(config.security.satimWebhookSecret ?? "");

    warnSpy.mockRestore();
  });

  it("ne expose pas la valeur des secrets dans les messages d'erreur", () => {
    const env = buildEnv({
      NODE_ENV: "production",
      MOSAIX_AUTH_JWT_SECRET: undefined,
      MOSAIX_SESSION_SECRET: "a".repeat(32),
    });

    try {
      loadConfig(env, { isProduction: true });
    } catch (error) {
      const message = (error as Error).message;
      // Le message peut mentionner le nom du champ (Zod), mais jamais la valeur secrète
      expect(message).not.toContain("a".repeat(32));
      expect(message).not.toContain("ma-valeur-secrete");
    }
  });
});

// ─── 7. Configuration injectée correctement ───

describe("ConfigLoader — injection correcte", () => {
  it("retourne un objet immuable (Object.freeze)", () => {
    const env = buildEnv({
      NODE_ENV: "development",
    });

    const config = loadConfig(env, { isProduction: false });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.env)).toBe(true);
    expect(Object.isFrozen(config.platform)).toBe(true);
    expect(Object.isFrozen(config.security)).toBe(true);
    expect(Object.isFrozen(config.infrastructure)).toBe(true);
  });

  it("expose toutes les sections attendues", () => {
    const env = buildEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://localhost:5432/test",
      MOSAIX_AUTH_JWT_SECRET: "a".repeat(32),
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.env).toBeDefined();
    expect(config.infrastructure).toBeDefined();
    expect(config.security).toBeDefined();
    expect(config.platform).toBeDefined();
    expect(config.infrastructure.databaseUrl).toBe(
      "postgresql://localhost:5432/test",
    );
    expect(config.security.jwtSecret).toBe("a".repeat(32));
  });
});

// ─── 8. Compatibilité des tests existants ───

describe("ConfigLoader — compatibilité", () => {
  it("fonctionne avec process.env injecté par défaut (aucun argument)", () => {
    // Aucun argument : utilise process.env du processus de test
    expect(() => loadConfig(undefined, { isProduction: false })).not.toThrow();
  });

  it("accepte une source d'environnement custom pour les tests", () => {
    const env = buildEnv({
      NODE_ENV: "test",
      MOSAIX_DEFAULT_BAC: "citadelle",
    });

    const config = loadConfig(env, { isProduction: false });
    expect(config.env.isTest).toBe(true);
    expect(config.platform.defaultBacId).toBe("citadelle");
  });
});

// ─── 9. Démarrage normal de l'application (intégration minimale) ───

describe("ConfigLoader — intégration démarrage", () => {
  it("charge une configuration complète et cohérente", () => {
    const env = buildEnv({
      NODE_ENV: "production",
      MOSAIX_AUTH_JWT_SECRET: "a".repeat(32),
      MOSAIX_SESSION_SECRET: "b".repeat(32),
      DATABASE_URL: "postgresql://user:pass@localhost:5432/mosaix",
      MOSAIX_DEFAULT_BAC: "portfolio",
      MOSAIX_REQUEST_TIMEOUT_MS: "60000",
    });

    const config = loadConfig(env, { isProduction: true });

    expect(config.env.isProduction).toBe(true);
    expect(config.platform.requestTimeoutMs).toBe(60000);
    expect(config.platform.defaultBacId).toBe("portfolio");
    expect(config.infrastructure.databaseUrl).toBe(
      "postgresql://user:pass@localhost:5432/mosaix",
    );
    expect(config.security.jwtSecret).toBe("a".repeat(32));
  });
});
