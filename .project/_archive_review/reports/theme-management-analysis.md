# Rapport d'Analyse — Système de Gestion des Thèmes

> Généré le 30 octobre 2026
> Portée : `packages/theme`, `packages/contracts/src/theme/`, `packages/schemas/src/index.ts`, `themes/`, `src/theme/`

---

## 1 Vue d'ensemble

Le système de gestion des thèmes MosaiX est une architecture multi-couches, multi-package, conçue pour gérer :

- **Le dark/light mode** : préférences utilisateur, résolution par priorité, injection CSS runtime
- **Les thèmes Tailwind MDC** : 20 thèmes visuels avec tokens de design sémantiques et overlay par mode (light/dark/high-contrast)
- **L'héritage de thèmes** : un thème peut étendre un autre via `extends` avec deep-merge et détection de cycle
- **L'assignation ciblée** : liaison thème → entité (store, organization, user, application, platform, space) avec persistance mémoire ou PostgreSQL
- **Les slots personnalisables** : moteur de résolution de templates HTML par slot (header, footer, hero) avec surcouche application/tenant
- **Les événements domain** : `theme.assignment.changed` + `theme.changed` tracés via le bus d'événements Mosaix

### Architecture en couches

```
┌─────────────────────────────────────────────────────────────────┐
│                         packages/theme                           │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ ThemeSDK │ │ThemeRunt │ │ThemeResol │ │ ThemeInjector    │  │
│  │  (L1-3)  │ │  imer    │ │   ver     │ │  (CSS vars)      │  │
│  └──────────┘ └────┬─────┘ └─────┬─────┘ └────────┬─────────┘  │
│                    │              │                  │            │
│  ┌─────────────────┼──────────────┼──────────────────┼──────────┐│
│  │   ThemeCompiler │  ThemeCache  │  ThemeDiscovery  │ Slot Eng ││
│  │  (tokens→CSS)   │  (LRU 100)   │  (scan themes/)  │ Resolver ││
│  └─────────────────┘ └────────────┘ └────────────────┘ └────────┘│
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Stores : InMemory │ Postgres │ Migration (schema.sql)       ││
│  └──────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    packages/contracts/src/theme/                  │
│  14 contrats typescript purs (ThemeMode, ThemeTarget,            │
│   ThemeManifest, ThemeAssignment, ThemePreference,               │
│   ThemeResolution, ResolvedTheme, CompiledTheme,                 │
│   ThemeAssignmentsStore port, Events, DesignTokens,              │
│   AccessibilityProfile, ThemeAssets/BrandingProfile)             │
├─────────────────────────────────────────────────────────────────┤
│                    packages/schemas/src/index.ts                  │
│  5 schémas Zod runtime : ThemeTarget, ThemeManifest,             │
│   ThemeAssignment, ThemeChangedPayload,                          │
│   ThemeAssignmentChangedPayload                                  │
├─────────────────────────────────────────────────────────────────┤
│                         themes/                                  │
│  20 thèmes + 1 template, chacun avec theme.json (tokens,        │
│   modes overlay, tailwind MDC tokens, slots, layouts,            │
│   assetPresets, settings.schema.json)                            │
├─────────────────────────────────────────────────────────────────┤
│                         src/theme/                               │
│  Fonctions utilitaires pures : resolveTokens, resolveSlot +      │
│  leurs suites de tests                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2 Contrats (`packages/contracts/src/theme/`)

### 2.1 `ThemeMode` — Définition canonique unique

```typescript
type ThemeMode = "light" | "dark" | "system";
```

- **Fichier** : `theme-mode.ts`
- **Rôle** : point de vérité unique pour empêcher la dérive (D-09)
- **Note importante** : `"system"` est une préférence temps-résolution (détecte la préférence OS). Il n'est **jamais** une clé de `ThemeManifest.modes` (seul `light`/`dark` autorisés)
- **Gap détecté** : Le code comment dans `theme-mode.ts:15` mentionne `"high-contrast"` dans le type, mais le type effectif est `"light" | "dark" | "system"`. Les fichiers de thème (`themes/ocean/theme.json`) incluent un overlay `"high-contrast"` dans `modes`, ce qui n'est pas validé par le contrat `ThemeMode`

### 2.2 `ThemeTarget` — Cible générique

```typescript
interface ThemeTarget {
  readonly type: string;
  readonly id: string;
}
```

- **Zéro champ métier** : le système ne connaît pas la sémantique des cibles
- **Types enregistrés** : `"space"`, `"store"`, `"organization"`, `"user"`, `"application"`, `"platform"`

### 2.3 `ThemeAssignment` — Liaison thème → cible

```typescript
interface ThemeAssignment {
  readonly target: ThemeTarget;
  readonly themeId: string;
  readonly version?: string;      // Semver range "^1.0.0"
  readonly mode?: ThemeMode;
  readonly source: AssignmentSource; // "platform" | "admin" | "user" | "application"
  readonly updatedAt?: string;
  readonly updatedBy?: string;
}
```

- **Versioning** : support des ranges Semver (`^1.0.0`) avec vérification `satisfiesVersion()`
- **Source** : distingue QUI a assigné du POURQUOI la résolution a été faite

### 2.4 `ThemePreference` — Préférence utilisateur

```typescript
interface ThemePreference {
  readonly inherit: boolean;
  readonly allowedModes?: readonly ThemeMode[];
  readonly preferredMode?: ThemeMode;
}
```

- Détermine uniquement le **mode**, jamais le `themeId`
- **`inherit: true`** : ignore la préférence et hérite du parent
- **`allowedModes`** : si `preferredMode` n'est pas dans la liste → ignorée
- Précedence : user → application → assignment → default

### 2.5 `ThemeResolution` — Enregistrement de décision

```typescript
type ThemeResolutionSource = "entity" | "user" | "application" | "platform";

interface ThemeResolution {
  readonly themeId: string;
  readonly mode: ThemeMode;
  readonly source: ThemeResolutionSource;
}
```

- **Lightweight** : ne contient pas le manifeste complet
- `ThemeResolutionContext` est standalone — pas de dépendance vers le contexte de composition ADR-0007

### 2.6 `ThemeManifest` — Artifact thème

```typescript
interface ThemeManifest extends MosaixArtifactManifest {
  type: "theme";
  tokens: DesignTokens;
  extends?: string;             // parent theme ID
  contractVersion?: string;     // validé par ThemeDiscovery
  assets?: ThemeAssets;
  accessibility?: AccessibilityProfile;
  modes?: {
    readonly light?: DesignTokens;
    readonly dark?: DesignTokens;
  };
}
```

### 2.7 `DesignTokens` — Structure sémantique

```typescript
interface DesignTokens {
  colors: ColorTokens;          // primary, secondary, background, surface, text, ...
  typography?: TypographyTokens; // fontFamily, baseSize, heading
  spacing?: SpacingTokens;      // xs, sm, md, lg, xl
  radius?: RadiusTokens;        // sm, md, lg, full
  shadows?: ShadowTokens;       // sm, md, lg
  motion?: MotionTokens;        // duration {fast, normal, slow}, easing {standard, decelerate, accelerate}
}
```

### 2.8 `AccessibilityProfile` & `ThemeAssets`

```typescript
interface AccessibilityProfile {
  contrast?: ("normal" | "aa" | "aaa")[];
  reducedMotion?: boolean;
  largeText?: boolean;
  highContrast?: boolean;
}

interface ThemeAssets {
  preview?: string;
  fonts?: Array<{ family, url, format?, weight? }>;
  icons?: Array<{ name, url }>;
}
```

### 2.9 Événements Domain

| Événement | Quand | Payload |
|-----------|-------|---------|
| `theme.assignment.changed` | Après assignation/annulation | `target`, `assignment`, `changedBy`, `at` |
| `theme.changed` | Après injection CSS | `theme`, `mode`, `version`, `appliedAt`, `target?` |

- Les payloads sont typés `string` (pas `ThemeMode`) pour l'interopérabilité event-bus
- Enregistrement dans `EventSchemaRegistry` du kernel via `createThemeRuntime()`

### 2.10 Port `ThemeAssignmentsStore`

```typescript
interface ThemeAssignmentsStore {
  assign(assignment: ThemeAssignment): void;
  unassign(target: ThemeTarget): void;
  get(target: ThemeTarget): ThemeAssignment | undefined;
  list(): ThemeAssignment[];
}
```

- **Type-only** dans `@mosaix/contracts`, pas de runtime
- Implémenté par `InMemoryThemeAssignmentsStore` et `PostgresThemeAssignmentsStore`

---

## 3 Implémentation (`packages/theme/`)

### 3.1 `ThemeRuntime` — Cœur du système

- **Rôle** : orkestreur central reliant registry, store, cache, injector, resolver, event bus
- **API** :
  - `registerTarget(registration)` — déclare un nouveau type de cible
  - `registerTheme(manifest)` — enregistre un thème (validé par Zod `ThemeManifestSchema`)
  - `getTheme(themeId)` / `listThemes()` — lecture du catalogue
  - `getAssignment(target)` — état actuel d'une cible
  - `assignTheme(target, themeId, options)` — persiste + applique
  - `unassignTheme(target)` — retire + fallback
  - `apply(ctx)` — résolution complète + compilation + injection + événement
- **Factory** `createThemeRuntime()` wire automatiquement l'event bus (`DomainEventBus`, `EventStore`, `EventSchemaRegistry`)

### 3.2 `ThemeResolver` — Résolution en étapes

Pipeline en 4 étapes atomiques :

1. **`resolveTarget(ctx, registry)`** — vérifie que le type de cible est enregistré
2. **`resolveAssignment(ctx, store)`** — charge l'assignation pour la cible
3. **`resolveThemeId(ctx, assignment)`** — parcours de la chaîne de précedence `[entity, user, application, platform]`
4. **`resolveMode(ctx, assignment, defaultMode)`** — user → application → assignment → default (`"system"`)
5. **`resolveInheritance(decision, mode, deps)`** — chargement manifeste, vérification version, héritage

- **Précedence configurable** : `ThemeResolutionContext.precedence` permet de surcharger l'ordre
- **Version Semver** : `satisfiesVersion("^1.2.3", "1.3.0")` → `true`, support `0.x` locking
- **Gestion d'erreurs** : `ThemeNotFoundError`, `ThemeVersionError` capturés et retournés dans `ThemeResolutionOutcome.error`

### 3.3 `ThemeInheritanceResolver` — Héritage

- **Algorithme** : parcours récursif de `manifest.extends` avec détection de cycle (pile de visités)
- **Deep merge** : le manifeste enfant surcharge le parent à toutes les profondeurs
- **Fonction standalone** : `resolveThemeInheritance(themeId, mode, load)` utilisable sans instance

### 3.4 `ThemeCompiler` — Tokens → CSS Variables

- **Flatte** la structure hiérarchique de tokens en CSS custom properties `--mx-{group}-{key}`
- **Mapping de groupes** : `colors` → `color`, `typography` → `typography`, `spacing` → `space`, `radius` → `radius`, `shadows` → `shadow`, `motion` → `motion`
- **Overlay par mode** : `tokensWithModeOverlay(manifest, mode)` merge les tokens de `manifest.modes[mode]` sur les tokens de base
- **Coercion de valeurs** :
  - `number` → `"${value}px"` (sauf unitless : opacity, z-index, line-height, font-weight, order, flex)
  - `boolean` → `"1"` / `"0"`
  - `string` → tel quel
- **Validation de sécurité** : rejet des séquences malveillantes (`;`, `}`, `data:`, `expression()`)
- **Déterministe** : clés triées, output stable pour le cache

### 3.5 `ThemeCache` — Cache LRU

- **Clé** : `"${themeId}:${version}:${mode}"`
- **Max 100 entrées**, éviction LRU (first-in-when-accessed)
- **Invalidate** : par thème, version, mode, ou global
- **Get touche** : réordonne l'entrée comme "récent"

### 3.6 `ThemeInjector` — Injection CSS runtime

- **Registre de racines** : `register(root)`, `unregister(root)`, support `HTMLElement`, `ShadowRoot`
- **Diff intelligent** : compare `previous` vs `next` compilé, n'applique que les changements
- **Batching** : si `< 40` racines → flush immédiat, sinon `requestAnimationFrame`
- **Style.setProperty** : injection via CSS custom properties sur `<style>` tag

### 3.7 `ThemeSDK` — API progressive 3 niveaux

| Niveau | Usage | Méthodes |
|--------|-------|----------|
| **L1 — Consumer** | Consommateur basique | `get(target)`, `watch(target, listener)` |
| **L2 — Resolution** | Résolution contextuelle | `resolve(context)` |
| **L3 — Admin** | Gouvernance | `targets.register/get/list`, `catalog.list/get/discover`, `assign()`, `unassign()` |

- **Watchers** : écoute par cible, notification via `notifyWatchers(payload)`, cleanup par retour de fonction
- **Auto-discovery** : `catalog.discover("themes")` scanne le répertoire et enregistre les thèmes valides

### 3.8 Stores

#### `InMemoryThemeAssignmentsStore`
- Map `type:id → ThemeAssignment`
- Validation Zod à l'assignation
- `seed(assignments)` pour initialisation sans émission
- `onMutation` listener pour les événements `theme.assignment.changed`

#### `PostgresThemeAssignmentsStore`
- Table `theme_assignments` : `target_type`, `target_id`, `theme_id`, `mode`, `version`, `source`, `updated_at`, `updated_by`
- `init()` : charge tout en cache mémoire au démarrage
- `assign()` : validation + cache + `INSERT ... ON CONFLICT DO UPDATE` (fire-and-forget)
- Index unique sur `(target_type, target_id)`

### 3.9 Migration `ThemeAssignmentsMigrationProvider`

- **ID** : `core.theme.v1.001_create_theme_assignments`
- **Table** : `theme_assignments` avec 2 index + 1 unique constraint
- **Down** : `DROP TABLE theme_assignments`

### 3.10 Slot Resolution Engine (`resolve-slot.ts`)

- **5 niveaux de précedence** :
  1. `parent-default` (thème parent)
  2. `theme` (thème actif)
  3. `app-non-owner` (app non propriétaire)
  4. `app-owner` (app propriétaire du route)
  5. `tenant` (surcharge tenant — le plus élevé)
- **Shell routes** : `/`, `/login`, `/register`, `/errors/*` — les overrides d'app ne s'appliquent pas
- **Détecteur d'ambiguïté** : si 2 apps revendiquent le même route avec la même longueur de pattern → `ThemeError`

### 3.11 Hierarchy d'erreurs

```
KernelError (code, message, details)
  └─ ThemeError (THEME_NOT_FOUND | THEME_CYCLE | THEME_VERSION |
                 THEME_VALIDATION | THEME_COMPATIBILITY |
                 THEME_AUTHORIZATION | THEME_INJECTION)
      ├─ ThemeNotFoundError
      ├─ ThemeCycleError
      ├─ ThemeVersionError
      ├─ ThemeValidationError
      ├─ ThemeCompatibilityError
      ├─ ThemeAuthorizationError
      └─ ThemeInjectionError
```

### 3.12 Cibles BAC (`bac-theme-targets.ts`)

6 types de cibles pré-enregistrés avec capacités :

| Type | UserSelectable | AdminConfigurable |
|------|---------------|-------------------|
| `space` | ✅ | ✅ |
| `store` | ✅ | ✅ |
| `organization` | ❌ | ✅ |
| `user` | ✅ | ❌ |
| `application` | ❌ | ✅ |
| `platform` | ❌ | ✅ |

---

## 4 Thèmes disponibles (`themes/`)

### 4.1 Liste des 20 thèmes

| ID | Nom | `extends` ? | Modes |
|----|-----|------------|-------|
| `arctic` | Arctic | ❌ | light, dark, high-contrast |
| `aurora` | Aurora | ❌ | light, dark, high-contrast |
| `cobalt` | Cobalt | ❌ | light, dark, high-contrast |
| `copper` | Copper | ❌ | light, dark, high-contrast |
| `desert` | Desert | ❌ | light, dark, high-contrast |
| `forest` | Forest | ❌ | light, dark, high-contrast |
| `lime` | Lime | ❌ | light, dark, high-contrast |
| `luxury` | Luxury | ❌ | light, dark, high-contrast |
| `midnight` | Midnight | ❌ | light, dark, high-contrast |
| `midnight-ocean` | Midnight Ocean | ❌ | light, dark, high-contrast |
| `monochrome` | Monochrome | ❌ | light, dark, high-contrast |
| `mosaix-default` | MosaiX Default | ❌ | light, dark, high-contrast |
| `nordic` | Nordic | ❌ | light, dark, high-contrast |
| `ocean` | Ocean | ❌ | light, dark, high-contrast |
| `paper` | Paper | ❌ | light, dark, high-contrast |
| `plum` | Plum | ❌ | light, dark, high-contrast |
| `sage` | Sage | ❌ | light, dark, high-contrast |
| `sunset` | Sunset | ❌ | light, dark, high-contrast |
| `terracotta` | Terracotta | ❌ | light, dark, high-contrast |
| `_template` | Template | ❌ | (référence) |

**Aucun thème n'utilise `extends`** — l'héritage est implémenté mais non exploité dans le catalogue actuel.

### 4.2 Structure d'un thème

```
themes/{theme-id}/
├── theme.json              # Manifeste (id, name, version, tokens, modes, ...)
├── preview.png             # Image d'aperçu (requise par CI)
├── tokens/
│   ├── base.json           # Tokens de base (light)
│   └── dark.json           # Overlay tokens dark mode
├── slots/
│   ├── header.html
│   ├── footer.html
│   └── hero.html
├── settings.schema.json    # Schéma JSON Schema des options configurables par tenant
├── rtl.css                 # Styles RTL
└── README.md
```

### 4.3 Tokens Tailwind MDC

Chaque thème inclut des tokens **Tailwind Material Design Color** dans :

- `tokens.tailwind` (dans `theme.json`) : ~20 couleurs MDC (`surface`, `surface-container-lowest`, `surface-container-highest`, `on-surface`, `on-surface-variant`, `primary-container`, `outline`, `outline-variant`, etc.)
- Ces tokens sont présents dans le mode de base ET dans les overlays `dark` et `high-contrast`
- **Intégration Tailwind** : les tokens sont disponibles en tant que CSS custom properties (`--mx-...`) et peuvent être consommés par Tailwind via `var(--mx-...)`

### 4.4 Overlay par mode

Chaque thème définit systématiquement 3 modes :

| Mode | Couverture |
|------|-----------|
| `light` | Couleurs spécifiques (background, surface, text, textMuted, border) |
| `dark` | Couleurs + Tailwind MDC tokens complets |
| `high-contrast` | Couleurs max contraste + Tailwind (fond noir, texte blanc) |

### 4.5 Settings Schema

Le template définit un schéma JSON Schema pour les options configurables par tenant :

```json
{
  "brandAccent": { "type": "string", "default": "#4f46e5" },
  "borderRadius": { "type": "string", "default": "12px" },
  "enableHeroBanner": { "type": "boolean", "default": true }
}
```

---

## 5 Schémas de validation Zod (`packages/schemas/`)

| Schéma | Rôle |
|--------|------|
| `ThemeTargetSchema` | `{ type: non-empty, id: non-empty }` |
| `ThemeManifestSchema` | `{ id, name, version (semver), tokens?, modes?, assets? }` |
| `ThemeAssignmentSchema` | `{ target, themeId, version?, mode? (enum light/dark/system), source (enum) }` |
| `ThemeChangedPayloadSchema` | `{ theme, mode, version, appliedAt, target? }` |
| `ThemeAssignmentChangedPayloadSchema` | `{ target, assignment?, at, changedBy? }` |

---

## 6 Utilitaires pures (`src/theme/`)

### `resolveTokens(base, modeOverlay?, tenantOverrides?)`
- Merge shallow de 6 catégories : `colors`, `typography`, `spacing`, `radius`, `shadows`, `motion`
- Ordre : base → mode → tenant
- **Testé** : 3 tests dans `resolve-tokens.test.ts`

### `resolveSlot(ctx)`
- Déjà décrit en §3.10
- **Testé** : tests dans `resolve-slot.test.ts`

---

## 7 Couverture Tests

### Fichiers de tests

| Fichier | Sujet |
|---------|-------|
| `packages/theme/src/theme.test.ts` | Compilation, discovery (≥18 thèmes), SDK 3 niveaux |
| `packages/contracts/src/theme/theme-contracts.test.ts` | 14 type-assertions sur tous les contrats |
| `packages/contracts/src/theme/theme-events.test.ts` | 5 tests sur les événements domain |
| `packages/contracts/src/theme/theme-assignments-store.test.ts` | 2 tests sur le port |
| `src/theme/resolve-tokens.test.ts` | 3 tests sur le merge de tokens |
| `src/theme/resolve-slot.test.ts` | Tests de résolution de slots |

---

## 8 Gaps & Observations

### 8.1 Contrats vs Implémentation

| Gap | Gravité | Détails |
|-----|---------|---------|
| **`"high-contrast"` dans `modes` mais pas dans `ThemeMode`** | **Moyen** | Tous les 20 thèmes ont un overlay `high-contrast` dans `theme.json`. Le contrat `ThemeManifest.modes` accepte `{ light?, dark? }` (pas `high-contrast`). Le compilateur ne rejette pas la clé supplémentaire car `flatten()` est générique. L'overlay est compilé correctement quand `mode` n'est pas `"system"`, mais `resolveMode()` retourne `ThemeMode` qui ne contient pas `"high-contrast"` |
| **`DesignTokens` vs `theme.json` tokens réels** | **Moyen** | Le contrat `ColorTokens` définit des champs optionnels (`onPrimary?`, `onSecondary?`) qui diffèrent des clés réelles des thèmes (`primaryHover`, `secondary`, `textMuted`, `accent`, `danger`, `success`, `warning`). Le compilateur gère cela génériquement (pas de type-checking), mais le contrat ne reflète pas la réalité |
| **`ThemeManifest.modes` accepte `high-contrast`** | Mineur | Zod `ThemeManifestSchema.modes` est `z.record(z.unknown())` — pas de validation des clés. Un schéma strict devrait limiter à `{ light?, dark? }` ou inclure `high-contrast?` |
| **Héritage non utilisé** | Informationnel | `ThemeInheritanceResolver` est complet (cycle detection, deep merge) mais aucun des 20 thèmes n'a `extends`. C'est une capacité ready-to-use |
| **`BrandingProfile` non utilisé** | Informationnel | Déclaré dans `branding.ts` mais jamais importé par le runtime |

### 8.2 Points forts architecturaux

1. **Séparation stricte contracts/implementation** : les types vivent dans `@mosaix/contracts`, le runtime dans `@mosaix/theme`
2. **Validation à chaque frontière** : Zod schemas aux entrées, type-assertions (`expectTypeOf`) sur les contrats
3. **Sécurité** : le compilateur rejette les CSS injection (`;`, `}`, `data:`, `expression()`)
4. **Cache LRU** : éviction intelligente, invalidate granulaire
5. **Batching** : `requestAnimationFrame` quand >40 racines
6. **Événements tracas** : double événement (assignation → injection) pour auditabilité
7. **Port abstrait** : `ThemeAssignmentsStore` permet de remplacer InMemory par Postgres sans toucher au resolver
8. **Diff-based injection** : seul les CSS properties changées sont appliquées

### 8.3 Risques identifiés

| Risque | Impact |
|--------|--------|
| `PostgresThemeAssignmentsStore` catch silencieux | Les erreurs DB sont ignorées (`.catch(() => {})`). Le cache mémoire diverge de la base |
| `high-contrast` non typé | Si un code essaie de passer `"high-contrast"` comme `ThemeMode`, TypeScript le rejettera, mais le runtime compilera les tokens correctement |
| `resolveTokens()` (src/theme/) vs `mergeTokens()` (packages/theme/) | Deux implémentations de merge différentes. `resolveTokens` fait un shallow merge par catégorie, `mergeTokens` fait un deep merge récursif |

---

## 9 Résumé chiffré

| Métrique | Valeur |
|----------|--------|
| Fichiers sources (`packages/theme/src/`) | 18 fichiers TypeScript |
| Contrats (`packages/contracts/src/theme/`) | 14 fichiers (incl. 3 tests) |
| Schémas Zod | 5 schémas |
| Thèmes disponibles | 20 + 1 template |
| Modes par thème | 3 (light, dark, high-contrast) |
| Tokens Tailwind MDC par mode | ~20 couleurs |
| Types de cibles | 6 (space, store, organization, user, application, platform) |
| Niveaux de précedence de résolution | 4 (entity, user, application, platform) |
| Niveaux de précedence de slots | 5 (parent, theme, app-non-owner, app-owner, tenant) |
| Capteur de cache | LRU, 100 entrées max |
| Batching threshold | 40 racines |
| Tests theme-related | ~6 fichiers, couvrant contrats, runtime, SDK, compilation, slots, tokens |
| Migration DB | 1 (create `theme_assignments`) |
| Hiérarchie d'erreurs | 7 types spécialisés |
| SDK levels | 3 (Consumer, Resolution, Admin) |
