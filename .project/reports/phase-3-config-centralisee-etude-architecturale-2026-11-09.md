# Phase 3 — Étude architecturale : Configuration centralisée MosaiX

**Date :** 2026-11-09  
**Statut :** Étude uniquement — Lecture seule (aucun changement de code, aucune migration, aucune modification de base de données)  
**Source de l'inventaire :** `git grep -l -e 'process\.env\.'` → 42 fichiers, ~150 lignes d'accès  
**Mandat :** Étude architecturale hybride (config/ + base de données + variables d'environnement) selon recommandation ChatGPT Phase 3

---

## 1. Architecture cible (architecture hybride)

### Principe général

Trois sources de configuration coexistent avec une **priorité stricte par catégorie** :

| Source | Rôle | Exemples de variables |
|--------|------|----------------------|
| **Config statique** (`config/`) | Valeurs par défaut, schémas, politiques, configuration des modules | `MOSAIX_DEFAULT_BAC`, `REQUEST_TIMEOUT_MS`, `CORS_ALLOWED_ORIGINS` (défaut) |
| **Base de données** | Paramètres fonctionnels dynamiques, modifiables par les administrateurs, BAC, tenant | `maintenance.enabled`, `feature.flag.x`, `bac.settings.*`, `tenant.settings.*` |
| **Variables d'environnement / Secret Manager** | Secrets, identifiants, paramètres d'infrastructure | `DATABASE_URL`, `JWT_SECRET`, `OAuth secrets`, `PSP_WEBHOOK_SECRET`, `REDIS_URL` |

### Règle de priorité (par catégorie, pas globalement)

Pour une donnée donnée, la priorité est :

```
1. ENV / Secret Manager  → secrets et infrastructure uniquement (jamais surchargé par la DB)
2. Database              → paramètres fonctionnels dynamiques
3. Environnement (config/) → valeurs propres à l'environnement (dev/test/prod)
4. Static defaults         → valeurs par défaut du code
```

**Règle non négociable :** une valeur en base de données ne doit JAMAIS pouvoir remplacer un secret ou une URL de connexion à la base de données.

### Schéma conceptuel

```
Configuration globale
        │
        ▼
Configuration environnement (dev/test/prod)
        │
        ▼
Configuration BAC (par bounded context)
        │
        ▼
Configuration tenant (par tenant)
        │
        ▼
Configuration effective (résolution finale)
```

---

## 2. Structure des dossiers proposée

Conforme à la recommandation ChatGPT, adaptée au monorepo MosaiX existant.

```
mosaix/
│
├── config/
│   ├── index.ts                      # Point d'entrée unique (ConfigService facade)
│   ├── schema.ts                     # Schémas Zod de validation
│   ├── defaults.ts                   # Valeurs par défaut statiques
│   │
│   ├── environments/
│   │   ├── development.ts
│   │   ├── test.ts
│   │   └── production.ts
│   │
│   ├── infrastructure/
│   │   ├── database.config.ts        # DATABASE_URL, REDIS_URL, MOSAIX_DB_CONTAINER
│   │   ├── redis.config.ts
│   │   └── server.config.ts        # MOSAIX_REQUEST_TIMEOUT_MS, NODE_ENV, PORT
│   │
│   ├── security/
│   │   ├── auth.config.ts          # JWT_SECRET, SESSION_SECRET, MOSAIX_AUTH_JWT_SECRET
│   │   ├── cors.config.ts          # CORS_ALLOWED_ORIGINS, TRUST_PROXY
│   │   └── oauth.config.ts         # OAuth secrets (GOOGLE, APPLE, MICROSOFT, GITHUB, FACEBOOK)
│   │
│   ├── platform/
│   │   ├── platform.config.ts      # MOSAIX_DEFAULT_BAC, MOSAIX_COMPOSITION, MOSAIX_MAINTENANCE_MODE
│   │   ├── bac.config.ts           # Configuration par BAC
│   │   └── composition.config.ts
│   │
│   ├── modules/
│   │   ├── commerce.config.ts      # SATIM_GATEWAY_URL, SATIM_TERMINAL_ID, MOSAIX_PUBLIC_BASE_URL, SATIM_WEBHOOK_SECRET
│   │   ├── payments.config.ts      # PSP_WEBHOOK_SECRET
│   │   ├── maintenance.config.ts   # Maintenance mode
│   │   └── social-auth.config.ts   # OAuth provider configs
│   │
│   └── README.md
│
├── packages/
│   └── core/
│       └── src/
│           └── config/
│               ├── config.service.ts     # ConfigService (résolution, validation, injection)
│               ├── config.provider.ts    # Fournisseur de configuration (injection de dépendances)
│               ├── config.repository.ts  # Accès à la config persistée (DB)
│               ├── config-cache.ts       # Cache + invalidation
│               └── config-resolver.ts    # Règles de priorité ENV > DB > env-config > defaults
│
├── database/
│   └── migrations/
│       └── (à créer : tables de configuration dynamique)
│
├── .env
├── .env.example
└── ...
```

### Compatibilité avec le monorepo existant

- Le dossier `config/` est nouveau à la racine, cohérent avec la structure `apps/`, `packages/`, `src/`, `scripts/`, `tests/`.
- La logique de résolution réside dans `packages/core/src/config/` (convention actuelle : le framework vit dans `packages/core`).
- Aucun fichier de production existant n'est modifié durant cette phase d'étude.

---

## 3. Classification exhaustive des 42 fichiers et variables d'environnement

L'inventaire ci-dessous reprend les 42 fichiers détectés par `git grep -l`. Les tests (lecture/écriture de `process.env` pour setup/teardown) sont identifiés séparément car ils ne constituent pas de configuration de production.

### 3.1 Variables par catégorie

#### A. Secrets et identifiants (destination : ENV / Secret Manager)

| Variable | Fichier(s) | Ligne(s) | Sensibilité | Justification |
|----------|-----------|----------|-------------|---------------|
| `MOSAIX_AUTH_JWT_SECRET` | `src/shell/security-guard.ts` | 32 | Critique (JWT) | Secret de signature JWT |
| `JWT_SECRET` | `src/shell/security-guard.ts` | 32 | Critique (JWT) | Alias legacy JWT |
| `MOSAIX_SESSION_SECRET` | `src/shell/security-guard.ts` | 33 | Critique (session) | Secret de session |
| `MCP_AUTH_TOKEN` | `packages/mcp/src/stdio-server.ts` | 195-196 | Critique (MCP) | Token d'authentification MCP |
| `PSP_WEBHOOK_SECRET` | `src/shell/psp-webhook-handler.ts` | 125 | Critique (paiement) | Secret webhook PSP |
| `SATIM_WEBHOOK_SECRET` | `apps/commerce/src/domain/satim-payment-port.ts` | 45 | Critique (paiement) | Secret webhook SATIM |
| `SATIM_GATEWAY_URL` | `apps/commerce/src/domain/satim-payment-port.ts` | 41 | Interne (URL paiement) | URL passerelle SATIM CIB |
| `SATIM_TERMINAL_ID` | `apps/commerce/src/domain/satim-payment-port.ts` | 42 | Interne (paiement) | Identifiant terminal SATIM |
| `GOOGLE_CLIENT_ID / SECRET` | `packages/auth/src/oauth/social-auth-service.ts` | 62-63 | Critique (OAuth) | OAuth Google |
| `APPLE_CLIENT_ID / SECRET / TEAM_ID / KEY_ID / PRIVATE_KEY` | `packages/auth/src/oauth/social-auth-service.ts` | 67-71 | Critique (OAuth) | OAuth Apple (inclut clé privée) |
| `MICROSOFT_CLIENT_ID / SECRET / TENANT` | `packages/auth/src/oauth/social-auth-service.ts` | 75-77 | Critique (OAuth) | OAuth Microsoft |
| `GITHUB_CLIENT_ID / SECRET` | `packages/auth/src/oauth/social-auth-service.ts` | 81-82 | Critique (OAuth) | OAuth GitHub |
| `FACEBOOK_CLIENT_ID / SECRET` | `packages/auth/src/oauth/social-auth-service.ts` | 85-86 | Critique (OAuth) | OAuth Facebook |
| `TYPESAFE_API_KEY` | `packages/adapters/intelligence-typesafe/src/index.ts` | 22 | Interne (API) | Clé API intelligence |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `scripts/init-dev-admin.ts` | 38-39 | Critique (setup) | Admin initial (setup uniquement) |
| `MOSAIX_DATABASE_URL` / `DATABASE_URL` | `scripts/seed-commerce-offers.ts`, `scripts/seed-jijel-spaces.ts` | 37-38, 151 | Interne (DB) | URL de connexion DB (scripts de seed) |
| `MOSAIX_TEST_DATABASE_URL` | `src/test/e2e-test-helpers.ts` | 28 | Interne (DB test) | URL DB de test (tests uniquement) |

#### B. Paramètres d'infrastructure (destination : ENV)

| Variable | Fichier(s) | Ligne(s) | Sensibilité | Justification |
|----------|-----------|----------|-------------|---------------|
| `MOSAIX_DB_CONTAINER` | `scripts/db-backup.ts`, `tests/production/backup-restore.e2e.test.ts` | 69/196, 17/30 | Interne (infra) | Nom conteneur Docker DB |
| `MOSAIX_REDIS_URL` / `REDIS_URL` | `src/server/api-dispatcher.ts` | 234 | Interne (infra) | URL Redis (cache) |
| `MOSAIX_NODE_ID` / `HOSTNAME` | `src/shell/event-backplane.ts` | 31-33 | Interne (infra) | Identifiant nœud événementiel |
| `PORT` / `APP_PORT` | `packages/core/src/env/env.test.ts` | 21, 64 | Interne (serveur) | Port HTTP (tests) |

#### C. Détection environnement (destination : ENV / Runtime)

| Variable | Fichier(s) | Ligne(s) | Sensibilité | Justification |
|----------|-----------|----------|-------------|---------------|
| `NODE_ENV` | `src/server/api-dispatcher.ts`, `packages/core/src/platform-settings.ts`, `packages/support/src/in-memory-guard.ts`, `apps/citadelle/src/index.ts`, `tests/*` | 213, 12, 12, 217, 60/64/69/132/134/138/42/47/50/55/59/65 | Basse (runtime) | Détection environnement |
| `MOSAIX_ENV` | `src/server/api-dispatcher.ts`, `packages/core/src/platform-settings.ts`, `packages/support/src/in-memory-guard.ts` | 213, 12, 12 | Basse (runtime) | Alias canonique environnement |
| `CI` | `scripts/key-check.ts`, `scripts/install.ts`, `scripts/key-generate.ts`, `packages/command-center/src/supervisor.ts`, `packages/command-center/src/theme.ts`, `packages/command-center/src/terminal-renderer.ts`, `tests/*` | 13, 14, 13, 169, 27, 40, 60/63/65/66/76 | Basse (CI) | Détection CI |
| `DEBUG` | `apps/citadelle/src/infrastructure/console-logger-adapter.ts`, `apps/citadelle/src/infrastructure/in-memory-otp-delivery.ts` | 18, 21 | Basse (debug) | Logs de debug |

#### C. Configuration plateforme (destination : config/ + DB override éventuel)

| Variable | Fichier(s) | Ligne(s) | Sensibilité | Justification |
|----------|-----------|----------|-------------|---------------|
| `MOSAIX_DEFAULT_BAC` | `packages/core/src/platform-settings.ts` | 16 | Basse (plateforme) | BAC par défaut |
| `MOSAIX_COMPOSITION` | `src/shell/composition-loader.ts` | 24 | Basse (plateforme) | Composition active |
| `MOSAIX_MAINTENANCE_MODE` | `packages/core/src/modules/maintenance-module.ts` | 21 | Basse (plateforme) | Mode maintenance |
| `MOSAIX_REQUEST_TIMEOUT_MS` | `src/start.ts` | 91 | Basse (plateforme) | Timeout requête HTTP |

#### D. Sécurité réseau (destination : config/ + ENV)

| Variable | Fichier(s) | Ligne(s) | Sensibilité | Justification |
|----------|-----------|----------|-------------|---------------|
| `TRUST_PROXY` / `MOSAIX_TRUST_PROXY` | `src/shell/rate-limiter.ts`, `packages/gateway/src/gateway.ts` | 54-55, 106 | Interne (sécurité) | Proxy de confiance (IP spoofing) |
| `CORS_ALLOWED_ORIGINS` | `packages/http/src/http.ts` | 138-140 | Interne (sécurité) | Origines CORS autorisées |

#### E. Runtime terminal / affichage (destination : ENV / Runtime, pas de config métier)

| Variable | Fichier(s) | Ligne(s) | Sensibilité | Justification |
|----------|-----------|----------|-------------|---------------|
| `NO_TUI` | `packages/command-center/src/supervisor.ts`, `packages/command-center/src/terminal-renderer.ts`, `scripts/dev.ts` | 168, 39, 21 | Basse (runtime) | Désactiver TUI |
| `NO_COLOR` | `packages/command-center/src/theme.ts` | 26 | Basse (runtime) | Désactiver couleur |
| `TERM`, `WT_SESSION`, `ANSICON`, `ConEmuANSI`, `TERM_PROGRAM` | `packages/command-center/src/terminal-renderer.ts` | 41, 46-49 | Basse (runtime) | Détection terminal |
| `VITEST`, `MOSAIX_DEV_NO_EXIT` | `packages/command-center/src/supervisor.ts` | 707 | Basse (runtime) | Contrôle sortie processus |

#### D. Variables de test (uniquement dans les fichiers de test)

Ces fichiers manipulent `process.env` pour le setup/teardown des tests. Ils relèvent de la configuration de test, pas de la configuration de production.

| Fichier | Variables manipulées |
|---------|---------------------|
| `packages/core/src/env/env.test.ts` | `PORT`, `NODE_ENV`, `APP_PORT`, `REQUIRED_VAR` |
| `packages/core/src/env/env.schema.test.ts` | `MOSAIX_TEST_A/B/C` |
| `packages/support/src/in-memory-guard.test.ts` | `NODE_ENV`, `MOSAIX_ENV`, `MOSAIX_DEMO_USERS`, `ALLOW_IN_MEMORY_IN_PRODUCTION` |
| `packages/command-center/src/terminal-renderer.test.ts` | `CI`, `NO_TUI`, `TERM` |
| `src/shell/profiles.test.ts` | `MOSAIX_DEMO_USERS`, `MOSAIX_ENV`, `NODE_ENV` |
| `src/shell/seeders/database-seeder.test.ts` | `MOSAIX_DEMO_USERS` |
| `tests/auth-routes.test.ts` | `NODE_ENV`, `MOSAIX_DEMO_USERS` |
| `tests/security-shell-boundaries.test.ts` | `NODE_ENV`, `MOSAIX_AUTH_JWT_SECRET` |
| `tests/production/in-memory-guard.e2e.test.ts` | `NODE_ENV`, `MOSAIX_DEMO_USERS`, `ALLOW_IN_MEMORY_IN_PRODUCTION` |
| `tests/production/backup-restore.e2e.test.ts` | `MOSAIX_DB_CONTAINER` |
| `tests/http/bac-access.http.test.ts` | `MOSAIX_HTTP_SOURCE_DB` |

---

## 4. Contrats TypeScript proposés

### 4.1 Schémas de validation (Zod)

```typescript
// config/schema.ts
import { z } from "zod";

// Schéma d'environnement (lecture unique au démarrage, fail-fast)
export const EnvSchema = z.object({
  // Infrastructure
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  MOSAIX_DB_CONTAINER: z.string().optional(),
  
  // Secrets (obligatoires en production)
  MOSAIX_AUTH_JWT_SECRET: z.string().min(32).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  MOSAIX_SESSION_SECRET: z.string().min(32).optional(),
  PSP_WEBHOOK_SECRET: z.string().min(16).optional(),
  SATIM_WEBHOOK_SECRET: z.string().min(16).optional(),
  
  // OAuth (optionnels, désactivent le provider si absents)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  
  // Environnement
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MOSAIX_ENV: z.enum(["development", "test", "production"]).optional(),
  CI: z.string().optional(),
  
  // Infrastructure
  TRUST_PROXY: z.union([z.literal("true"), z.literal("false")]).optional(),
  MOSAIX_TRUST_PROXY: z.union([z.literal("true"), z.literal("false")]).optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  MOSAIX_REDIS_URL: z.string().url().optional(),
  MOSAIX_NODE_ID: z.string().optional(),
  
  // Platform
  MOSAIX_DEFAULT_BAC: z.string().default("solara"),
  MOSAIX_COMPOSITION: z.string().default("community-platform"),
  MOSAIX_MAINTENANCE_MODE: z.union([z.literal("true"), z.literal("false")]).optional(),
  MOSAIX_REQUEST_TIMEOUT_MS: z.string().regex(/^\d+$/).default("30000"),
  
  // Runtime terminal
  NO_TUI: z.string().optional(),
  NO_COLOR: z.string().optional(),
  TERM: z.string().optional(),
  DEBUG: z.string().optional(),
  
  // Scripts / setup
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  
  // DB container
  MOSAIX_DB_CONTAINER: z.string().default("mosaix-db-1"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;
```

### 4.2 Interface du ConfigService

```typescript
// packages/core/src/config/config.service.ts
export interface ConfigService {
  // Lecture d'une valeur scalaire avec typage
  get<T>(key: string): T | undefined;
  
  // Lecture avec valeur par défaut
  getOr<T>(key: string, defaultValue: T): T;
  
  // Vérification d'existence
  has(key: string): boolean;
  
  // Accès à une sous-section typée (ex: config.security.jwt.secret)
  section<K extends string>(path: K): ConfigSection;
  
  // Validation et fail-fast au démarrage
  validate(): { valid: boolean; errors: string[]; warnings: string[] };
  
  // Rechargement (à usage limité, ex: rechargement de config dynamique)
  reload(): Promise<void>;
  
  // Injection : fournir une configuration typée à un consommateur
  provide<T>(factory: (config: ReadonlyConfig) => T): T;
}

export interface ReadonlyConfig {
  readonly env: Readonly<EnvConfig>;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly secrets: Readonly<SecretsConfig>;
  readonly infrastructure: Readonly<InfrastructureConfig>;
  readonly platform: Readonly<PlatformConfig>;
  readonly security: Readonly<SecurityConfig>;
  readonly modules: Readonly<ModulesConfig>;
}
```

### 4.3 Règles de priorité du ConfigResolver

```typescript
// packages/core/src/config/config-resolver.ts
export interface ConfigResolver {
  resolve<T>(key: string): T | undefined;
  
  // Ordre de résolution (par catégorie) :
  // 1. ENV / Secret Manager (secrets et infrastructure uniquement)
  // 2. Database (paramètres dynamiques)
  // 3. Environnement (config/environments/*.ts)
  // 4. Static defaults (config/defaults.ts)
}
```

**Contrainte architecturale :** la base de données ne peut pas surcharger les secrets ni les paramètres d'infrastructure (DATABASE_URL, JWT_SECRET, etc.).

---

## 5. Modèle de données (PostgreSQL)

Tables proposées pour la configuration dynamique (à créer par migration, non exécutée durant cette phase) :

```sql
-- Configuration globale (plateforme)
CREATE TABLE platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  category TEXT NOT NULL, -- 'platform', 'security', 'module'
  is_editable BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT, -- ID administrateur
  description TEXT
);

-- Configuration par BAC
CREATE TABLE bac_config (
  bac_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (bac_id, key)
);

-- Configuration par tenant
CREATE TABLE tenant_config (
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (tenant_id, key)
);

-- Historique des modifications (audit)
CREATE TABLE config_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL, -- 'global', 'bac:<id>', 'tenant:<id>'
  key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

-- Index pour performance des lectures fréquentes
CREATE INDEX idx_bac_config_bac_id ON bac_config(bac_id);
CREATE INDEX idx_tenant_config_tenant_id ON tenant_config(tenant_id);
CREATE INDEX idx_config_audit_log_scope ON config_audit_log(scope);
CREATE INDEX idx_config_audit_log_changed_at ON config_audit_log(changed_at);
```

**Règle de sécurité :** aucun secret (JWT, OAuth, PSP, SATIM, MCP) ne doit être stocké en clair dans ces tables.

**Cache :** un mécanisme de cache en mémoire avec invalidation (via événement ou TTL) doit être prévu pour éviter les lectures DB répétées sur chaque requête.

---

## 6. Diagrammes de flux (description textuelle)

### 6.1 Flux de résolution d'une configuration

```
Demande de configuration (ex: security.jwt.secret)
        │
        ▼
┌─────────────────┐
│ ConfigService   │ ← Point d'entrée unique
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ConfigResolver  │ │ Ordre : ENV > DB > env-config > defaults
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 ENV        DB?  ← Uniquement pour clés non-secrets, non-infrastructure
 (secrets/  │     (maintenance, feature flags, bac settings, tenant settings)
  infra)    ▼
           config/
           (environnements + defaults)
    │         │
    └────┬────┘
         │
         ▼
    Valeur typée + validée (Zod)
         │
         ▼
    Consommateur métier (BAC, service, etc.)
```

### 6.2 Flux de démarrage (fail-fast)

```
process.start()
        │
        ▼
ConfigService.loadFromEnv()  ← Lecture process.env, validation Zod
        │
        ├─ Variable obligatoire manquante ? ──► Erreur fatale (exit code non-nul)
        │
        ▼
ConfigService.loadFromDefaults()  ← Valeurs par défaut statiques
        │
        ▼
ConfigService.validate()  ← Vérification croisée (ex: JWT_SECRET >= 32 en prod)
        │
        ├─ Erreur de validation ? ──► Erreur fatale, message explicite
        │
        ▼
Server boot authorized
        │
        ▼
BACs montés avec configuration injectée (pas de process.env direct)
```

---

## 7. Stratégie de sécurité

### 7.1 Protection des secrets

- Aucun secret n'est lu directement via `process.env` depuis le domaine métier.
- Les secrets sont injectés via `ConfigService.secrets` (interface en lecture seule).
- Les secrets ne sont **jamais** stockés en base de données.
- En production, l'absence d'un secret obligatoire (`MOSAIX_AUTH_JWT_SECRET`, `MOSAIX_SESSION_SECRET`, `PSP_WEBHOOK_SECRET`) provoque un **fail-fast** au démarrage.

### 7.2 Isolation multi-tenant

- La configuration par tenant est stockée dans `tenant_config` avec isolation par `tenant_id`.
- Un BAC ne peut lire que sa propre configuration et la configuration globale, jamais celle d'un autre tenant.
- La résolution de configuration injecte le contexte tenant courant.

### 7.3 Contrôle des modifications

- Toute modification de configuration dynamique passe par `config_audit_log` (qui, quoi, quand, pourquoi).
- Les modifications nécessitent une authentification administrateur.
- Les changements à chaud sont propagés via invalidation de cache + événement interne.

### 7.4 Robustesse

- En cas d'indisponibilité de la base de données au démarrage, le système doit pouvoir démarrer avec les valeurs par défaut (config/ + ENV) pour les paramètres non-critiques.
- Les paramètres critiques (secrets, URL DB) doivent être présents dès le démarrage (fail-fast).
- Un cache local évite les lectures DB répétées ; en cas d'indisponibilité du cache, lecture directe DB avec fallback defaults.

---

## 8. Plan de migration (lots progressifs)

La migration est **progressive, par lots, réversible**. Aucun changement de code n'est effectué durant cette phase d'étude.

### Lot 1 — Socle (semaine 1)
- Créer `config/` avec schémas Zod, defaults, environnements.
- Créer `packages/core/src/config/` (ConfigService, ConfigResolver, ConfigProvider).
- Valider au démarrage : fail-fast si variable obligatoire manquante.
- **Tests :** unité sur ConfigService, schéma Zod, fail-fast.

### Lot 2 — Secrets prioritaires (semaine 2)
- Migrer `security-guard.ts` (JWT_SECRET, SESSION_SECRET) vers ConfigService.
- Migrer `psp-webhook-handler.ts` (PSP_WEBHOOK_SECRET) vers ConfigService.
- Migrer `social-auth-service.ts` (OAuth secrets) vers ConfigService.
- **Tests :** sécurité (absence de secret en prod → erreur), pas de fuite de secret.

### Lot 3 — Infrastructure (semaine 3)
- Migrer `api-dispatcher.ts` (NODE_ENV, REDIS_URL), `gateway.ts` (TRUST_PROXY), `http.ts` (CORS_ALLOWED_ORIGINS), `rate-limiter.ts` (TRUST_PROXY).
- **Tests :** santé au démarrage, comportement CORS/proxy.

### Lot 4 — Plateforme (semaine 4)
- Migrer `platform-settings.ts` (MOSAIX_DEFAULT_BAC), `composition-loader.ts` (MOSAIX_COMPOSITION), `maintenance-module.ts` (MOSAIX_MAINTENANCE_MODE), `start.ts` (REQUEST_TIMEOUT_MS).
- **Tests :** comportement montage BAC, mode maintenance.

### Lot 5 — Commerce / Paiements (semaine 5)
- Migrer `satim-payment-port.ts` (SATIM_*), `psp-webhook-handler.ts` déjà fait.
- **Tests :** paiement (webhook signature, gateway URL).

### Lot 6 — Base de données dynamique (semaine 6+)
- Créer les tables `platform_config`, `bac_config`, `tenant_config`, `config_audit_log`.
- Migrer `maintenance-mode`, `feature flags` vers DB avec override ENV.
- **Tests :** audit log, invalidation de cache, isolation tenant.

### Critères d'acceptation par lot
- Aucun fichier de production ne lit `process.env` directement après migration de ce lot.
- Tous les tests existants passent (1258+ tests de référence).
- TypeScript compile sans erreur.
- Rollback possible par lot (revert du commit).

---

## 9. Plan de tests

### Tests unitaires (ConfigService)
| Test | Description |
|------|-------------|
| Chargement depuis process.env | Vérifier que les variables ENV sont lues et typées |
| Valeurs par défaut | Vérifier l'application des defaults quand ENV absent |
| Priorité ENV > DB > defaults | Vérifier l'ordre de résolution |
| Fail-fast variable manquante | Vérifier l'erreur fatale si variable obligatoire manquante en prod |
| Validation Zod | Vérifier le rejet des valeurs invalides (ex: JWT_SECRET < 32) |
| Section typée | Vérifier l'accès par section (security.jwt.secret) |
| Pas de fuite de secret | Vérifier qu'aucun secret n'apparaît dans les logs |

### Tests d'intégration
| Test | Description |
|------|-------------|
| Démarrage serveur avec config manquante | Vérifier l'arrêt propre avec message explicite |
| Démarrage serveur avec config invalide | Vérifier l'erreur de validation |
| Rechargement de configuration | Vérifier l'invalidation de cache |
| Isolation tenant | Vérifier qu'un tenant ne lit pas la config d'un autre |

### Tests de sécurité
| Test | Description |
|------|-------------|
| Aucun process.env dans le domaine métier | Analyse statique : grep `process.env` dans `apps/*/src/domain/` |
| Secrets non exposés | Vérifier qu'aucun secret n'est logué ou retourné par une API |
| CORS en production | Vérifier que `CORS_ALLOWED_ORIGINS` vide en prod → pas de wildcard |

---

## 10. Décisions nécessitant validation humaine

| Décision | Options | Recommandation | Justification |
|----------|---------|----------------|---------------|
| Bibliothèque de validation | Zod (déjà présente) vs nouvelle librairie | **Zod** | Déjà dépendance du projet, cohérence |
| Stockage config dynamique | PostgreSQL vs fichier JSON vs Redis | **PostgreSQL** | Cohérence avec stack existante, ACID, audit |
| Secrets en production | ENV vs Secret Manager externe | **ENV** pour MVP, Secret Manager en option ultérieure | Simplicité, pas de nouvelle dépendance |
| Moment du fail-fast | Au démarrage du serveur vs paresseux | **Au démarrage** | Sécurité : ne pas démarrer avec config invalide |
| Config BAC par défaut | Globale uniquement vs hiérarchique globale→BAC→tenant | **Hiérarchique** | Nécessaire pour l'ambition multi-BAC/multi-tenant de MosaiX |
| Invalidation cache | Événement interne vs TTL | **Événement + TTL de secours** | Réactivité + sécurité |

### Questions ouvertes à l'utilisateur
1. Acceptez-vous l'architecture hybride (config/ + DB + ENV) comme cible ?
2. Les tables de configuration dynamique (plate_config, bac_config, tenant_config) doivent-elles être créées dès maintenant ou différées ?
3. Faut-il prévoir un Secret Manager externe (AWS Secrets Manager, HashiCorp Vault) dès la Phase 3 ou rester sur variables d'environnement ?

---

## 11. Avantages, inconvénients et compromis

### Avantages
- **Sécurité :** secrets isolés, fail-fast au démarrage, pas de lecture `process.env` dispersée.
- **Maintenabilité :** point d'entrée unique, schémas Zod, configuration typée.
- **Évolutivité :** préparation au multi-BAC et multi-tenant (résolution hiérarchique).
- **Observabilité :** audit log des modifications de configuration.
- **Rétrocompatibilité :** migration par lots, rollback possible.

### Inconvénients
- **Complexité accrue :** nouvelle couche ConfigService, nouvelles tables DB.
- **Dépendances :** ajout potentiel d'un mécanisme de cache et d'invalidation.
- **Temps de mise en œuvre :** migration par lots sur plusieurs semaines.

### Compromis acceptés
- Les variables de runtime terminal (`NO_TUI`, `NO_COLOR`, `TERM`, etc.) restent lues directement via `process.env` (ce ne sont pas de la configuration métier).
- Les scripts de setup/installation/seed conservent leur lecture directe de `process.env` (contexte d'initialisation, pas de runtime).
- Les fichiers de test conservent leur manipulation directe de `process.env` (setup/teardown de tests).

---

## Conclusion

Cette étude architecturale propose une **architecture hybride de configuration** pour MosaiX, conforme aux trois principes non négociables de ChatGPT :

1. **Une seule porte d'entrée :** aucun module métier ne lit directement `process.env`.
2. **Configuration typée :** Zod valide les configurations avant utilisation.
3. **Configuration dynamique maîtrisée :** modifications en base auditées, validées, propagées avec cache et invalidation.

L'étude est **en lecture seule**. Aucun fichier de production n'a été modifié. La prochaine étape, après validation humaine de cette architecture, est l'implémentation du Lot 1 (socle ConfigService + schémas Zod).

---
*Rapport généré dans le cadre de la collaboration avec ChatGPT (conversation `bfedf4b4-7be7-4e0c-a249-5396adef8fef`). Méthode architecture-sanity : diagnostic → conception → validation avant implémentation.*