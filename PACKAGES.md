# MosaiX — Structure du monorepo `packages/`

Vue d'ensemble de l'architecture des packages, de leurs rôles, versions et dépendances.
Accent particulier : **le sous-système Thème** (contrats, core, schémas — PRD-0008).

## Arborescence

```
packages/
├── adapters/              # Implémentations concrètes des ports (40 adapters)
│   ├── auth-local/               @mosaix/adapter-auth-local          (1.0.0)
│   ├── auth-oidc/                @mosaix/adapter-auth-oidc           (1.0.0)
│   ├── auth-webauthn/            @mosaix/adapter-auth-webauthn       (1.0.0)
│   ├── cache-memory/             @mosaix/adapter-cache-memory        (1.0.0)
│   ├── cache-redis/              @mosaix/adapter-cache-redis         (1.0.0)
│   ├── clock-fake/               @mosaix/adapter-clock-fake          (1.0.0)
│   ├── clock-system/             @mosaix/adapter-clock-system        (1.0.0)
│   ├── config-env/               @mosaix/adapter-config-env          (1.0.0)
│   ├── credential-store-postgres/@mosaix/adapter-credential-store-postgres (1.0.0)
│   ├── credential-store-sqlite/  @mosaix/adapter-credential-store-sqlite   (1.0.0)
│   ├── crypto-node/              @mosaix/adapter-crypto-node         (1.0.0)
│   ├── crypto-web/               @mosaix/adapter-crypto-web          (1.0.0)
│   ├── database-postgres/        @mosaix/adapter-database-postgres   (0.1.0)
│   ├── database-sqlite/          @mosaix/adapter-database-sqlite     (0.1.0)
│   ├── email-ses/                @mosaix/adapter-email-ses           (1.0.0)
│   ├── email-smtp/               @mosaix/adapter-email-smtp          (1.0.0)
│   ├── featureflags-launchdarkly/@mosaix/adapter-featureflags-launchdarkly (1.0.0)
│   ├── featureflags-memory/      @mosaix/adapter-featureflags-memory (1.0.0)
│   ├── http-fetch/               @mosaix/adapter-http-fetch          (1.0.0)
│   ├── identity-store-postgres/  @mosaix/adapter-identity-store-postgres (1.0.0)
│   ├── identity-store-sqlite/    @mosaix/adapter-identity-store-sqlite   (1.0.0)
│   ├── id-ulid/                  @mosaix/adapter-id-ulid             (1.0.0)
│   ├── id-uuid/                  @mosaix/adapter-id-uuid             (1.0.0)
│   ├── kafka/                    @mosaix/adapter-kafka               (1.0.0)
│   ├── logger-pino/              @mosaix/adapter-logger-pino         (1.0.0)
│   ├── logger-winston/           @mosaix/adapter-logger-winston      (1.0.0)
│   ├── messagebus-mosaix/        @mosaix/adapter-messagebus-mosaix   (1.0.0)
│   ├── metrics-otel/             @mosaix/adapter-metrics-otel        (1.0.0)
│   ├── rabbitmq/                 @mosaix/adapter-rabbitmq            (1.0.0)
│   ├── search-elasticsearch/     @mosaix/adapter-search-elasticsearch (1.0.0)
│   ├── search-memory/            @mosaix/adapter-search-memory       (1.0.0)
│   ├── secrets-env/              @mosaix/adapter-secrets-env         (1.0.0)
│   ├── session-store-redis/      @mosaix/adapter-session-store-redis (1.0.0)
│   ├── session-store-sqlite/     @mosaix/adapter-session-store-sqlite(1.0.0)
│   ├── sms-twilio/               @mosaix/adapter-sms-twilio          (1.0.0)
│   ├── storage-local/            @mosaix/adapter-storage-local       (1.0.0)
│   ├── storage-s3/               @mosaix/adapter-storage-s3          (1.0.0)
│   ├── token-store-postgres/     @mosaix/adapter-token-store-postgres(1.0.0)
│   ├── token-store-sqlite/       @mosaix/adapter-token-store-sqlite  (1.0.0)
│   └── tracing-otel/             @mosaix/adapter-tracing-otel        (1.0.0)
├── config/               # @mosaix/config   (0.1.0) — config centralisée, typée, immuable
├── contracts/            # @mosaix/contracts (0.1.0) — contrat de domaine canoniques (dont le domaine Thème)
├── core/                 # @mosaix/core      (0.1.0) — noyau runtime (kernel, registres, bus, résolveur Thème)
├── migrations/           # @mosaix/migrations (0.1.0) — moteur de migrations de schémas
├── ports/                # Interfaces abstraites (ports) — 24 ports
│   ├── cache/                @mosaix/ports-cache
│   ├── clock/                @mosaix/ports-clock
│   ├── config/               @mosaix/ports-config
│   ├── credential-store/     @mosaix/ports-credential-store
│   ├── crypto/               @mosaix/ports-crypto
│   ├── database/             @mosaix/ports-database
│   ├── email/                @mosaix/ports-email
│   ├── event-store/          @mosaix/ports-event-store
│   ├── feature-flags/        @mosaix/ports-feature-flags
│   ├── http/                 @mosaix/ports-http
│   ├── id/                   @mosaix/ports-id
│   ├── identity-store/       @mosaix/ports-identity-store
│   ├── logging/              @mosaix/ports-logging
│   ├── message-bus/          @mosaix/ports-message-bus
│   ├── metrics/              @mosaix/ports-metrics
│   ├── pubsub/               @mosaix/ports-pubsub
│   ├── search/               @mosaix/ports-search
│   ├── secrets/              @mosaix/ports-secrets
│   ├── session-creation/     @mosaix/ports-session-creation
│   ├── session-store/        @mosaix/ports-session-store
│   ├── sms/                  @mosaix/ports-sms
│   ├── storage/              @mosaix/ports-storage
│   ├── token-store/          @mosaix/ports-token-store
│   └── tracing/              @mosaix/ports-tracing
├── schemas/              # @mosaix/schemas  (0.1.0) — validateurs Zod des contracts (dont le domaine Thème)
├── sdk/                  # @mosaix/sdk       (0.1.0) — SDK applicatif (DX développeur)
└── types/                # @mosaix/types     (0.1.0) — types partagés de base
```

## Rôle des packages

| Package              | Version | Description                                                                                                                                                                        |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mosaix/types`      | 0.1.0   | Types et schémas partagés de base (aucune dépendance).                                                                                                                             |
| `@mosaix/contracts`  | 0.1.0   | Contrats canoniques : applications, plugins, capabilities, expériences, **thèmes**, événements, sécurité. Dépend de `@mosaix/types`.                                               |
| `@mosaix/schemas`    | 0.1.0   | Validateurs Zod des contracts — validation runtime, vérification de manifests, compatibilité de versions. Dépend de `@mosaix/contracts` + `zod`.                                   |
| `@mosaix/core`       | 0.1.0   | Noyau runtime MosaiX : cycle de vie, registres (capabilities, events, **theme targets**), backbone de communication, **ThemeResolver**. Dépend de `contracts`, `schemas`, `types`. |
| `@mosaix/sdk`        | 0.1.0   | SDK applicatif — expérience développeur pour construire des applications bornées. Dépend de `contracts`, `core`, `types`.                                                          |
| `@mosaix/config`     | 0.1.0   | Système de configuration centralisé, type-safe, extensible et immuable. Sans dépendance workspace.                                                                                 |
| `@mosaix/migrations` | 0.1.0   | Moteur de migrations de schémas (framework + applications). Dépend de `@mosaix/ports-database`.                                                                                    |
| `@mosaix/ports-*`    | 1.0.0   | Interfaces abstraites (hexagonal) — 24 ports, sans dépendance externe.                                                                                                             |
| `@mosaix/adapter-*`  | 1.0.0   | Implémentations concrètes des ports (40 adapters). Chaque adapter dépend de son port.                                                                                              |

## Graphique de dépendances (packages principaux)

```
types ───────────────► (indépendant)
contracts ───────────► types
schemas ─────────────► contracts, zod
core ────────────────► contracts, schemas, types
sdk ─────────────────► contracts, core, types
config ──────────────► (indépendant)
migrations ──────────► ports-database
ports-* ─────────────► (indépendant, uniquement types TS)
adapter-* ───────────► ports-<correspondant> (+ dépendances externes)
```

## Correspondance ports → adapters

| Port                      | Adapters                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| `ports-cache`             | `adapter-cache-memory`, `adapter-cache-redis`                              |
| `ports-clock`             | `adapter-clock-fake`, `adapter-clock-system`                               |
| `ports-config`            | `adapter-config-env`                                                       |
| `ports-credential-store` | `adapter-credential-store-postgres`, `adapter-credential-store-sqlite`     |
| `ports-crypto`            | `adapter-crypto-node`, `adapter-crypto-web`                                |
| `ports-database`          | `adapter-database-postgres`, `adapter-database-sqlite`                     |
| `ports-email`             | `adapter-email-ses`, `adapter-email-smtp`                                  |
| `ports-event-store`       | _(aucun adapter — port seul pour l'instant)_                               |
| `ports-feature-flags`     | `adapter-featureflags-launchdarkly`, `adapter-featureflags-memory`         |
| `ports-http`              | `adapter-http-fetch`                                                       |
| `ports-id`                | `adapter-id-ulid`, `adapter-id-uuid`                                       |
| `ports-identity-store`    | `adapter-identity-store-postgres`, `adapter-identity-store-sqlite`         |
| `ports-logging`           | `adapter-logger-pino`, `adapter-logger-winston`                            |
| `ports-message-bus`       | `adapter-messagebus-mosaix`                                                |
| `ports-metrics`           | `adapter-metrics-otel`                                                     |
| `ports-pubsub`            | `adapter-kafka`, `adapter-rabbitmq`                                        |
| `ports-search`            | `adapter-search-elasticsearch`, `adapter-search-memory`                    |
| `ports-secrets`           | `adapter-secrets-env`                                                      |
| `ports-session-creation`  | _(port abstrait d'amorçage de session)_                                    |
| `ports-session-store`     | `adapter-session-store-redis`, `adapter-session-store-sqlite`              |
| `ports-sms`               | `adapter-sms-twilio`                                                       |
| `ports-storage`           | `adapter-storage-local`, `adapter-storage-s3`                              |
| `ports-token-store`       | `adapter-token-store-postgres`, `adapter-token-store-sqlite`               |
| `ports-tracing`           | `adapter-tracing-otel`                                                     |
| _(auth domain adapters)_  | `adapter-auth-local`, `adapter-auth-oidc`, `adapter-auth-webauthn`          |

---

# 🌗 Le sous-système Thème

Le thème est l'un des domaines les plus riches du monorepo. Il est réparti sur **trois
packages** selon la règle de direction des dépendances `types ← contracts ← schemas ← core` :

| Package               | Rôle thème                                                                        |
| --------------------- | --------------------------------------------------------------------------------- |
| `contracts/src/theme` | Contrats de type purs (ABI générique, manifest, tokens, événements, store port)   |
| `schemas/src/theme`   | Schémas Zod stricts des mêmes contrats (validation runtime)                       |
| `core/src/theme`      | Implémentation runtime : registre des cibles, store in-memory, résolveur, erreurs |

Aucun package thème n'importe depuis une autre famille du domaine (règle "no cross-family
imports" de `theme-events.ts`) et aucun contrat ne référence d'entité métier concrète
(invariants `INV-THEME-001/002` — généricité par design).

## 1. Contrats du thème — `@mosaix/contracts/src/theme/`

| Fichier                      | Contrat(s) exporté(s)                                                                                              | Rôle                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `design-tokens.ts`           | `DesignTokens`, `ColorTokens`, `TypographyTokens`, `SpacingTokens`, `RadiusTokens`, `ShadowTokens`, `MotionTokens` | Valeurs sémantiques compilées en variables CSS à l'exécution.                                                                                                                                                                              |
| `theme-manifest.ts`          | `ThemeManifest` (extends `MosaixArtifactManifest`)                                                                 | Un thème **est lui-même un artefact MosaiX** (`type: "theme"`) : tokens, `extends`, assets, accessibilité, overlays `modes`.                                                                                                               |
| `theme-mode.ts`              | `ThemeMode = "light" \| "dark" \| "system"`                                                                        | **Définition unique** de l'union des modes (anti-drift) : `"system"` est une préférence de résolution, jamais une clé d'overlay (D-09).                                                                                                    |
| `theme-target.ts`            | `ThemeTarget { type, id }`                                                                                         | L'entité à laquelle un thème est assigné. **Générique** : `type` est une chaîne déclarée par le projet ("store", "brand", "workspace", …), aucun champ métier.                                                                             |
| `theme-assignment.ts`        | `ThemeAssignment`, `AssignmentSource`                                                                              | Lien thème→cible par une autorité (`platform` \| `admin` \| `user` \| `application`), avec range semver optionnelle (`version`) et `mode`.                                                                                                 |
| `theme-preference.ts`        | `ThemePreference`                                                                                                  | Préférence (D-01) qui détermine **uniquement le `mode`** — ne peut jamais remplacer un `themeId` assigné.                                                                                                                                  |
| `theme-resolution.ts`        | `ThemeResolution`, `ThemeResolutionContext`, `ThemeResolutionSource`                                               | Enregistrement de décision léger `{ themeId, mode, source }` ; `source` = `"entity" \| "user" \| "application" \| "platform"` (pourquoi). `ThemeResolutionContext` est autonome (D-06), ne dépend pas du contexte de composition ADR-0007. |
| `theme-resolved.ts`          | `ResolvedTheme`, `CompiledTheme`                                                                                   | Résultat final après résolution `extends` : manifest fusionné + `mode` (D-07). `CompiledTheme` = `Record<string,string>` — tokens → valeurs CSS, jamais `unknown` (C2). Ex. `{ "--mx-color-primary": "#1e73e8" }`.                         |
| `theme-assignments-store.ts` | `ThemeAssignmentsStore` (port)                                                                                     | Frontière de persistance des assignations (THEME-06, D-18) : `assign` / `unassign` / `get` / `list`. Type-only, importable par core sans Zod.                                                                                              |
| `theme-events.ts`            | `themeAssignmentChangedEvent`, `themeChangedEvent`, payloads                                                       | Événements de domaine : `theme.assignment.changed` (trace de configuration), `theme.changed` (après injection d'un thème résolu).                                                                                                          |
| `accessibility.ts`           | `AccessibilityProfile`                                                                                             | Contraste supporté (`normal`/`aa`/`aaa`), `reducedMotion`, `largeText`, `highContrast`.                                                                                                                                                    |
| `branding.ts`                | `ThemeAssets`, `BrandingProfile`                                                                                   | Assets : preview, fonts (famille/url/format/poids), icônes ; profil de marque (logo, couleurs).                                                                                                                                            |

### Design Tokens (sémantique)

```
DesignTokens
├── colors (requis)     primary, onPrimary, secondary, onSecondary,
│                       background, surface, text, muted, border,
│                       error, warning, success
├── typography (opt.)   fontFamily, baseSize, heading
├── spacing (opt.)      xs, sm, md, lg, xl
├── radius (opt.)       sm, md, lg, full
├── shadows (opt.)      sm, md, lg
└── motion (opt.)
    ├── duration        fast, normal, slow
    └── easing          standard, decelerate, accelerate
```

Chaque valeur est une chaîne brute (ex. `"#1e73e8"`, `"8px"`, `"0.2s"`) compilée en
variables CSS. Les couleurs sont validées en hexadécimal (`#rgb`, `#rrggbb`, `#rrggbbaa`).

### Overlays de mode (D-08/D-09)

`ThemeManifest.modes` accepte **uniquement** les clés `light` et `dark` : des overlays
partiels de `DesignTokens` fusionnés déterministiquement sur `tokens` à la compilation.
Une clé `"system"` est **une erreur de schéma** (schémas `.strict()`).

## 2. Schémas Zod — `@mosaix/schemas/src/theme.ts`

Tous les objets sont `.strict()` : les clés inconnues échouent déterministiquement
(T-01-02) — ex. un overlay `"system"` (D-09) ou une source `"tenant"`/`"default"` (D-04).

| Schéma                         | Contraintes notables                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `ColorTokensSchema`            | `hexColor` : regex `#(?:[0-9a-fA-F]{3}\|{6}\|{8})`                                                        |
| `DesignTokensSchema`           | objets `.strict()`, sections optionnelles                                                                 |
| `ThemeManifestSchema`          | `artifactManifest("theme").extend(...)` ; `modes` restreint à light/dark ; overlay exige `colors.primary` |
| `ThemeModeSchema`              | `z.enum(["light","dark","system"])`                                                                       |
| `ThemeResolutionSourceSchema`  | `z.enum(["entity","user","application","platform"])`                                                      |
| `ThemeAssignmentSchema`        | `target`, `themeId`, `version` (string), `mode`, `source`, `updatedAt` (`datetime offset`), `updatedBy`   |
| `ThemePreferenceSchema`        | valide la **structure seule** (THEME-03) — jamais le contexte d'assignation                               |
| `ThemeResolutionContextSchema` | `target` requis + préférences + `precedence` optionnels                                                   |
| `ResolvedThemeSchema`          | `manifest: ThemeManifestSchema`                                                                           |
| `CompiledThemeSchema`          | `z.record(z.string(), z.string())`                                                                        |
| `themeEventPayloadSchemas`     | map clé-événement → schéma, **clé via constantes contracts** (T-01-01)                                    |

## 3. Implémentation core — `@mosaix/core/src/theme/`

| Fichier                                | Classe/Fonction(s)                                                                                                                                               | Rôle                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-target-registry.ts`             | `ThemeTargetRegistry`                                                                                                                                            | Registre **bootstrap-only** des types de cibles thématisables (THEME-04, D-16). Déclare les capacités `userSelectable` / `adminConfigurable` via liste déclarative ou `register()`. Ne résout **jamais** de thème (D-10). Type non enregistré = `undefined`, jamais une erreur (D-17).                               |
| `theme-resolver.ts`                    | `ThemeResolver`, `createThemeResolver`, étapes pures `resolveTarget`/`resolveAssignment`/`resolveThemeId`/`resolveMode`/`resolveInheritance`, `satisfiesVersion` | Pipeline de résolution (THEME-05, D-13/D-14/D-15/D-20). **Entity-first** ; chaîne d'autorité `entity → user → application → platform` ; mode découplé de themeId (D-01) ; fail-open (erreur attachée au résultat, jamais levée).                                                                                     |
| `theme-inheritance-resolver.ts`        | `ThemeInheritanceResolver`, `resolveThemeInheritance`                                                                                                            | DFS **parent-first** du graphe `extends` (D-19/D-20) : les ancêtres fusionnent d'abord, l'enfant superpose en dernier (merge **récursif**, scalaires/arrays enfant gagnent, sous-arbres parents préservés — CR-01). Cycle → `ThemeCycleError`, manifest manquant → `ThemeNotFoundError` (fails-closed dans l'étape). |
| `in-memory-theme-assignments-store.ts` | `InMemoryThemeAssignmentsStore`                                                                                                                                  | Adaptateur in-memory du port (THEME-06, D-18) : validation Zod strict avant écriture (sinon `ThemeValidationError`), `unassign` idempotent, événements de mutation via `onMutation` injecté (le store n'importe jamais event-bus).                                                                                   |
| `theme-errors.ts`                      | `ThemeError` + spécialisations                                                                                                                                   | Hiérarchie d'erreurs (D-22) : `ThemeNotFoundError`, `ThemeCycleError`, `ThemeVersionError`, `ThemeValidationError`, + `ThemeCompatibilityError`/`ThemeAuthorizationError` **déclarées mais non levées** en Phase 2 (D-21). Codes stables `THEME_*`.                                                                  |

### Pipeline de résolution (5 étapes — `ThemeResolver.resolve`)

```
1. resolveTarget        registry.get(ctx.target.type)  — lecture seule, jamais d'enregistrement (D-17)
2. resolveAssignment    store.get(ctx.target)          — retour optionnel (D-18)
3. resolveThemeId       chaîne d'autorité D-13         — première source qui fournit un themeId
4. resolveMode          préférences d'abord (D-01)     — user → application → assignment → default ("system")
5. resolveInheritance   chargement manifest + gate semver + DFS extends (D-19/D-20)
```

- **Chaîne d'autorité par défaut** : `["entity", "user", "application", "platform"]`
  (`DEFAULT_THEME_PRECEDENCE`), surchargeable par `ctx.precedence`.
- **Fail-open** (D-20) : une `ThemeError` levée par une étape est capturée et attachée à
  `outcome.error` — `resolve()` ne crash jamais ; une erreur non-Thème est relancée.
- **Semver minimal** : `satisfiesVersion` gère l'égalité exacte et le caret
  `^major.minor.patch` — le semver complet est laissé au compilateur Phase 3.
- **Fusion d'héritage (D-19)** : merge **récursif** — scalaires/arrays de l'enfant gagnent, les
  sous-arbres d'objets (`tokens`, `modes`, `accessibility`, `assets`, `metadata`) fusionnent en
  profondeur donc une superposition partielle préserve le reste du parent (CR-01) ;
  `themeId`/`version`/`mode` du nœud feuille gagnent au niveau `ResolvedTheme`.

### Hiérarchie des erreurs

```
KernelError
└── ThemeError
    ├── ThemeNotFoundError         THEME_NOT_FOUND       (levée en Phase 2)
    ├── ThemeCycleError            THEME_CYCLE           (levée en Phase 2)
    ├── ThemeVersionError          THEME_VERSION         (levée en Phase 2)
    ├── ThemeValidationError       THEME_VALIDATION      (levée en Phase 2)
    ├── ThemeCompatibilityError    THEME_COMPATIBILITY   (déclarée, gate: PolicyResolver)
    └── ThemeAuthorizationError    THEME_AUTHORIZATION   (déclarée, gate: PolicyResolver)
```

## 4. Flux d'événements thème

```
assign/unassign (store)
      │  onMutation (injecté, jamais importé par le store)
      ▼
theme.assignment.changed   { target, assignment, changedBy, at }
      │
      ▼  (après injection du thème résolu par le résolveur Phase 3)
theme.changed              { theme, mode, version, appliedAt, target? }
```

Les schémas de payload sont enregistrés dans le kernel `EventSchemaRegistry` dans les
phases ultérieures (D-12). Les clés d'événement sont réutilisées depuis les constantes de
`@mosaix/contracts` pour éviter toute erreur de frappe (T-01-01).

## 5. Décisions clés thème (références D-*)

| Décision       | Résumé                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| D-01           | Une préférence ne détermine que le `mode`, jamais le `themeId`                      |
| D-04/D-05      | `AssignmentSource` (qui) ≠ `ThemeResolutionSource` (pourquoi)                       |
| D-06           | `ThemeResolutionContext` autonome, thème-scopé                                      |
| D-07           | `ResolvedTheme` = manifest résolu `extends` (distinct de la décision)               |
| D-08/D-09      | Overlays `modes` = light/dark uniquement ; `"system"` est préférence, pas overlay   |
| D-10           | Le registre de cibles ne résout rien                                                |
| D-11/D-12      | Événements thème + enregistrement dans le registre des schémas                      |
| D-13/D-14/D-15 | Chaîne d'autorité, entité-first, source enregistrée dans la décision                |
| D-16/D-17      | Enregistrement bootstrap-only ; type inconnu = absent, jamais erreur                |
| D-18           | Port de persistance des assignations, retour optionnel                              |
| D-19/D-20      | DFS extends parent-first (cycle → erreur) ; fail-open au niveau `resolve()`         |
| D-21/D-22      | Erreurs phase 2 vs phase ultérieure ; codes stables, jamais de matching sur message |

## 6. Structure interne type d'un package

```
<nom-package>/
├── package.json          # nom @mosaix/..., version, deps workspace:*
├── README.md             # documentation du package (ports/adapters)
├── tsconfig.json         # configuration TS du package
├── src/
│   └── index.ts          # point d'entrée (port : contrat d'interface ; adapter : implémentation)
│   └── *.test.ts         # tests unitaires (Vitest)
└── dist/                 # build de compilation (généré, ignoré par git)
```

Notes :

- Les dépendances internes utilisent `workspace:*` (pnpm workspace).
- Les tests utilisent **Vitest** et **TypeScript** dans chaque package.
- `dist/` et `node_modules/` sont générés — ne pas les versionner.
- `contracts`, `core` et `schemas` disposent de sous-dossiers thématiques dans `src/`
  (`application/`, `capability/`, `events/`, `experience/`, `plugin/`, `security/`,
  **`theme/`**, `modules/`).
