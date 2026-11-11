/**
 * @mosaix/auth — Social Auth Service Tests (Lot 2 / Étape 2)
 *
 * Tests de la migration de SocialAuthService vers ConfigService.
 * Couvre : injection de configuration, priorité de appConfig,
 * secrets obligatoires absents, fournisseurs désactivés/activés,
 * absence de fuite de secrets.
 */

import { describe, it, expect } from "vitest";
import { SocialAuthService } from "./social-auth-service.js";
import type { ReadonlyAppConfig } from "@mosaix/core";

// ─── Helpers ──────────────────────────────────────────────────────────

function buildConfig(oauth: Record<string, string>): ReadonlyAppConfig {
  return {
    env: { nodeEnv: "development", isProduction: false, isDevelopment: true, isTest: false },
    infrastructure: {},
    security: { jwtSecret: undefined, sessionSecret: undefined, pspWebhookSecret: undefined, satimWebhookSecret: undefined, oauth },
    platform: { defaultBacId: "solara", compositionId: "community-platform", maintenanceMode: false, requestTimeoutMs: 30000 },
  } as ReadonlyAppConfig;
}

// ─── 1. Injection de configuration ──────────────────────────────────

describe("SocialAuthService — configuration injection", () => {
  it("lit les secrets OAuth depuis la config injectée (priorité appConfig)", () => {
    const config: ReadonlyAppConfig = {
      env: { nodeEnv: "development", isProduction: false, isDevelopment: true, isTest: false },
      infrastructure: {},
      security: {
        jwtSecret: undefined,
        sessionSecret: undefined,
        pspWebhookSecret: undefined,
        satimWebhookSecret: undefined,
        oauth: { GOOGLE_CLIENT_ID: "injected-google-client-id", GOOGLE_CLIENT_SECRET: "injected-google-secret" },
      },
      platform: { defaultBacId: "solara", compositionId: "community-platform", maintenanceMode: false, requestTimeoutMs: 30000 },
    };

    const service = new SocialAuthService({}, config);
    const provider = service.getProvider("google");

    expect(provider).toBeDefined();
    expect(provider.isEnabled).toBe(true);
    expect((provider.config as { clientId?: string }).clientId).toBe("injected-google-client-id");
  });

  it("désactive un fournisseur quand aucun clientId n'est présent", () => {
    const config = buildConfig({}); // aucun secret OAuth

    const service = new SocialAuthService({}, config);
    const provider = service.getProvider("google");

    expect(provider).toBeDefined();
    expect(provider.isEnabled).toBe(false);
  });

  it("rejette un fournisseur activé sans clientSecret (fournisseur activé, secret absent)", () => {
    const config = buildConfig({
      GOOGLE_CLIENT_ID: "present-client-id",
      // GOOGLE_CLIENT_SECRET absent
    });

    expect(() => new SocialAuthService({}, config)).toThrow(
      /clientSecret is missing/,
    );
  });

  it("n'échoue pas quand un fournisseur est désactivé (pas de clientId)", () => {
    const config = buildConfig({
      // aucun secret OAuth
    });

    expect(() => new SocialAuthService({}, config)).not.toThrow();
    const service = new SocialAuthService({}, config);
    const provider = service.getProvider("google");
    expect(provider.isEnabled).toBe(false);
  });
});

// ─── 2. Priorité de appConfig sur process.env ───────────────────────

describe("SocialAuthService — priorité de appConfig", () => {
  it("la config injectée l'emporte sur process.env", () => {
    const origEnv = process.env.GOOGLE_CLIENT_ID;
    const origSecret = process.env.GOOGLE_CLIENT_SECRET;

    try {
      // process.env dit un clientId différent
      process.env.GOOGLE_CLIENT_ID = "env-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "env-secret";

      // config injectée dit un autre clientId
      const config = buildConfig({
        GOOGLE_CLIENT_ID: "injected-client-id",
        GOOGLE_CLIENT_SECRET: "injected-secret",
      });

      const service = new SocialAuthService({}, config);
      const provider = service.getProvider("google");

      expect((provider.config as { clientId?: string }).clientId).toBe("injected-client-id");
      expect((provider.config as { clientId?: string }).clientId).not.toBe("env-client-id");
    } finally {
      process.env.GOOGLE_CLIENT_ID = origEnv;
      process.env.GOOGLE_CLIENT_SECRET = origSecret;
    }
  });
});

// ─── 3. Absence de fuite de secrets ─────────────────────────────────

describe("SocialAuthService — absence de fuite de secrets", () => {
  it("ne contient pas les valeurs secrètes dans les messages d'erreur", () => {
    const secretValue = "super-secret-client-secret-value-12345";
    const config = buildConfig({
      GOOGLE_CLIENT_ID: "present-client-id",
      GOOGLE_CLIENT_SECRET: secretValue,
    });

    // Cas valide : pas d'erreur
    const service = new SocialAuthService({}, config);
    expect(service.getProvider("google").enabled).toBe(true);

    // Cas invalide : clientId présent, secret absent → erreur sans révéler de valeur
    const configNoSecret = buildConfig({
      GOOGLE_CLIENT_ID: "present-client-id",
      // GOOGLE_CLIENT_SECRET absent
    });

    try {
      new SocialAuthService({}, configNoSecret);
      throw new Error("aurait dû lever une exception");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(secretValue);
      expect(message).toContain("clientSecret is missing");
    }
  });
});

// ─── 4. Non-régression : fallback process.env quand pas de config ───

describe("SocialAuthService — rétrocompatibilité (fallback process.env)", () => {
  it("fonctionne sans config injectée (utilise process.env)", () => {
    const origEnv = process.env.GOOGLE_CLIENT_ID;
    const origSecret = process.env.GOOGLE_CLIENT_SECRET;

    try {
      process.env.GOOGLE_CLIENT_ID = "env-only-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "env-only-secret";

      const service = new SocialAuthService(); // aucune config
      const provider = service.getProvider("google");

      expect(provider.isEnabled).toBe(true);
      expect((provider.config as { clientId?: string }).clientId).toBe("env-only-client-id");
    } finally {
      process.env.GOOGLE_CLIENT_ID = origEnv;
      process.env.GOOGLE_CLIENT_SECRET = origSecret;
    }
  });

  it("liste les providers activés/désactivés selon les secrets présents", () => {
    const config = buildConfig({
      GOOGLE_CLIENT_ID: "present-id",
      GOOGLE_CLIENT_SECRET: "present-secret",
      // pas de secret Facebook → désactivé
    });

    const service = new SocialAuthService({}, config);
    const providers = service.listProviders();

    const google = providers.find((p) => p.id === "google");
    const facebook = providers.find((p) => p.id === "facebook");

    expect(google?.enabled).toBe(true);
    expect(facebook?.enabled).toBe(false);
  });
});
