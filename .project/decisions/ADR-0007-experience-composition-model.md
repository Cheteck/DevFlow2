# ADR-0007 — Experience Composition Model Architecture

- **Date :** 2026-08-08
- **Statut :** Accepted (révision architecte intégrée — sémantique des contrats verrouillée pour P0)
- **Décideurs :** Architecture Steward, Architecte externe
- **Lié à :** PRD-0007 V2.1 (`.project/prd/PRD-0007-shell-experience.md`) ;
  rapport d'analyse `.project/reports/shell-analysis-meshjs-2026-08-08.md` ;
  décisions Q1–Q11 ; Constitution (« The Runtime is an Arbiter ») ; roadmap
  (Contract-Driven Experience, Experience System)

## Context

Le shell source (IJIDeals/MeshJS) reposait sur `@mosaix/surface-core` : une
`Contribution` qui mélangeait simultanément **quoi** (kind), **où** (surface),
**comment** (renderer), **qui** (permissions/capabilities/identities/scope),
**l'ordre** (`layout.order`) et **l'implémentation UI** (`metadata.component`).
Un second système `@mosaix/composition` (NavigationExtension) coexistait avec
`Contribution type:'navigation'`, créant un double canal de navigation.

Le PRD-0007 (V1.0) n'a que partiellement résolu le conflit (R3 : URL source de
vérité) en conservant un modèle `Contribution → Surface → renderer`.

Une révision d'architecte aboutit à un modèle plus structurant : **Application →
Experience → Contribution → Placements → Surface → Slot → Policy → Renderer**,
où la Contribution devient un **intent sémantique** (kind) indépendant de son
rendu, et la Surface une **région de composition déclarative** exposant des
slots typés.

Conclusion de la révision : **ne pas ressusciter `surface-core` tel quel**, mais
absorber son idée dans le MosaïX Experience/Composition Model. Sans décision,
les risques sont : deux systèmes parallèles (navigation/composition), un
couplage des applications au shell React (renderer), plusieurs sens à la
visibilité, Governance figée sur une expérience non composable.

## Decision

Le MosaïX **Experience/Composition Model** est établi comme la seule
architecture de composition de l'expérience utilisateur. Les règles ci-dessous
font autorité pour le PRD-0007 et l'ensemble du Dashboard/Governance UI.

### 1. Surface et Slot : concepts de premier rang, purement déclaratifs

- **Surface** est une **région de composition disponible**, **pas un
  propriétaire de Contribution**. Elle expose des **Slots**.
- **Slot** est le **point d'extension typé** dans une région
  (`sidebar.actions`, `header.trailing`, `page.inspector`…). Une Surface expose
  des slots acceptant des kind précis.
- **Surface ≠ layout — règle inviolable.** `SurfaceContract` et
  `SlotContract` sont des **déclarations** (données), jamais des classes
  d'exécution. AUCUNE méthode `render()`, `mount()`, `unmount()`, `hide()`,
  `show()`, `resolve()`. Le mécanisme (registres, résolution, ordre, cache)
  vit **exclusivement** dans le `CompositionRuntime`. Violer cette séparation
  = ressusciter `surface-core`.
- Une application **ne voit que des contrats** : `SurfaceContract`,
  `SlotContract`, `ContributionContract`, `PlacementContract`,
  `ExperienceContract`, tous dans `@contracts/experience`.

**Contrat sémantique verrouillé (P0) :**

```ts
SurfaceContract {
  id: string;                    // "shell.header" | "role-management.content"
  kind: 'structural' | 'contextual';
  ownedBy: 'shell' | 'application';
  label: string;
  slots: SlotContract[];
  description?: string;
}
SlotContract {
  id: string;                    // "header.trailing" | "role-management.toolbar"
  surfaceId: string;
  accepts: ExperienceKind[];     // kinds autorisés dans ce slot
  layout?: 'single' | 'stack' | 'overflow';
  description?: string;
}
PlacementContract {
  id: string;
  surfaceId: string;
  slotId: string;
  order?: number;
  priority?: number;
  payload?: Record<string, unknown>;
}
```

Surface & Slot sont des **données** — la mécanique est dans `CompositionRuntime`
(§9).

### 2. La Contribution est un intent sémantique, pas un renderer

La Contribution porte : `kind`, `content` (données métier sémantiques),
`policies`, `placements[]`, `metadata` (libre). **Le renderer est exclu du
contrat de contribution**, sauf `kind:'component'` — qui est un escape hatch du
contrat : **présent mais désactivé par défaut dans le RendererRegistry** ; son
activation est une décision **gouvernée** (explicite, tracée, jamais silencieuse).

| kind               | renderer std (resolution kind × device)                          |
|--------------------|------------------------------------------------------------------|
| `action`           | desktop: button · tablet: compact-button · mobile: action-sheet  |
| `navigation`       | item menu / tab bar / drawer                                     |
| `insight`          | card / inline notification                                        |
| `badge`            | pill / dot · (statut)                                             |
| `avatar`           | user chip / photo                                                 |
| `section`          | panel / summary block                                             |
| `widget`           | composant dashboard (kind futur)                                  |
| `command`          | commande palette / palette commande                              |
| `component`        | **escape hatch — désactivé par défaut** (activation gouvernée)   |

### 3. Placement : une contribution → plusieurs couples { surface, slot }

Un placement est un **couple discret** `{ surfaceId, slotId, order?, priority?,
payload? }` (cf. `PlacementContract`). Une contribution n'est **pas** attachée
directement à une Surface : elle est **projetée dans le slot appartenant à la
surface**. Une application peut donc projeter la même contribution sur
`sidebar.actions` + `header.trailing` + `command-palette.commands`
simultanément, via plusieurs placements distincts.

### 4. États de composition : registered → eligible → visible → active

Quatre états disjoints, exécutés dans un ordre déterminé (v1 : statique,
mis en cache) :

1. **registered** — la contribution existe (registre des contributions).
2. **eligible** — satisfait l'ensemble des policies (permission, capability,
   identity, tenant, subscription, feature flag, lifecycle…).
3. **visible** — l'état courant (layout, device, route) permet l'affichage
   (ex. sidebar ouverte vs fermée).
4. **active** — sélectionnée/utilisée (ex. item de navigation = route courante).

Ces états ne se confondent plus dans un `visibleIds` à sémantique multiple
(correspondance du gap `surface-core`).

### 5. Policies : composition framework unique

Le « pipeline de visibilité » devient un **CompositionPolicyEngine**
extensible : `PermissionPolicy | CapabilityPolicy | IdentityPolicy |
TenantPolicy | SubscriptionPolicy | FeatureFlagPolicy | DevicePolicy |
RoutePolicy | LifecyclePolicy`.

Le shell interroge `composition.resolve(context)` : il ne connaît **aucune**
règle métier. Résultats mis en cache (permission/capability via
l'AuthorizationEngine, TTL court, invalidation sur explosion de contexte). V1 :
7 policies statiques, pas de builder.

### 6. CompositionContext unique

Tous les rendus et résolutions partagent le même `CompositionContext`. La
totalité du shell est une **projection** de ce contexte.

Le contexte porte un champ `target?: ThemeTarget` — **l'entité de composition
courante** (par ex. `{ type: "space", id: "space_b" }`). Ce champ est générique :
il est consommé par le Theme System (PRD-0008 V2.2), les Policies, les
Placements et les Renderers. Le kernel ne connaît **aucune** entité métier
concrète ; l'application (route, session, entité chargée) fournit le `target`.

```ts
interface CompositionContext {
  tenant: { id: string };
  user?: { id: string; identityType?: "personal" | "space" | "platform"; preference?: ThemePreference };
  application?: { id: string; activeAppId?: string };
  route?: { pathname: string; params?: Record<string, string> };
  target?: ThemeTarget;        // entité de composition courante (thème, policies, placements…)
  device?: { type: "mobile" | "tablet" | "desktop" };
  capabilities?: string[];
  permissions?: string[];
  featureFlags?: Record<string, unknown>;
  locale?: string;
}
```

**Décision** (V2.2) : le champ s'appelle `target`, **pas** `themeTarget`, car le
même contexte sert à résoudre Thème, Policies, Contributions, Placements,
Renderers — pas uniquement le thème.

### 7. Frontière « Structural vs Contextual » — qui possède quoi

Cette frontière est **verrouillée** :

**Structural** → déclarée par **le Shell** uniquement ; alimentée par les
Applications (contributions aux slots structurels).
**Contextual** → déclarée par les **Applications**, attachée à l'Experience /
domaine courant ; permet de contribuer au-delà du chrome.

**Règle** : *Le Shell possède le vocabulaire structural de la plateforme.
Les applications peuvent contribuer aux slots structuraux, mais ne rédéclarent
pas ces surfaces (pas de leur propre `header`, `navigation`, `sidebar`).
Les applications peuvent déclarer des surfaces contextuelles propres à leurs
expériences.*

**Matrice d'ownership** :

| Élément                          | Shell | Application |
|----------------------------------|:-----:|:-----------:|
| Structural Surface               | ✅    | ❌          |
| Structural Slot                  | ✅    | ❌          |
| Contribution vers slot structural (Placements sur `header.trailing`…) | ❌ | ✅ |
| Contextual Surface               | ❌    | ✅          |
| Contextual Slot                  | ❌    | ✅          |
| Contribution                     | ❌    | ✅          |
| Placement                        | ❌    | ✅          |
| Renderer standard                | ✅    | ❌          |
| Experience                       | ❌    | ✅          |
| Policy déclarée                  | ❌    | ✅          |

Exemple — Governance déclare `Experience: role-management`, une surface
contextuelle `role-management` avec slots `role-management.toolbar` /
`role-management.inspector` / `role-management.content`, une Contribution
`governance:create-role` placée sur `role-management.toolbar`. Elle **ne peut
pas** déclarer `Surface: shell.header`, ni le redéfinir — elle contribue
simplement à `header.trailing`.

### 8. Convergence navigation / composition

`NavigationItem`, `Action`, `Insight`, `Badge`, `UserMenuItem`,
`ToolbarAction`, `Widget`, `Command` sont absorbés comme **kinds de
contribution** (« semantic contribution kinds »). `NavigationExtension` est
éliminé ; la navigation est un kind `navigation` positionné sur les slots des
surfaces Navigation. Un seul graphique sémantique.

### 9. Imbrication dans la pile MosaïX

```
@contracts/experience   → SurfaceContract, SlotContract, ContributionContract,
                          PlacementContract, ExperienceContract
        ↓
@schemas                → validation runtime (Zod)
        ↓
@core                   → CompositionRuntime
                          SurfaceRegistry | SlotRegistry | ContributionRegistry |
                          PolicyEngine | CompositionResolver
        ↓
@sdk                    → app.experience.contribute() / placement() / commands()
        ↓
apps/* + shell
        ↓
@ui                     → renderers / primitives
```

**PAS de résurrection de `surface-core`** : le modèle est absorbé dans
`@contracts/experience` (contrats) + `@core/composition` (runtime) + `@sdk`
(API d'expérience) + `@ui` (renderers). **Aucun second kernel parallèle**.

Chaîne d'exécution inviolable :
```
Shell
  ↓
CompositionResolver
  ↓
contributions résolues
  ↓
RendererRegistry
  ↓
UI
```
— et **jamais** `Surface → renderer → composant`. C'est cette séparation qui
permet de survivre à plusieurs générations de frontend.

### 10. Le shell dépend de contracts + schemas + core + ui (jamais apps)

Le shell (résidant dans `src/`, alias `@src/*`, Q10) ne dépend jamais de
`apps/*`. Il consomme `@core` comme *bibliothèque* (`CompositionRuntime` /
résolution), jamais comme contrôleur d'application.

### 11. Expérience déclarée, UI = projection

Une application déclare « j'expose cette expérience » (contenu sémantique),
jamais « rends ce composant React ici » — sauf **escape hatch gouverné**
(`kind:'component'`, **présent dans le contrat, désactivé par défaut dans le
RendererRegistry**, activation explicite tracée). Niveaux d'abstraction :
l'application déclare l'expérience ; le shell choisit le renderer ; `@ui`
fournit les primitives. Le widget peut être échangé sans toucher aux apps.

## Consequences

**Positives**

- Suppression du double canal navigation/composition.
- Découplage apps ↔ shell (une app ne voit pas React du shell).
- Adaptatif par périphérique et projet (placements multiples).
- Governance devient une vitrine de composition (kinds, placements, policies).
- Base du Command Center / palette, dashboard composables.
- Aligné Constitution : `contracts → schemas → core → sdk → apps`.

**Coûts / Risques**

- **Contrat d'abord** : `SurfaceManifest` / `SlotContract` à définir avant le
  Dashboard Governance — à verrouiller en Phase 0 (§ contrat sémantique).
- **Risque de sur-abstraction** : plafonner V1 (slots typés fixes matrice,
  7 policies, pas de layout builder). `kind:'component'` reste disabled par
  défaut.
- Performance : résolution policy+renderer se cumule, **cache obligatoire**.
- Nécessite une migration sur les apps existantes (SDK expérience v2).
- `@core` devient plus gros ; le `CompositionRuntime` doit rester **sans
  logique métier** (invariant Kernel/arbiter).

## Alternatives considered

- (a) Conserver `surface-core` tel quel — coûts : double canal non résolu,
  renderer couplé au shell, pas de placement multi-surface, sémantique de
  visibilité multiple. → rejeté.
- (b) Absorber le modèle dans `@contracts/types` seuls — coût : types sans
  runtime, inutiles pour la composition. → rejeté.
- (c) Un nouveau package `@composition-runtime` — coûts : troisième couche
  parallèle au kernel/core ; risque d'un deuxième kernel. → rejeté : le
  runtime s'intègre à `@core`.