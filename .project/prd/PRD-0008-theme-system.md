# PRD-0008 — MosaiX Theme System

**Statut** : Proposition — V2.3 (entity-first precedence, séparation themeId/mode, périmètre Phase 1 Core+SDK+Shell)
**Priorité** : Haute (Phase 1 runtime ; Phase 2 cibles thémables & attribution)

**Couche** : Runtime Kernel (`@mosaix/core`) + Shell (`src/`, alias `@src/*`) + Control Plane/Governance (Catalog & Configuration UI)

**Package principal** : `@mosaix/core` (Theme Runtime : attribution → résolution → compilation → injection)

**Packages associés**

* `@mosaix/contracts` — contrats `theme/*` (révisés V2) + `experience/theme` + `events/*`
* `@mosaix/schemas` — validateurs Zod (manifest, target, assignment, résolution, événements)
* `@mosaix/core` — `ThemeRuntime` (`assign`/`resolve`/`compile`/`inject`/`preview`), `ThemeTargetRegistry`, `ThemeResolver`, `ThemeCompiler`, `ThemeInjector`, port `ThemeAssignmentsStore`
* `@mosaix/sdk` — `theme.*` (`get`, `watch`, `resolve`, `target`, `assign`, `preview`) ; aucune mutation directe des tokens exposée
* `@src/` (Shell) — `ThemeContext`, `ThemeProvider`, `ThemeSelector`, injection du `CompiledTheme` au montage
* Governance (Control Plane) — **Theme Catalog** + **Theme Configuration UI** + policies de configuration (Phase 2+)

> **Séparé — Phase 3+** : Theme Registry distribué / Marketplace (publication, installation, licences), Icon/Font Registries runtime, accessibility engine (AA/AAA), branding/white-label, theme builder. Ne bloque pas le MVP (§17).

---

# Révisions

| Version | Contenu |
|---------|---------|
| **V1.0** | Runtime minimal : tokens → variables CSS, héritage, modes, hot-switch. |
| **V2.0** | Couplage « Space Theme » (espace référençant un thème). |
| **V2.1** | **Révision architecturale générique** : le Theme System ne connaît **aucune** entité métier. « Space » redevient un simple `ThemeTarget`. Introduction de `ThemeTarget / ThemeAssignment / ThemeResolutionSource`. Suppression de toute primitive métier dans le noyau et les contrats. |
| **V2.2** | **Verrouillage cible de résolution** : capabilities `ThemeTargetRegistry` (`userSelectable` / `adminConfigurable`), champ `target` (et non `themeTarget`) dans `CompositionContext` (ADR-0007), `user.identityType` dans le contexte, règles d'or « pas de second kernel » et « compiler ignorant des targets ». |
| **V2.3** | **Entity-first + séparation themeId/mode** : précédence par défaut `entity > user > application > platform/default`. La **résolution du `themeId` et du `mode` sont découplées** : l'entité assigne le thème (autorité du contexte) ; la préférence utilisateur ne détermine que le `mode`. Périmètre **Phase 1 verrouillé = Core + SDK + Shell** (`@mosaix/ui` et UI de configuration hors périmètre). `ThemeAssignmentsStore` implémenté **en mémoire en Phase 1**, port persisté en Phase 2. |

**Corrections de cohérence (V2.1) :**

| Id | Constat | Correction |
|----|---------|-----------|
| C1 | `DesignTokens` sans dimension de mode | `ThemeManifest.modes?` (additif, non-cassant) |
| C2 | `ExperienceStage.theme?: unknown` (PRD-0007) | Verrouillé : `CompiledTheme = Record<string, string>` (jamais `unknown`) |
| C3 | `extends` sans sémantique | Graphe statique au chargement, DFS, cycle détecté → erreur |
| C4 | `ThemePreference.preferred` + ordre `user > app > platform` permettait à un utilisateur de faire dériver la marque | Abandonné : invariance de l'identité ; l'utilisateur ne choisit que le **mode** |
| G1 | « Space Theme » supposait une primitive `space` dans le Theme System | Supprimé : `ThemeTarget = { type, id }` générique ; `space` n'est plus qu'une valeur de `type` |
| G2 | Résolution atomique « bénéficier du thème » | Découplée : `ThemeAssignment` (cible → thème) puis `ThemeResolution` (thème eff.) |
| G3 | Capabilities de cible vagues (`configurable`) | `ThemeTargetRegistry` déclare `userSelectable` / `adminConfigurable` — « thémable » ≠ « configurable » (V2.2) |
| G4 | `themeTarget?: ThemeTarget` dans le contexte | Verrouillé : `target?: ThemeTarget` dans `CompositionContext` — l'entité de composition courante, consommée aussi par Policies/Placements/Renderers (V2.2) |
| G5 | Kernel responsable du Catalog | Verrouillé : Catalog / Preview / assignment UI = **Control Plane (Governance)**, jamais `@mosaix/core` (V2.2) |
| C5 | `ThemePreference.preferred` laissait entendre que l'utilisateur peut écraser le thème de l'entité | Verrouillé : **thème d'entité (assignment) ≠ préférence utilisateur (mode)**. L'utilisateur ne sélectionne que le `mode` ; jamais l'identité d'un thème assigné (V2.3) |
| G6 | `ThemePreference`/`ThemeResolution` suggéraient une résolution unique thème+mode | Verrouillé : **résolution découplée** — 1) `themeId` (entité → user → app → platform/default) puis 2) `mode` (préférence + capacités du thème) (V2.3) |
| G7 | Périmètre Phase 1 ambigu (UI/shell vs runtime) | Verrouillé : **Phase 1 = Core + SDK + Shell** (`src/shell/theme` : ThemeContext, useTheme, ExperienceThemeBridge). `@mosaix/ui`, catalog, UI de configuration = Phase 2+ (V2.3) |

---

# 1. Vision

> MosaiX fournit un moteur de thème générique capable d'associer un artefact
> `Theme` à n'importe quelle entité déclarée comme thémable par un projet.
> MosaiX ne définit pas les entités métier ; il fournit les contrats, la
> résolution, la compilation et l'application du thème. Le projet décide quelles
> entités peuvent porter un thème et quelles policies gouvernent sa
> configuration.

> Un Space peut être une `ThemeTarget` dans un projet, mais **`Space` n'est pas
> une primitive du Theme System**.

Le pipeline normatif est :

```
Theme (contenu) → ThemeAssignment (relation cible↔thème) → ThemeResolution
     → ResolvedTheme → Compilation → CompiledTheme → Injection → Experience
```

Le Theme System fournit :

* un **contrat de thème** (`ThemeManifest`, artefact MosaiX : validé, versionné, gouverné) ;
* un **contrat de cible** (`ThemeTarget = { type, id }`) — le concept métier est fourni par le projet, jamais par le framework ;
* un **contrat d'attribution** (`ThemeAssignment`) : « cette **entité** utilise ce thème » ;
* un **moteur** de résolution (resolve), de compilation (compile) et d'injection (inject, Shadow DOM, hot-switch ≤ 100 ms) ;
* un **port** `ThemeCatalogProvider` (découverte & preview), implémenté par le Control Plane — pas par le kernel.

Le moteur ne contient aucun `if (type === "space")`, aucun `SpaceThemeResolver`,
aucune `SpaceThemePreference`. Il manipule des **chaines** (`type`, `id`) et une
**precedence** configurable — rien de plus.

---

# 2. Architecture des packages

```
@mosaix/contracts/src/theme/*             → ThemeManifest, ThemeTarget, ThemeAssignment,
                                             ThemePreference, ThemeResolutionContext,
                                             ThemeCatalogEntry, ThemeConfigurationPolicy
@mosaix/contracts/src/events/*           → ThemeAssignmentChangedEvent, ThemeChangedEvent
@mosaix/schemas/src/theme.ts            → zod (manifest, target, assignment, events, catalog)
        ▲  (dépend de ; jamais l'inverse)
@mosaix/core/src/theme/…                → ThemeRuntime
        │                                + ThemeTargetRegistry (port d'inscription des types par le projet)
        │                                + ThemeResolver / ThemeCompiler / ThemeInjector
        ▲
@mosaix/sdk/theme/…                     → theme.get / watch / resolve / target / assign / preview
        ▲
@src/                                   → ThemeContext, ThemeProvider, ThemeSelector
        ▲
apps/ (projet)                          → déclare ses types thémables, fournit les target au contexte
```

- Filiation de dépendances : `apps → sdk → core → contracts` ; `schemas` consommé par `core`.
- **Le kernel ne dépend pas** des projets, ni de `src/`, ni d'un framework UI.
- **Aucun package spécifique à `Space`** (ni `@mosaix/core/theme/space`, ni `SpaceTheme*`).

---

## 3. Concepts fondamentaux

| Concept | Définition | Type |
|---------|-----------|------|
| **Theme** | l'artefact visuel (manifest : tokens, modes, assets, a11y, `extends`) | `ThemeManifest` |
| **ThemeTarget** | l'entité à laquelle un thème peut être associé | `{ type, id }` |
| **ThemeAssignment** | relation « cette cible utilise ce thème » | `{ target, themeId, version?, mode?, source }` |
| **ThemePreference** | préférence de l'utilisateur / de l'application (mode, pas identité) | `{ inherit, allowedModes, preferredMode? }` |
| **ResolvedTheme** | résolution finale pour une cible | `{ themedId, version, mode, manifest }` |
| **ThemeScope** | portée de résolution (source donnée priorité) | `ThemeResolutionSource` |
| **ThemeTargetRegistry** | inscription par le projet des types thémables | port runtime |

**La règle absolue (invariant) :**

```
INV-THERME-001  ThemeTarget n'est PAS un modèle métier.
                Interdit : { spaceId?, organizationId?, projectId? … }
                Autorisé : { type: string; id: string }
INV-THEME-002  @mosaix/core/theme ne contient aucune référence à une entité concrète
               (no "space", "organization", "store" dans le code de résolution).
INV-THEME-003  ThemeManifest ne contient jamais { spaceId …, } etc.
INV-THEME-004  Identité (ActiveTheme) ne peut jamais être remplacée par un préférence utilisateur.
INV-THEME-005  Un projet peut déclarer un nouveau type de cible sans modifier core ni schemas.
INV-THEME-006  ThemeTargetRegistry est un registre de contrats/résolution, PAS un second kernel
               (aucun état, aucune exécution métier, aucune policy en lui-même — V2.2).
INV-THEME-007  Le Theme Compiler ne connaît AUCUN target : compile(tokens, mode) → CompiledTheme.
               Jamais compile(entity, theme) (V2.2).
```

**Règle d'or (V2.2) :**

> **Le Theme System connaît le concept de `ThemeTarget`, mais ne connaît aucune
> entité métier concrète. `Space` peut être enregistré comme target standard,
> chaque projet peut déclarer ses propres targets via configuration ou SDK.
> Le Catalog, l'administration et les règles métier restent hors du Theme Runtime.**

---

## 4. Contrats publics

### 4.1 ThemeTarget

```ts
// Espace de noms : il est générique — aucun champ métier.
export interface ThemeTarget {
  readonly type: string;   // "space" | "organization" | "store" | "profile" …
  readonly id: string;
}

// (Phase 2 contractuelle) si l'héritage d'entités devient nécessaire :
export interface ParentableThemeTarget extends ThemeTarget {
  parent?: ThemeTarget;
}
```

### 4.2 ThemeAssignment

```ts
export type AssignmentSource =
  | "platform"      // défaut plateforme
  | "admin"         // admin/Control Plane
  | "user"          // utilisateur (mode seulement, jamais identité)
  | "application";  // déclaration applicative

export interface ThemeAssignment {
  target:      ThemeTarget;
  themeId:     string;
  version?:    string;          // semver-range (ex. "^1.0.0", "1.x")
  mode?:       "light" | "dark" | "system";
  source:      AssignmentSource;
  updatedAt?:  string;
  updatedBy?:  string;
}
```

### 4.2b ThemeTargetRegistry — capabilities par type de cible

Le projet déclare **quelles capacités** chaque type de cible expose. Le kernel ne
connaît ni `space`, ni `store`, ni `community` — il ne connaît que des
capabilités génériques. « Space » peut être enregistré comme target standard
fourni par MosaiX **sans** logique métier dans le kernel.

```ts
export interface ThemeTargetCapabilities {
  readonly userSelectable: boolean;     // un utilisateur peut choisir le thème pour cette cible
  readonly adminConfigurable: boolean;  // un admin (Control Plane) peut configurer cette cible
}

export interface ThemeTargetRegistration {
  readonly type: string;
  readonly capabilities: ThemeTargetCapabilities;
}
```

Deux surfaces alimentent le **même** registre (jamais deux systèmes) :

```ts
// Déclaratif — manifest de l'application
{ "theme": { "targets": { "space":        { "userSelectable": true,  "adminConfigurable": true },
                          "organization": { "adminConfigurable": true } } } }

// Programmatique — SDK (besoins dynamiques)
theme.targets.register({ type: "store", capabilities: { userSelectable: true, adminConfigurable: true } });
```

### 4.3 ThemePreference

```ts
export interface ThemePreference {
  /** false : l'application veut une expression dédiée (résolution en « entity »). */
  inherit:       boolean;
  allowedModes?: Array<"light" | "dark" | "system">;   // modes que l'app supporte
  preferredMode?: "light" | "dark" | "system";         // V2.3 — NE détermine QUE le mode, jamais l'identité
}
```

**V2.3 — `ThemePreference` ne peut pas écraser un thème d'entité.** La préférence
utilisateur détermine uniquement le `mode`, borné par les capacités du thème
résolu. L'identité (`themeId`) est détenue par le contexte : entité assignée →
application → plateforme → défaut (§8.1).

### 4.4 CompositionContext — cible de composition courante

Verrouillé (G4, Q-T-8) : le champ s'appelle **`target`**, pas `themeTarget`.
Le `target` représente **l'entité de composition courante** : il est consommé par
le Theme System **et** par Policies / Placements / Renderers. Le contexte unique
(ADR-0007 §6) sert toutes les résolutions de composition.

```ts
export interface CompositionContext {
  tenant: { id: string };
  user?: {
    id: string;
    identityType?: "personal" | "space" | "platform";   // (V2.2) qui est l'utilisateur
    preference?: ThemePreference;
  };
  application?: { id: string; activeAppId?: string };
  route?: { pathname: string; params?: Record<string, string> };
  target?: ThemeTarget;          // entité de composition courante (thème, policies, placements…)
  device?: { type: "mobile" | "tablet" | "desktop" };
  capabilities?: string[];
  permissions?: string[];
  featureFlags?: Record<string, unknown>;
  locale?: string;
  precedence?: ThemeResolutionSource[];   // si non fournie : défaut §8.1
}
```

Le Theme Resolver n'a besoin d'**aucune** connaissance de `Space` : il reçoit un
`target: { type: "space", id: "space_b" }` fourni par l'application (route,
session, entité chargée) et résout. Le Shell reste agnostique du type métier.

### 4.5 Sources de résolution

```ts
export type ThemeResolutionSource =
  | "user"        // mode utilisateur
  | "entity"      // thème de la cible (ThemeAssignment)
  | "application" // préférence application
  | "tenant"      // assignment d'un parent tenant (Phase 2)
  | "platform"    // thème par défaut de la plateforme
  | "default";    // thème de robustesse cash
```

### 4.6 Résolution finale

```ts
export interface ResolvedTheme {
  target?:  ThemeTarget;
  themeId:  string;
  version:  string;
  mode:     "light" | "dark" | "system";
  manifest: ThemeManifest;      // résolu (extends inclus)
}

export type CompiledTheme = Record<string, string>; // { "--mx-color-primary": "#1e73e8" }
```

### 4.7 Expériences

```ts
export interface ExperienceStage {
  root: HTMLElement;
  params: Record<string, string>;
  activeAppId: string;
  theme?: CompiledTheme;      // C2 — jamais `unknown`
}
```

### 4.8 ThemeManifest & DesignTokens

```ts
export interface ThemeManifest extends MosaixArtifactManifest {
  type: "theme";
  tokens: DesignTokens;
  modes?: { light?: DesignTokens; dark?: DesignTokens };   // C1
  extends?: string;                                        // héritage de thème (C3)
  assets?: ThemeAssets;
  accessibility?: AccessibilityProfile;
  // → Aucun champ cible métier ici.
}
```

**Invariants DesignTokens :**

- `colors.primary` requise ; valeurs brutes à compiler (jamais du CSS pré-compilé) ;
- mapping CSS déterministe `--mx-<groupe>-<token>` (`colors.primary` → `--mx-color-primary`, `spacing.md` → `--mx-space-md`, …) ;
- compilation **pure**, sans DOM ni I/O.

---

## 5. Déclaration des types thémables (le projet décide)

Le type d'entité thémable **n'est pas connu du framework à l'avance**. Le projet le **déclare** :

### Modèle A — déclaratif (manifest / config)

```jsonc
// experience.manifest.json
{
  "theme": {
    "targets": {
      "space":        { "userSelectable": true, "adminConfigurable": true },
      "organization": { "adminConfigurable": true }
    }
  }
}
```

### Modèle B — programmatique (SDK)

```ts
theme.targets.register({
  type: "space",
  capabilities: {
    userSelectable: true,
    adminConfigurable: true,
  },
  resolve: (target, ctx) => assignmentsStore.get(target),   // hooks dynamiques optionnels
});
```

### Modèle C — hybride / dynamique

```ts
theme.resolveTarget({ type: "store", id: storeId }, ctx);
// même moteur ; le type "store" a été déclaré par registration.
```

**Engagement** : une seule implémentation du **ThemeResolver** consomme le registre ; les deux surfaces (déclaratif + programmatique) alimentent le **même** `ThemeTargetRegistry`. Pas de second moteur.

---

## 6. « thémable » ≠ « configurable »

Deux décisions distinctes et **jamais mélangées** :

| Question | Responsable |
|----------|-------------|
| **Cette entité accepte-t-elle un thème ?** | le projet, en déclarant le type dans le `ThemeTargetRegistry` (`adminConfigurable` / `userSelectable`) |
| **Qui peut choisir / modifier ce thème ?** | la **policy** de configuration |

Le runtime n'a **pas** de connaissance du « qui ». Exemples :

```
Projet social :
  Space       theme-capable : vrai
              ├── owner  : configure  ✅
              ├── admin  : configure  ✅
              └── member : non        ❌

Projet commerce :
  Store       theme-capable : vrai
              ├── admin : configure ✅
              └── owner : payload interdit ❌

Projet enterprise :
  Organization theme-capable : vrai
              ├── platform-admin : configure ✅
              └── org-owner      : configure ✅
```

Ces matrices sont portées par des **policies** (§7), jamais par le Theme Runtime.

---

## 7. Réutilisation du modèle de policy (ADR-0007)

Le choix/modification du thème d'une **cible** ne crée **pas** un système d'autorisation parallèle.

```
Utilisateur
   │
   ▼  assign( target, themeId )
Theme Runtime  ──audit──► ThemeTargetRegistry (déclaration)
   │
   ▼  "Peut l'acteur X configurer la cible Y ?"
PolicyResolver (ADR-0007, chaîne unique §5)
   │
   ▼  Permission / Capability / …  →  allow | deny
```

- Les policies de configuration sont du même **policy set** (permission, capability, identity, tenant, feature-flag, …).
- Aucune décision d'autorisation dans `ThemeResolver`. Il **demande**, il n'arbitre pas.

```ts
// exemple de policy exprimée pour un type de cible :
{ target: { type: "store", id: "store_123" }, action: "theme.configure" }
```

Le runtime **traduit** la capability en terme générique (`theme.configure:<type>:<id>`) et délègue à `PolicyResolver` (ADR-0007 §5).

---

## 8. Résolution (by precedence)

### 8.1 Précedence

**Par défaut (V2.3 — entity-first, verrouillé)** :

```
 entity  →  user  →  application  →  tenant  →  platform  →  default
 thème de la cible   mode préférence   déclaration app   cible ainée (futur)   défaut plateforme   robustesse
```

Règle d'or :

> **La configuration de l'entité prime sur la préférence utilisateur lorsque
> l'utilisateur est dans le contexte de cette entité. La préférence utilisateur
> ne s'applique que si l'entité n'a pas de thème explicitement assigné.**

Le `ThemeResolver` suit `ThemeResolutionSource[]` (`ctx.precedence`) ; si absent il utilise la séquence du défaut. Le projet peut **réordonner** (ex. forcer l'entête avant le `user`).

**Séparation `themeId` / `mode` (V2.3)** : la résolution est **découplée** — l'assignation d'un thème d'entité détermine le `themeId` (autorité du contexte) ; la préférence utilisateur détermine le **`mode`** (`light`/`dark`/`system`), bornée par les capacités déclarées du thème (`modes` supportés). Un thème d'entité peut donc être **fixe** (identité) tandis que le mode reste adaptable à l'utilisateur ou au système. La cohérence est garantie dans `ThemeResolver`, `ThemePreference`, `CompositionContext` et les contrats/schemas — **une seule** précédence, jamais différente selon la couche.

### 8.2 Pipeline résolution

```
1. Tap : ctx.precedence (ou défaut)
2. Résolution du themeId (par précédence, en ordre) :
   - "entity"            → ThemeAssignment(target)  → themeId+version  (autorité, si présent)
   - "user"              → (aucun themeId — l'utilisateur ne choisit jamais l'identité)
   - "application"       → preferredTheme d'app
   - "tenant"            → cible parente tenant (Phase 2)
   - "platform"/default  → fallback plateforme / thème de robustesse
3. Résolution du mode (séparée) :
   - préférence utilisateur (preferredMode) → bornée par ThemeManifest.modes + allowedModes
   - sinon "system"
4. Résout manifest (extends, DFS ; cycle → erreur)
5. compile → CompiledTheme
```

Idempotent : même context + mêmes assignments → même thème.

### 8.3 Exemple (cible Space, projet social)

```
Page affichée dans un espace X             // Projet social
Current Experience
   ↓
ThemeResolutionContext { target: space_123 }
   ↓
Space theme assignment (space_123 → mosaix.ocean^1)
   ↓
ThemeManifest (extends + mode)
   ↓
CompiledTheme → Shadow DOM
```

Ensemble : le mode du User (dark) s'applique **par-dessus**, sans toucher à l'identité.

---

## 9. Intégration au CompositionContext (ADR-0007)

Le thème doit être une **projection du contexte**, pas une dépendance cachée du Shell.

```
Application → Contribution → Placement → Surface → Slot → Policy → Renderer → Theme
```

**Verrouillé (G4, Q-T-8 résolue)** — le champ s'appelle `target`, premier niveau du
`CompositionContext` unique (ADR-0007 §6). Il représente **l'entité de composition
courante**, pas seulement le thème — Policies / Placements / Renderers le
consomment aussi :

```ts
interface CompositionContext {
  // …
  target?: ThemeTarget;   // entité de composition courante (space, store, …)
  // …
}
```

Le `target` permet au Shell d'être **agnostique** du type métier : il consomme un
`ThemeTarget` fourni par l'application (route, session, entité chargée), le passe
au resolver, il injecte le résultat. Le même contexte sert la résolution de thème
**et** les autres résolutions de composition — pas de second contexte dédié.

**Structure proposée (V2.2) :**

```text
@mosaix/contracts/src/
├── theme/            → theme-manifest, design-tokens, theme-preference,
│                       theme-target, theme-assignment, theme-resolution,
│                       theme-events
└── experience/       → composition-context (avec target)

@mosaix/schemas/src/theme/  → theme-manifest.schema, design-tokens.schema,
                              theme-target.schema, theme-assignment.schema
@mosaix/core/src/theme/     → theme-service, theme-registry, theme-target-registry,
                              theme-assignment-store, theme-resolver, theme-inheritance,
                              theme-mode-resolver, theme-compiler, theme-cache,
                              theme-injector, theme-policy, errors
@mosaix/sdk/src/theme/      → theme-api, theme-target-api, theme-assignment-api
@mosaix/ui/src/theme/       → ThemeProvider, ThemeBoundary, ThemeToggle
src/shell/theme/            → ThemeContext, useTheme, ExperienceThemeBridge
apps/governance/theme/      → ThemeCatalog, ThemeAssignmentPanel, ThemePreview
```

---

## 10. Runtime vs Catalog vs Configuration UI

| Artefact | Responsabilité | Vit dans |
|----------|----------------|----------|
| **ThemeRuntime** | validation, résolution, héritage, compilation, cache, hot-switch, injection, résolution cible | `@mosaix/core` |
| **ThemeCatalog / Registry** | liste, métadonnées, preview, versions, publication, activation, permissions, compatibilité | **Control Plane** (`ThemeCatalogProvider` port) — pas dans le kernel |
| **ThemeConfigurationUI** | sélection entité → catalogue → preview → appliquer | applications/Governance (Phase 2+) |

Flux éventuel du canal Control Plane :

```
Entity Selector → ThemeCatalog → ThemePreview → ThemeAssignment → ThemeRuntime
```

Le kernel n'embarque ni UI, ni catalogue, ni store.

---

## 11. Héritage de thème — deux concepts

**Ne jamais confondre :**

| Concept | Exemple | Support |
|---------|---------|---------|
| **Theme inheritance** | `Thème A extends Thème B` (tokens) | Schéma V1 (`C3`) |
| **Entity theme inheritance** | `Space hérite du thème de Organization` | **Contract :`Target.parent` (Phase 2). Implémentation : hors V1, à verrouiller par ADR** |

L'héritage d'entités se résout par descente `entity` : le `ThemeAssignmentResolver` remonte
`target.parent` jusqu'à la première cible assignée **puis** chute dans la chaîne precedence.
Il reste **séparé** du mécanisme **ThemeTokens** (`extends` des manifests).

---

## 12. Cycle de vie (runtime)

| Étape | Async | Détail |
|-------|-------|--------|
| `load` | async | charge les manifests (Statique / provider) + cache `id+version` |
| `validate` | sync | Zod `.strict()` → `ThemeValidationError` (jamais cité) |
| `registerTarget` | sync | inscription d'un type par le projet (decl.-programmatic) |
| `resolve` | sync/cache | applicable cible→assignment→manifest+mode (`ResolvedTheme`) |
| `compile` | sync (pur) | tokens → `CompiledTheme` (ordre déterministe) |
| `inject` | async | mise à jour des Shadow DOM (batch, pas de global) |
| `notify` | emit | `theme.changed` après injection |

**Performance** : hot-switch ≤ 100 ms — cache `theme+version+mode`, diff calculé, > 40 shadow-roots → `requestAnimationFrame`.

---

## 13. Événements

```ts
// assignment : configuration d'une cible (Control Plane / policy-enforced)
interface ThemeAssignmentChangedEvent {
  type: "theme.assignment.changed";
  payload: { target: ThemeTarget; assignment: ThemeAssignment; changedBy: string; at: string };
}

// application : thème réellement injecté
interface ThemeChangedEvent {
  type: "theme.changed";
  payload: { theme: string; mode: string; version: string; appliedAt: string; target?: ThemeTarget };
}
```

`theme.assignment.changed` est la trace de configuration ; `theme.changed` est **après** injection.

---

## 14. Erreurs

```
ThemeError
├── ThemeValidationError    // Zod strict
├── ThemeNotFoundError      // id inconnu
├── ThemeVersionError       // semver incompatible
├── ThemeCycleError         // cycle extends
├── ThemeCompatibilityError // cible incompatible (Phase 2 : compatibility refusée)
├── ThemeAuthorizationError // deny PolicyResolver (fail-closed)
└── ThemeInjectionError     // shadow root indisponible (non bloquant, retry)
```

- Erreur d'autorisation / policy : **fail-closed** (REFUSE).
- Erreur de résolution chargement : **fail-open** (thème de robustesse, l'expérience ne crashe pas).

---

## 15. SDK — trois niveaux (V2.2)

```ts
import { theme } from "@mosaix/sdk";

/** Niveau 1 — le thème courant (expérience) */
const compiled = await theme.get();                  // CompiledTheme contexte courant
theme.watch(next => render(next));                   // souscription à theme.changed

/** Niveau 2 — résolution avancée (cas explicites) */
const ctx = { target: { type: "space", id: "space_9" }, user: { id } };
const resolved = await theme.resolve(ctx);           // ResolvedTheme

/** Niveau 3 — administration / déclaration (Control Plane) */
theme.targets.register({ type: "store", capabilities: { userSelectable: true, adminConfigurable: true } });
theme.targets.list();                                // → ThemeTargetRegistration[]
theme.targets.get("store");                          // → registration | undefined
await theme.assign({ target: { type: "space", id: "space_9" },
                     themeId: "mosaix.ocean", source: "admin" });   // → policy
await theme.unassign({ type: "space", id: "space_9" });

/** Phase 2+ : lecture + preview (Control Plane) */
const catalog  = await theme.getCatalog();
const preview  = await theme.preview("mosaix.ocean", { mode: "dark" });  // read-only
```

Le SDK n'expose aucune mutation des tokens du thème : `assign`/`unassign`
parlent via `ThemeAssignment`. Les capabilities `userSelectable` /
`adminConfigurable` sont déclarées par le projet, **jamais** décidées par le kernel.

---

## 16. Exemples de projets (démonstration de généricité)

| Projet | Cible thémable | Configureur | Thème | `@mosaix/core` |
|--------|----------------|-------------|-------|----------------|
| **A — Social** | `space` | space owner + admin | `space_123 → ocean` | **inchangé** |
| **B — Commerce** | `store` | store admin | `store_456 → dark` | **inchangé** |
| **C — Enterprise** | `organization` | platform admin | `org_1 → brand` | **inchangé** |
| **D — App seule** | aucun type thémable (`configurable:false`) | — | theme application uniquement | **inchangé** |

Aucun de ces projets n'écrit dans `@mosaix/core`. Le même kernel supporte 4 modèles différents.

---

## 17. Roadmap / Tickets

| Phase | Chantier |
|-------|----------|
| **1 (MVP)** | `ThemeManifest`+modes, `extends`, compile, cache, inject Shadow DOM, hot-switch ≤100 ms, `ThemeChangedEvent` |
| 1 | **Contracts génériques** : `ThemeTarget`, `ThemeAssignment`, `ThemeResolutionSource`, `ThemePreference` |
| 1 | `ThemeTargetRegistry` (declaratif + programmatique) |
| 1 | **`ThemeAssignmentsStore` en mémoire** (assign/unassign + events opérationnels) ; le **port** est défini, l'adaptateur persisté (Postgres etc.) est Phase 2 |
| 1 | **Shell** : `src/shell/theme` — `ThemeContext`, `useTheme`, `ExperienceThemeBridge` (consommation bout-en-bout à la frontière Shell) |
| 2 | `ThemeAssignmentsStore` persisté, résolution `tenant` parent, capabilities `theme.configure` |
| 2/3 | **ThemeConfiguration UI** : catalogue, preview, selection, assign |
| 3+ | Theme Registry/Catalog opérationnel, Marketplace, a11y engine, branding |

**Périmètre Phase 1 verrouillé (V2.3) = Core + SDK + Shell.** `@mosaix/ui`
(ThemeProvider/ThemeBoundary/ThemeToggle), le catalog et toute UI de
configuration sont **hors Phase 1** (Phase 2+).

Le **MVP** fonctionne avec : `static manifest` + `types déclarées` + `assignment` — sans Catalog ni UI. Le catalogue futur n'exige aucune modification du runtime (port management).

---

## 18. Definition of Done

**Pipeline CMD (Phase 1)** :

1. Contacts larges : aucune référence métier dans `@mosaix/core/theme` (grep `type === "space"` → résultat vide) ;
2. `ThemeTarget` / `Assignment` / `Resolution` testés (fixtures : cible de type spécifique, version, mode) ;
3. Compilation pure + injection Shadow DOM seule ; hot-switch ≤ 100 ms ;
4. `theme.assignment.changed` + `theme.changed` émis après injection ;
5. résolution `ctx.precedence` suivie (dafaut) + fallback invisible ;
6. projet à cible `space` => OK, projet à cibles `store`/`organization` => OK **sans modification kernel** ;
7. policy de configurations évaluée via `PolicyResolver` — `ThemePreference` utilisateur ne remet jamais en cause l'identité ;
8. preview read-only (aucun effet) ;
9. tests de la résolution avec des types dynamiques (fixtures : custom types) ;
10. aucun nouveau sous-système/un kernel parallèle.

---

## 19. Fixtures

- thème par défaut `mosaix.base` (tokens neutres) ;
- thème `mosaix.ocean` avec `modes.dark` ;
- chaînes `extends` 2 niveaux, avec/sans cycle ;
- projet à 4 types : `space` / `store` / `organization` / aucuns ;
- assignment à des cibles + remplacements semver ;
- users light/dark/system sur la même cible ;
- **Capability deny** (user sans `theme.configure:store:9`) → refuse.

---

## 20. Roadmap affinée

(voir §17 pour la déclinaison détaillée)

| ID | Contrat | Phase |
|--------|---------|--------|
| T-05 | Runtime (compile/hot-switch) | Phase 1 |
| T-Theme.2 | `modes` | Phase 1 |
| T-Theme.3 | `ExperienceStage.theme` (CompiledTheme) | Phase 1 |
| T-Theme.4 | `theme.changed` + SDK `get/watch` | Phase 1 |
| T-Theme.5 | Benchmark hot-switch | Phase 1 |
| T-Target.1 | Contracts génériques (`theme/*`) | Phase 1 |
| T-Target.2 | `ThemeTargetRegistry` + déclaration | Phase 1 |
| T-Target.3 | `ThemeAssignmentsStore` **en mémoire** + resolve precedence (V2.3) | Phase 1 |
| T-Shell.1 | Shell `ThemeContext` / `useTheme` / `ExperienceThemeBridge` (V2.3) | Phase 1 |
| T-Target.4 | `ThemeAssignmentsStore` persisté, policies `theme.configure`, preview | Phase 2 |
| T-Target.5 | Tenant/parent resolution | Phase 2 (ADR) |
| T-Cat.1 | `ThemeCatalogProvider` + UI Config | Phase 2/3 |
| T-Cat.2 | Marketplace / Registry | Phase 3+ |
| T-Theme.6 | Branding / plug-in | Phase 3+ |

---

## 21. Questions ouvertes — valider avec l'utilisateur

| Q | Question | Reco |
|---|----------|------|
| **Q-T-1** | Où vit le `ThemeTargetRegistry` (config applicative vs runtime) ? | Config app → registre, guard `ThemeResolver` ne voit que des `{type,id}`. |
| **Q-T-2** | `precedence` différente par portée/cible ? | Oui, ex. par préfixe (`context.rules[type]`) — Phase 2. |
| **Q-T-3** | `ThemeAssignment` doit-il être **additionné** au `CompositionContext` (§9) ? | **Verrouillé (V2.2)** : le champ `target` est un membre direct du `CompositionContext` unique (ADR-0007 §6), pas un bloc `theme: {...}`. |
| **Q-T-4** | Les modes `light` / `dark` / `system` font-ils partie du thème ou de la préférence ? | Les deux : le thème déclare ses modes supportés (`modes`) ; la préférence choisit le `mode` (V2.3 : jamais l'identité). |
| **Q-T-5** | Comment un projet déclare-t-il les entités thémables ? | **Config contractuelle extensible + registration programmatique** (modèles A/B, une surface — V2.2 : capabilities `userSelectable`/`adminConfigurable`). |
| **Q-T-6** | Le Theme Runtime connaît-il les types métier ? | **Non.** |
| **Q-T-7** | Qui décide si une entité peut être configurée ? | Le projet + policy (via PolicyResolver ADR-0007) — jamais le kernel. |
| **Q-T-8** | `ThemeTarget` doit-il être intégré au `CompositionContext` ? | **Verrouillé (V2.2)** : oui, comme champ `target` de premier niveau (entité de composition courante, partagé Theme/Policies/Placements/Renderers). |
| **Q-T-9** | Héritage de thème entre entités (parent) ? | Distinct de `extends` (thème) ; Phase 2, contractuel. |
| **Q-T-10** | Le catalogue de thèmes est-il dans le Kernel ? | **Non** — Control Plane. Le port seul reste dans `core/contracts`. |

---

## 22. Alignement avec la codebase existante

- `ADR-0007` — `CompositionContext`, `PolicyResolver` (chaîne unique, §5), modèle App→…→Renderer auquel se greffe le thème ;
- `experience-composition-protocol.md` — `ExperienceStage.theme` (`CompiledTheme`), fail-closed/open (définition `§12.2`) ;
- `PRD-0007` — T-SH.5.6 `ThemeToggle` (mode), `ExperienceStage` typé ;
- `@mosaix/contracts` + `@mosaix/schemas` — base Zod à étendre les C1–C4 et G1/G2 ;
- `capability-invariants.md`, `manifest-invariants.md` — conformité des nouveaux types de cible ;
- `ADR-0001` — domain contract layer ;
- `mosaix-packages-responsibilities.md` — filiation.

---

## 23. Points exigeant une ADR / validation architecte

Ne pas considérer acquis :

| # | Point | Action requise |
|---|-------|----------------|
| ADR-1 | Ajout du champ `target` dans `CompositionContext` (ADR-0007) | **Résolu (V2.2)** : amendement ADR-0007 §6 — `target?: ThemeTarget` = entité de composition courante |
| ADR-2 | Définition des capabilities `configuration.<type>:<id>` et règles fail-closed | Extension `capability-invariants` |
| ADR-3 | `ThemeTarget.parent` / héritage d'entités en Phase 2 | ADR distincte |
| ADR-4 | Priorité `user` vs `entity` dans la precedence par défaut | **Résolu (V2.3)** : `entity > user > application > platform/default` + séparation themeId/mode (règle d'or §8.1) |
| ADR-5 | Contrat `ThemeCatalogProvider` (port) et ownership du catalogue | Validation architecte vs ModelScope |

---

*Document principal* : `@mosaix/theme` (contrats) — lié à ADR-0007 (Composition), PRD-0007 (Shell, ThemeToggle), spec composition protocol.

---

*Révision* : V2.3 — entity-first precedence + séparation themeId/mode + périmètre Phase 1 Core+SDK+Shell — proposition (2026-08-08).
*Objectif* : le Theme System expose la mécanique ; les projets déclarent types et policies ; la Governance configure ; le Shell consomme.