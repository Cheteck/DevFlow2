# PRD-0007 — MosaiX Shell (Experience Composition Layer)

**Statut** : Proposition — V2.1
**Priorité** : Haute

**Couche** : `src/` (racine du workspace, alias `@src/*`) — décision **Q10**
**Package principal** : aucun (`src/` n'est pas un package `@mosaix/*`)

**Packages associés** (dépendances du Shell)

* `@mosaix/contracts` (contrats `experience/*` : Surface, Slot, Contribution, Placement, Experience)
* `@mosaix/schemas` (validateurs Zod des contrats d'expérience)
* `@mosaix/core` (CompositionRuntime : Surface/Slot/Contribution registries, PolicyResolver, CompositionResolver)
* `@mosaix/sdk` (API `app.experience` : `contribute()`, `placement()`, `commands()`)
* `@mosaix/ui` (renderers / primitives — utilisé en fin de V1 sur réutilisation réelle, Q5)

> **Séparé** : le Shell ne dépend **jamais** de `apps/*` (dont `apps/governance`).

---

# 1. Révisions

Cette version fonde le périmètre du Shell sur :

* le rapport d'analyse du shell source **IJIDeals/MeshJS**
  (`.project/reports/shell-analysis-meshjs-2026-08-08.md`) ;
* les décisions verrouillées Q1–Q11
  (`.project/working/governance-questions.md`) ;
* le plan d'exécution Governance
  (`.project/working/governance-execution-plan.md`, D12/D13) ;
* la doctrine architecture (`constitution.md`, manifest/capability/event invariants) ;
* la révision architecturale « Shell Composition Model » — figée dans
  **ADR-0007** (`.project/decisions/ADR-0007-experience-composition-model.md`).

| Révision | Décision | Sections impactées |
|----------|----------|--------------------|
| R1 | Le Shell réside dans `src/` racine (alias `@src/*`), n'est **pas** un package `@mosaix/*` (Q10) | §2, §3, §4 |
| R2 | Le Shell découvre les expériences via `ExperienceContract` (Q8) ; il ne possède aucune route applicative | §5, §6, §9 |
| R3 | **Navigation URL-centric** : le pathname est la source de vérité ; le Shell est l'orchestrateur de transition, pas un routeur JS | §8 |
| R4 | Les MFE (expériences) sont chargés à la demande et montés dans des Shadow DOM isolés ; échec = fallback + retry, jamais de crash du frame | §10 |
| R5 | Résolution de composition pilotée par un resolver unique (SDK access → AuthorizationEngine) | §12 |
| R6 | Aucune donnée métier affichée en dur dans le Shell (actions/insights dynamiques via capabilities) | §14 |
| R7 | V1 sans module federation, marketplace, thèmes avancés, layout builder, drag & drop (Q10) | §4 |
| R8 | **Surface = concept de premier rang** : région déclarative du shell exposant des **slots typés** ; contrat `SurfaceContract` + `SlotContract` (ADR-0007 §1) | §5, §6, §7 |
| R9 | **Contribution = intent sémantique** (`kind` + `content` + `policies` + `placements[]`), **sans renderer** ; le Shell résout `kind → renderer` (ADR-0007 §2, §7) | §5, §7 |
| R10 | **Placement multiple** : une contribution → plusieurs `{ surface, slot }` (sidebar, toolbar, command palette) ; contrat `PlacementContract` (ADR-0007 §3) | §5, §7, §9 |
| R11 | **4 états disjoints** `registered → eligible → visible → active` ; `visibleIds` ne porte plus plusieurs sens (ADR-0007 §4) | §12 |
| R12 | **CompositionPolicyEngine** extensible (Permission, Capability, Identity, Tenant, FeatureFlag, Route, Device, Subscription, Lifecycle) + **CompositionContext** unique — le Shell ne connaît aucune règle métier (ADR-0007 §5, §6) | §12, §13 |
| R13 | **Convergence** : NavigationItem, Action, Insight, Badge, UserMenuItem, ToolbarAction, Widget, Command = kinds unifiés ; `NavigationExtension` et `surface-core` éliminés (ADR-0007 §8) | §8 |
| R14 | **Expérience déclarée, UI = projection** : l'app déclare une expérience, jamais un composant React (sauf escape hatch explicite `kind:'component'`) (ADR-0007 §11) | §5, §7 |
| R15 | Le Shell dépend de `contracts + schemas + core + ui` ; **jamais** `apps/*` (ADR-0007 §10) | §3 |
| R16 | Emplacement : `contracts/experience → schemas → core/composition → sdk/experience → apps+shell → ui` ; pas de résurrection de `@mosaix/surface-core` (ADR-0007 §9) | §3, §5 |
| R17 | **Surface ≠ layout** : `SurfaceContract`/`SlotContract` sont des **déclarations** sans aucune méthode `render/mount/unmount/hide/show/resolve` ; la mécanique vit exclusivement dans `CompositionRuntime` (ADR-0007 §1) | §5, §6 |
| R18 | **Frontière Structural/Contextual verrouillée** : le Shell possède le vocabulaire structural, les apps ne le redéclarent **jamais** ; apps → contributions aux slots structuraux + surfaces/slots contextuels (matrice d'ownership ADR-0007 §7) | §5, §7 |
| R19 | **`kind:'component'` présent dans le contrat mais désactivé par défaut** dans le RendererRegistry ; activation gouvernée explicite (ADR-0007 §2, §11) | §5, §7 |
| R20 | **P0 gated par verrouillage sémantique** : la sémantique exacte de `SurfaceContract`/`SlotContract`/`ExperienceContract` + frontière Structural/Contextual doit être figée (ticket T-SH.0.0) avant toute implémentation des registries/resolver/SDK (ADR-0007 §1, §7) | §5, §7, §17 |

Invariants du Shell (liés à la constitution) :

* Le Shell **compose** ; il n'exécute pas, ne possède pas de domaine, ne gouverne pas.
* Le Shell est une **couche**, pas une application : il ne porte aucun état métier.
* Toute expérience rendue par le Shell reste propriétaire de sa route, son domaine et sa permission.
* Le Shell doit afficher une application **sans** Governance installée.
* La Contribution est un **intent sémantique** ; l'implémentation UI appartient au Shell (`@mosaix/ui`), pas à l'application.

---

# 2. Vision

Le **MosaiX Shell** est la couche d'expérience d'exécution de la plateforme : le
cadre dans lequel les expériences des applications MosaiX sont découvertes,
composées, autorisées et montées.

Il répond à la règle à cinq responsabilités :

> **Kernel exécute. Server expose. Applications possèdent. Governance administre.
> Shell compose.**

Le Shell repose sur le **MosaïX Experience/Composition Model** (ADR-0007) :

> **Application → Contribution (intent sémantique) → Placement → Surface →
> Slot → Policy → Renderer**

Le Shell fournit concrètement :

* l'**application frame** (structure de page : rail, header, zones de contenu,
  sidebar contextuelle, menu utilisateur) — comme **composition déclarative**
  de surfaces, pas comme layout codé en dur ;
* la **navigation** entre applications et sous-routes, dont le modèle de
  permissions associé — les items de navigation étant des **contributions** de
  kind `navigation` positionnées sur des slots ;
* le **catalogue d'expériences** : découverte des expériences déclarées par les
  applications via `ExperienceContract` ;
* la **résolution de route** : quel contenu rendre pour quel path, avec quels
  paramètres ;
* la **composition à base de policies** : quel élément (navigation, action,
  widget) est **eligible** pour l'utilisateur courant, puis **visible** selon le
  layout, puis **active** selon la route — via un `CompositionPolicyResolver`
  unique ;
* le **montage des expériences** : chargement à la demande et exécution isolée
  (Shadow DOM) de l'UI de chaque application.

Le Shell est **indépendant de toute application particulière** — il fonctionne
avec une seule application, ou avec dix. Il ne connaît pas les applications par
leur identité, mais par leurs **contrats** (`ExperienceContract`,
`ContributionContract`, `PlacementContract`).

---

# 3. Positionnement dans la plateforme

```
MOSAIX PLATFORM
   ├── @mosaix/* packages     → capacités génériques réutilisables
   ├── src/ (Mosaix Shell)    → expérience d'exécution/navigation (racine, alias @src/*, découvre via contrats)
   ├── Runtime Kernel         → exécute et autorise (Control Plane porté par le kernel)
   └── Applications           → identity · sales · ... (autonomes)
       └── Governance         → application optionnelle : administre le Control Plane quand installée
```

> **Governance est une application Control Plane optionnelle. Aucune capacité
> fondamentale de MosaiX — Kernel, Shell, Server, Application Registry, routing,
> configuration ou exécution d'applications — ne doit dépendre de sa présence.
> Governance consomme et administre ces capacités lorsqu'elle est installée.**

| Couche | Responsabilité | Règle |
|---|---|---|
| Kernel | Exécute | exécute et autorise les contrats |
| `@mosaix/server` | Expose | comment les apps exposent leurs APIs |
| Applications | Possèdent | domaines, events, capabilities, expériences |
| Governance (optionnel) | Administre | découvre, active, audite ; ne rend pas |
| **Shell** | **Compose** | comment les expériences sont composées/rendues |

**Empilement du modèle de composition (ADR-0007 §9) :**

```
@mosaix/contracts/experience   → SurfaceContract, SlotContract,
                                 ContributionContract, PlacementContract, ExperienceContract
        ↓
@mosaix/schemas                → validation runtime (Zod)
        ↓
@mosaix/core                   → CompositionRuntime
                                 SurfaceRegistry | ContributionRegistry | SlotRegistry |
                                 PolicyResolver | CompositionResolver
        ↓
@mosaix/sdk                    → app.experience.contribute() / placement() / commands()
        ↓
apps/* + shell
        ↓
@mosaix/ui                     → renderers / primitives
```

**Frontières (contraintes V1) :**

* `src/` → `@mosaix/contracts`, `@mosaix/schemas`, `@mosaix/core`,
  `@mosaix/sdk`, `@mosaix/ui` : autorisé.
* `src/` → `apps/*` : **interdit** (dont `apps/governance`). Le Shell découvre via
  registres/contrats, jamais par import direct.
* `src/` ne déclare **aucune** capacité, permission ou événement : il est hors
  domaine métier.
* `src/` n'instancie pas de serveur HTTP : il est purement client/rendu.
* **Pas de `@mosaix/surface-core`** : le modèle est absorbé dans contracts +
  core/composition + sdk/experience + ui (R16).

---

# 4. Périmètre

## 4.1 Dans le périmètre V1

1. **Application frame** : structure visuelle de la plateforme (rail de
   navigation primaire, header, zone de contenu principale, sidebar contextuelle,
   menu utilisateur, footer) — **déclarée** comme surfaces/slots typés.
2. **Composition Model (Surface → Slot → Contribution → Policy → Renderer)** :
   registres, contexts, states `registered/eligible/visible/active`, résolution
   de renderer par kind et par device.
3. **Navigation** : modèle URL-centric (pathname = source de vérité), transitions
   historisées (pushState/popstate), guards de permission avant toute navigation ;
   items de navigation = contributions kind `navigation` positionnées sur les
   slots de navigation.
4. **Experience Catalog** : registre côté Shell des expériences disponibles,
   alimenté par les déclarations des applications (`ExperienceContract`), jamais
   dupliqué des registres kernel.
5. **Résolution de route** : mapping path → expérience (exact puis paramétré),
   avec paramètres typés (`:id`, `:tab`...).
6. **Composition à base de policies** : Permission, Capability, Identity,
   Tenant, FeatureFlag, Route, Device (5-7 types en V1).
7. **Placements multiples** : une commande/action déclarée peut être projetée
   dans plusieurs surfaces (menu utilisateur, toolbar, command palette).
8. **Montage des expériences** : chargement paresseux (dynamic import), montage
   dans un Shadow DOM isolé, cycle de vie `mount`/`unmount`, fallback d'erreur +
   retry, loader de chargement.
9. **Header & user experience** : identité courante, switch de compte/espace,
   recherche globale (fédérée), thème (base), sélecteur de langue.
10. **Command surface** : command palette de base (`Ctrl/Cmd+K`) projettant les
    contributions kind `command` (minimum : ouvrir une expérience / exécuter une
    action déclarée).
11. **Accessibilité** : navigation clavier du rail, ARIA (role=tablist/menu),
    skip-link, focus management après transition.
12. **Responsive** : breakpoints desktop/mobile, drawer mobile, comportements
    collapse — le DevicePolicy alimente le `CompositionContext`.

## 4.2 Hors périmètre V1 (différé)

| Sujet | Raison |
|---|---|
| Module Federation | un loader adapter, pas le mécanisme d'isolation (Q10) |
| Marketplace d'expériences/plugins | dépend de la Phase 5 roadmap (extension platform) |
| Thèmes avancés / layout builder / drag & drop | roadmap Phase 3+ (Experience System) ; slots typés fixes en V1 |
| Icon/Font Registry, Accessibility Service complet | roadmap Phase 3+ |
| Rendu des expériences tierces intégré à Governance | Q8 : Governance administre/catalogue, ne rend pas |
| `@mosaix/ui` (extraction de primitives) | Q5 : fin de V1, sur réutilisation réelle ≥ 2 |
| Policies avancées (Subscription, Lifecycle, dynamiques) | ADR-0007 §5 : 5-7 types fixes en V1, extensibilité prévue |

---

# 5. Modèle de contrat d'expérience (contracts/experience)

Tous les contrats vivent dans `@mosaix/contracts/experience` et sont validés par
`@mosaix/schemas`. C'est la seule porte d'entrée des applications vers le Shell.

## 5.1 SurfaceContract

```ts
interface SurfaceContract {
  id: string;                    // "shell" | "navigation" | "header" | "sidebar" | "content" | "overlay" | "<appId>:<surface>"
  kind: "structural" | "contextual";   // chrome du shell vs dépend de la page/domaine
  title: string;
  slots: string[];               // ids des slots exposés
  acceptsKinds?: ContributionKind[];  // restriction optionnelle de kinds
}
```

**R17 — Surface ≠ layout.** `SurfaceContract` est une **déclaration** (donnée
descriptive). Elle n'expose **aucune** méthode d'exécution : pas de
`render()`, `mount()`, `unmount()`, `hide()`, `show()`, `resolve()`. Toute la
mécanique (registres, résolution, ordre, cache) vit dans le `CompositionRuntime`
(§6). Violer cette séparation = ressusciter `surface-core`.

**Surfaces nominales (structural, déclarées par le Shell via `SurfaceManifest`) :**

| Surface | Rôle | Slots typiques |
|---|---|---|
| `navigation` | rail/barre de navigation | `navigation.primary`, `navigation.secondary` |
| `header` | header global | `header.leading`, `header.center`, `header.trailing` |
| `sidebar` | sidebar contextuelle | `sidebar.header`, `sidebar.navigation`, `sidebar.actions`, `sidebar.insights`, `sidebar.footer` |
| `content` | zone de contenu principale | `page.toolbar`, `page.actions`, `page.inspector`, `page.content` |
| `overlay` | zones superposées | `overlay.notifications`, `overlay.command-center`, `overlay.modal` |

## 5.2 SlotContract

```ts
interface SlotContract {
  id: string;                    // "sidebar.actions", "header.trailing", "page.inspector"...
  surface: string;               // surface mère
  title: string;
  acceptsKinds: ContributionKind[];   // kinds acceptés dans ce slot
  order?: number;                // position par défaut dans la surface
  collapsible?: boolean;
  maxItems?: number;             // garde-fou (eviter surcharge)
}
```

Le Slot est le **point de composition typé** : une contribution n'est
`placement`-able que si son `kind` est accepté par le slot cible.

## 5.3 ContributionContract — intent sémantique (R9)

```ts
type ContributionKind =
  | "navigation"        // item de navigation (label, icon, route)
  | "action"            // action (label, icon, invoke)
  | "insight"           // métrique/statut (label, valueSource)
  | "badge"             // pastille (countSource)
  | "avatar"            // avatar/profil
  | "section"           // groupe de contenu
  | "widget"            // widget de dashboard
  | "command"           // commande globale (id, label, shortcut, action)
  | "component";        // ESCAPE HATCH : UI arbitraire (réservé, justifié)

interface ContributionContract {
  id: string;                    // "<appId>:contribution:<name>"
  appId: string;
  kind: ContributionKind;
  content: {                     // données sémantiques (pas d'UI)
    label?: string;
    icon?: string;               // id d'icône (registry futur)
    route?: string;              // pour navigation
    badgeSource?: string;        // capacité/événement alimentant un badge
    valueSource?: string;        // capacité alimentant un insight
    invoke?: string;             // id d'action/capabilité à déclencher
    ...
  };
  policies: CompositionPolicy[];       // ADR-0007 §5 (anciennement permissions/caps/scope)
  placements: Placement[];             // R10 — une contribution → plusieurs slots
  metadata?: Record<string, unknown>;  // étendue libre, validée par schéma per-kind
}
```

**Le renderer est exclu du contrat** (R9/R14). L'application ne dit jamais
« rends ce composant » — sauf escape hatch `kind:'component'`
(`content.component`). **R19** : ce kind est **présent dans le contrat mais
désactivé par défaut dans le RendererRegistry** (§7.1) ; son activation est
une décision gouvernée (audit, justification, autorisation explicite),
jamais le chemin normal.

## 5.4 PlacementContract (R10)

```ts
interface Placement {
  surface: string;               // surface cible
  slot: string;                  // slot cible
  order?: number;                // tri ascendant
  priority?: number;             // départage à order égal (desc)
  group?: string;                // groupement optionnel
  variant?: string;              // variante spécifique au placement
}
```

**Une contribution est projetée dans plusieurs couples `{ surface, slot }`** :
ex. une commande `create-role` est projetée dans `sidebar.actions`,
`page.toolbar` et `overlay.command-center` via plusieurs placements distincts.
Une contribution n'est **jamais** « attachée » à une surface : le placement est
le couple discret `{ surfaceId, slotId }` (ADR-0007 §3).

## 5.5 ExperienceContract (Q8)

```ts
type ExperienceKind = "admin" | "navigation" | "dashboard" | "shell" | "detail" | ...;

interface ExperienceContract {
  id: string;                     // "<appId>:experience:<name>"
  application: string;            // appId propriétaire
  kind: ExperienceKind;
  title: string;
  description?: string;
  route?: string;                 // sous-route de l'app (ex. "/admin/identity/users")
  mount?: { bundle: string; entry: string };  // point de montage de l'expérience (MFE)
  requiredPolicies?: CompositionPolicy[];
  contributions?: ContributionContract[];     // expériences annexes positionnées par placements
}
```

**Règles du catalogue (contrat) :**

* `id` = espace local : l'application déclare `experience/` dans son propre
  namespace ; l'identité complète est préfixée du `appId` par la couche de
  composition (même principe que R8 migrations).
* Validation au chargement par `@mosaix/schemas` (Zod). Une expérience invalide
  est rejetée + logguée, jamais crashante.
* Le Shell ne crée **aucun** registre parallèle : il projette le
  `ExperienceCatalog` (lui-même alimenté par les registres kernel) ou écoute les
  événements de registration (équivalent `kernel:app:registered`).
* Deux applications ne peuvent pas déclarer le même `id` complet ; collision →
  rejet avec erreur explicite.

---

# 6. Découverte & composition runtime

## 6.1 Flux de découverte

```
Bootstrap du Shell
   │
   ├─ 1. Récupère la liste des applications enregistrées (SDK → AppRegistry)
   ├─ 2. Pour chaque app : lit ses expériences + contributions (ExperienceContract)
   │      └─ valide (schemas) + enregistre dans CompositionRuntime
   ├─ 3. Le Shell déclare son SurfaceManifest (surfaces structurales + slots)
   ├─ 4. Récupère l'identité courante + capacités → CompositionContext
   ├─ 5. Résolution : pour chaque contribution, évalue les policies → eligible
   ├─ 6. Montre/rend : états visible/active selon layout + route
   └─ 7. Monte le frame + la première expérience (route courante)
```

## 6.2 CompositionRuntime (@mosaix/core)

| Registre | Rôle |
|---|---|
| `SurfaceRegistry` | surfaces connues (structurales du shell + contextuelles des apps) |
| `SlotRegistry` | slots par surface + kinds acceptés |
| `ContributionRegistry` | toutes les contributions enregistrées (par app) |
| `PolicyResolver` | évalue les policies d'une contribution contre le context |
| `CompositionResolver` | orchestre : registre → policies → placements → renderer |

Le `CompositionResolver.resolve(slot, context)` retourne les contributions
**eligible + visible + triées** pour un slot donné, prêtes au rendu. Le Shell
(et ses composants) ne font que **projeter** ce résultat.

**R17 (rappel)** : les registres manipulent des **déclarations**
(`SurfaceContract`/`SlotContract`), jamais des classes à vie d'exécution.
Chaîne inviolable du rendu : `Shell → CompositionResolver → contributions
résolues → RendererRegistry → UI` — et **jamais**
`Surface → renderer → composant`. C'est cette séparation qui permet à MosaiX
de survivre à plusieurs générations de frontend (ADR-0007 §9).

---

# 7. Rendu & renderers (UI = projection)

## 7.1 Résolution kind → renderer

Le Shell possède un **Renderer Registry** : `kind × device → composant`.

```
kind = "action"
   device = desktop → Button
   device = tablet  → CompactButton
   device = mobile  → ActionSheetItem
   surface = command-center → CommandItem
```

| Kind | Renderer par défaut | Via |
|---|---|---|
| `navigation` | NavItem (rail / menu) | `@mosaix/ui` primitives |
| `action` | ActionButton / SidebarActionButton | `@mosaix/ui` |
| `insight` | InsightCard / SidebarInsight | `@mosaix/ui` |
| `badge` | Badge | `@mosaix/ui` |
| `avatar` | Avatar | `@mosaix/ui` |
| `section` | Section | `@mosaix/ui` |
| `widget` | WidgetCard | `@mosaix/ui` |
| `command` | CommandItem (palette) | `@mosaix/ui` |
| `component` | — (**désactivé par défaut** — R19) | dynamic import |

**Règle** : 90 % des contributions passent par des contrats sémantiques ; le
`kind:'component'` est un mécanisme avancé **désactivé par défaut dans le
RendererRegistry**. Son activation exige une décision gouvernée explicite
(autorisation tracée, audit, justification) — jamais le chemin normal.

## 7.2 Surfaces structurales vs contextuelles

**R18 — Frontière verrouillée (ADR-0007 §7).**

- **Structural** : déclarées par **le Shell** (navigation, header, sidebar,
  usermenu, footer). Toujours présentes, remplissables par les apps — qui
  peuvent **contribuer** à leurs slots mais jamais **redéclarer** ces surfaces.
- **Contextual** : déclarées par les **apps**, attachées à l'expérience ou au
  domaine courant (`page.toolbar`, `entity.actions`, `dashboard.widgets`). Ex.
  Governance : `role-management` déclare ses surfaces contextuelles et compose
  `toolbar.search`, `toolbar.create-role`, `content`, `inspector.permission-summary`.

**Matrice d'ownership — qui déclare quoi :**

| Élément                          | Shell | Application |
|----------------------------------|:-----:|:-----------:|
| Structural Surface               | ✅    | ❌          |
| Structural Slot                  | ✅    | ❌          |
| Contribution vers slot structural (ex. `header.trailing`) | ❌ | ✅ |
| Contextual Surface               | ❌    | ✅          |
| Contextual Slot                  | ❌    | ✅          |
| Contribution                     | ❌    | ✅          |
| Placement                        | ❌    | ✅          |
| Renderer standard                | ✅    | ❌          |
| Experience                       | ❌    | ✅          |
| Policy déclarée                  | ❌    | ✅          |

Une app **ne peut pas** déclarer `Surface: shell.header` ni redéfinir le
header ; elle contribue seulement à `header.trailing`.

---

# 8. Modèle de navigation

> **Décision R3** : une seule source de vérité — le **pathname** de l'URL.
> Le Shell est l'**orchestrateur de transition** ; il n'y a **pas** de routeur JS
> dans le hot path. La liste de navigation est une **composition** (contributions
> kind `navigation` positionnées sur `navigation.primary`/`navigation.secondary`).

## 8.1 Convention de route

```
/<appId>[/<sous-route>]
```

* `<appId>` = premier segment ; c'est l'identité de l'application.
* `<sous-route>` = espace libre de l'application (le Shell ne l'interprète pas).
* Path vide → app par défaut (ex. `home`) ; sans session → écran de connexion.

## 8.2 Cycle de navigation

```
Utilisateur clique (ou app émet mosaix:navigate)
   │
   ▼
1. Shell.navigate(appId[:sous-route])
   │
   ├─ 2. Guard d'accès à l'expérience (CompositionResolver)
   │       └─ échec → événement "route:forbidden" + écran AccessDenied (ou redirect signin)
   │
   ├─ 3. history.pushState (URL mise à jour)
   ├─ 4. transition → montage/démontage de l'expérience cible (lazy + shadow)
   ├─ 5. mise à jour du contexte actif (appId, params, capabilities) → re-composition
   └─ 6. mise à jour SEO/title + focus #main-content
```

## 8.3 Guards — point unique

* Guard de navigation écouté à la racine : `shell:navigate:requested`.
* Vérification : `composition.assertAccess(experience, context)` — le **même**
  chemin que l'éligibilité (un seul helper, un seul `PolicyResolver`).
* Résultat : `allowed | not_authenticated | insufficient_permission`.

## 8.4 Composants de navigation (rendus)

| Composant | Rôle |
|---|---|
| Rail primaire | contributions kind `navigation` triées par `order` ; logo en tête ; actions en bas |
| NavItem | bouton icône + label + badge + état **active** (route courante) ; `role=tab`, `aria-selected` |
| Header breadcrumb/sous-titre | titre de l'app courante + expérience courante |
| Sidebar contextuelle | contributions de l'app active sur les slots `sidebar.*` (header / actions / insights / footer), groups prédéfinis, collapse (desktop) + drawer (mobile) |

## 8.5 Entrées de navigation externes (canal MFE)

Le Shell écoute l'événement DOM `mosaix:navigate` (CustomEvent,
`detail.event = "appId:sous-route"`) : canal d'entrée pour qu'une expérience
déclenche la navigation sans import du Shell. Le Shell est le **seul** émetteur
vers `history` ; les apps n'appellent jamais `pushState` pour changer
d'application (elles restent libres dans leur propre sous-route).

---

# 9. Command surface (commandes globales)

Contributions de kind `command` → palette de commandes (`Ctrl/Cmd+K`) :

```ts
{
  kind: "command",
  content: { id: "governance.create-role", label: "Create role",
             shortcut: "mod+shift+r", invoke: "governance.roles.create" },
  placements: [
    { surface: "overlay", slot: "overlay.command-center", order: 20 },
    { surface: "sidebar", slot: "sidebar.actions", order: 5 },
  ]
}
```

Le Shell projette la même commande dans : menu utilisateur, toolbar, command
palette, contexte, mobile action sheet. **Une contribution → plusieurs
surfaces** (R10). En V1 : palette minimale (ouvrir une expérience, exécuter une
action déclarée). Pas de recherche sémantique avancée.

---

# 10. États de la plateforme

| État | Déclencheur | Rendu |
|---|---|---|
| `loading` | bootstrap en cours | écran de chargement (spinner + message) |
| `setup_required` | plateforme non configurée | assistant de configuration (si autorisé) |
| `ready` | frame complet | rail + header + expérience active + menu utilisateur |

---

# 11. Montage des expériences (MFE isolé)

## 11.1 Cycle de vie

```
ShellStage (expérience active)
   │
   ├─ 1. Résolution de la route → { appId, expérience, params }
   ├─ 2. Check d'accès (même resolver §8.3) — échec → AccessDenied
   ├─ 3. Chargement à la demande (dynamic import du bundle de l'app)
   │       └─ échec → retry (1s / 2s / 4s, max 3) puis écran d'erreur + bouton Retry
   ├─ 4. attachShadow({ mode: "closed" }) → isolation DOM/CSS
   ├─ 5. Rendu de l'expérience dans la zone `content/page.content` (div[role=region][aria-label])
   ├─ 6. kernel.mount / notification (lifecycle)
   └─ 7. Démarrage : unmount différé + detachShadow (éviter conflits de commit React)
```

## 11.2 Contrat d'expérience montable

```ts
interface MountableExperience {
  mount(stage: ExperienceStage): void | Promise<void>;
  unmount(): void | Promise<void>;
}
interface ExperienceStage {
  root: HTMLElement;          // conteneur shadow
  params: Record<string, string>;
  activeAppId: string;
  theme?: unknown;            // tokens de base (variables CSS)
  context: CompositionContext;
}
```

## 11.3 Isolations garanties

* **DOM/CSS** : Shadow DOM `closed`.
* **Réseau** : l'expérience appelle son backend via `@mosaix/server` (comme toute
  app) ; pas de communication directe inter-app (règle de la plateforme).
* **Échec** : erreur de montage → écran dédié (icon + « Retry Module »),
  l'événement d'erreur est propagé (`kernel:app:error`), le reste du frame reste
  intact.

---

# 12. Composition, policies & états

## 12.1 États de composition (R11)

Quatre états **disjoints**, calculés dans l'ordre :

| État | Définition | Exemple |
|---|---|---|
| `registered` | la contribution existe dans le registre | enregistrée par l'app |
| `eligible` | satisfait toutes les policies | permission + capability + identity OK |
| `visible` | le layout/l'état courant permet l'affichage | sidebar ouverte |
| `active` | sélectionnée / route courante | nav = `/commerce` |

`visibleIds` ne porte **plus** plusieurs sens (correction du gap surface-core).

## 12.2 CompositionPolicyEngine (R12)

```ts
interface CompositionPolicy { type: string; ... }
type CompositionPolicy =
  | { type: "permission"; value: PermissionString }        // OR entre permissions
  | { type: "capability"; value: string }                  // AND entre capabilities
  | { type: "identity"; value: "personal" | "space" | "platform" }
  | { type: "tenant"; value: string | "current" }
  | { type: "feature-flag"; value: string; expected?: unknown }
  | { type: "route"; value: string }                       // pattern de route
  | { type: "device"; value: "mobile" | "tablet" | "desktop" };
```

Règles :

* **Permissions : OR** (au moins une). **Capabilities : AND** (toutes requises).
* L'ordre d'évaluation est **déterministe** en V1 (statique) ; l'extensibilité
  (Subscription, Lifecycle) est prévue par interface, pas activée.
* Absence de policies → toujours eligible (aucune permission requise).
* Le `PolicyResolver` **ne connaît aucune règle métier** : il applique les
  policies de la contribution contre le `CompositionContext`.

## 12.3 Autorité

Le Shell **n'est pas** l'autorité de sécurité (Q3). Il interroge
`AuthorizationEngine` (via SDK) et n'implémente aucune logique de décision.
Toute confiance à l'UI est interdite : le backend re-vérifie toujours (les
routes de l'app sont protégées par l'AuthorizationEngine).

---

# 13. CompositionContext

Tout rendu et toute résolution partagent **un seul** contexte (ADR-0007 §6) :

```ts
interface CompositionContext {
  tenant: TenantIdentity;
  user: { id: string; identityType: "personal" | "space" | "platform" };
  application: { activeAppId?: string };
  route: { pathname: string; params: Record<string, string> };
  device: { type: "mobile" | "tablet" | "desktop" };
  capabilities: string[];
  permissions: string[];
  featureFlags: Record<string, unknown>;
  locale: string;
}
```

**Le Shell entier est une projection de ce contexte.** Toute mutation
(route, identité, capabilities, feature flag, device) → re-composition :
`eligible` recalculé (cache invalidé), `visible`/`active` recalculés.

**Gap anti-pattern (source MFE)** : le deep-link ne doit pas créer un contexte
actif sans vérification d'accès (guard appliqué sur ce chemin).

---

# 14. Header & expérience utilisateur

## 14.1 Header global

| Zone | Contenu |
|---|---|
| `header.leading` | logo (app par défaut), nom de plateforme, titre de l'expérience courante |
| `header.center` | recherche globale fédérée |
| `header.trailing` | langue, thème, toggle sidebar, menu utilisateur, contributions des apps |

## 14.2 Menu utilisateur

* **États** : chargement / authentifié / non authentifié (SignIn/SignUp → app
  `identity`).
* **Switch de compte/espace** : liste des identités non actives → `context:changed`
  + re-composition (capabilities → eligible → contenu).
* **Liens rapides** : settings, thème + contributions `user-menu` des apps.
* **Accessibilité** : `role=menu`, `menuitem`, focus-trap, navigation clavier
  (Arrow/Home/End/Escape), fermeture hors-clic.

## 14.3 Recherche globale (fédérée)

* Registre de providers + renderers par type (`@mosaix/search` ou équivalent).
* Raccourci `Ctrl/Cmd+K`, résultats dans une page dédiée `/search?q=&type=&page=`.
* Chaque provider est une capacité ; seuls les providers autorisés répondent.

## 14.4 Contexte d'identité

* Contexte actif : `{ type: "personal" | "space" | "platform", id, label, ... }`
  (stocké localement, événements `context:changed`) → injecté dans
  `CompositionContext`.
* Le changement de contexte **recalcule** : capacités → eligible → visible.

---

# 15. Contenu dynamique (anti-pattern de la source)

Le shell source affichait des **actions/insights codés en dur** avec des valeurs
fausses (ex. « Revenue today : €2 450 »). Règle V1 :

* Aucune **donnée métier** affichée en dur dans le Shell.
* Un insight est une contribution dont la **valeur est fournie par une
  capacité** (`content.valueSource` → invocation de capacité).
* L'absence de données → état vide explicite (skeleton / « aucune donnée »),
  jamais une valeur factice.

---

# 16. Ce que le Shell reprend du shell IJIDeals/MeshJS

Le rapport `reports/shell-analysis-meshjs-2026-08-08.md` liste les points
adoptés, corrigés ou écartés :

## 16.1 Adoptés (patterns solides)

* **URL-centric** navigation + guards centralisés (single-point).
* **Découplage surfaces/contributions** — transformé en Composition Model
  (Surface → Slot → Contribution sémantique, ADR-0007).
* **Pipeline de visibilité** — généralisé en CompositionPolicyEngine (R12).
* **Mount en Shadow DOM** avec retry + fallback d'erreur isolé.
* **Rail accessible** (tablist/tab, navigation clavier, variante active).
* **Menu utilisateur en portail** avec focus-trap complet.
* **Recherche fédérée** par providers.
* **DynamicSurfaces** → `SurfaceRegistry` + surfaces contextuelles.

## 16.2 Corrigés (anti-patterns)

* **4 canaux de navigation** cohabitant (URL, router, composition, surface) →
  un seul canal : URL + catalog de contributions kind `navigation` (R3, R13).
* **Contribution « fourre-tout »** (quoi/où/comment/qui/ordre/UI mélangés) →
  intent sémantique (`kind`+`content`+`policies`+`placements[]`), renderer exclu
  (R9, R14).
* **Surface = registry+bus+pipeline** → Surface conceptuelle + slots typés (R8).
* **Double canal `surface-core` + `composition`** → convergence, un seul système
  (R13, R16).
* **Router sans hot path** (`resolveStack` jamais appelé) → le routeur devient
  registre/match + guards, orchestré par le Shell (R3).
* **`requiredRoles` déclarés mais jamais vérifiés** → supprimés du modèle V1,
  permissions/capabilities uniquement.
* **Double-guard** (middleware + AppStage re-vérifiant) → un seul resolver
  partagé (R5).
* **`hide()/show()` sans recalcul de `visibleIds`** → 4 états disjoints
  registered/eligible/visible/active (R11).
* **Valeurs métier factices** (§15).
* **Deep-link sans guard de contexte** (§13).

## 16.3 Écartés pour V1

* Rendu des 4 surfaces shell-managed simultanément → surfaces structurales +
  contextuelles, déclaratives.
* Contributions `legacy:extension` → kinds sémantiques + escape hatch
  `kind:'component'` (audité).

---

# 17. Phases & tickets

## Phase 0 — Contracts & CompositionRuntime (prérequis)

**But** : rendre la composition possible par contrat, avant tout rendu.

**Prérequis verrouillé (révision architecte ADR-0007)** : la sémantique exacte
des contrats est **figée avant toute implémentation** — c'est le ticket
T-SH.0.0. Ce qui doit être verrouillé avant d'écrire une ligne de code :

- **Surface** = région de composition déclarative, **jamais un propriétaire de
  contribution**, **sans méthodes runtime** (`render/mount/unmount/hide/
  show/resolve`). Contrat = `SurfaceContract` (données) ;
- **Slot** = point d'extension typé ; **Placement** = couple discret
  `{ surfaceId, slotId }`, jamais un attachement de contribution à une
  surface ;
- **Contribution** = intent sémantique (`kind` + `content` + `policies` +
  `placements[]`), renderer exclu, sauf `kind:'component'` désactivé par
  défaut (R19) ;
- **Frontière Structural/Contextual + matrice d'ownership** (§7.2) : le Shell
  possède le structural, les apps contribuent seulement — jamais ne
  redéclarent.

Une fois ces quatre points verrouillés (via la table des contrats ci-dessous
et les schémas Zod associés), **P0 est sûr** : registres, resolver, SDK et Shell
découlent mécaniquement des contrats.

| Ticket | Action | Fichiers | Contrats |
|---|---|---|---|
| T-SH.0.0 | **Verrouillage sémantique des contrats** (sémantique + frontière §7.2) ; revision modèle ADR-0007 ; gating P0 | ADR-0007, `packages/contracts/src/experience/*` | `SurfaceContract`, `SlotContract`, `ExperienceContract` (+ `ownedBy` Structural/Contextual) |
| T-SH.0.1 | Contrats experience (Surface/Slot/Contribution/Placement/Experience) | `packages/contracts/src/experience/*` | `SurfaceContract`, `SlotContract`, `ContributionContract`, `PlacementContract`, `ExperienceContract` |
| T-SH.0.2 | Validateurs Zod des contrats | `packages/schemas/src/experience/*` | schémas |
| T-SH.0.3 | CompositionRuntime (Surface/Slot/Contribution registries) | `packages/core/src/composition/*` | registries |
| T-SH.0.4 | PolicyResolver (7 types) + CompositionResolver | `packages/core/src/composition/*` | `CompositionPolicy`, `CompositionContext` |
| T-SH.0.5 | API SDK `app.experience` (contribute/placement/commands) | `packages/sdk/src/experience/*` | API |
| T-SH.0.6 | Tests CompositionRuntime (states, policies, placements, tri) | `packages/core/src/composition/*.test.ts` | — |

Validation P0 : une app peut déclarer une expérience + des contributions validées,
résolues (eligible/visible/active) et triées via `CompositionResolver`.

## Phase 1 — Skeleton Shell

| # | Action | Fichiers |
|---|---|---|
| T-SH.1.1 | Squelette `src/` (alias `@src`), bootstrap Shell, états loading/ready | `src/Shell.tsx`, `src/bootstrap.ts`, `src/types.ts` |
| T-SH.1.2 | Frame de base (rail + header + main vides) | `src/shell/ShellFrame.tsx` |
| T-SH.1.3 | SurfaceManifest (surfaces structurales + slots typés) | `src/shell/surface-manifest.ts` |
| T-SH.1.4 | Connexion CompositionRuntime + SDK (liste apps, context) | `src/shell/ShellComposition.ts` |
| T-SH.1.5 | Tests skeleton (render, états, manifest) | `src/**/*.test.tsx` |

Validation P1 : le Shell se monte avec zéro application et affiche l'état
`ready` (frame vide cohérent, surfaces déclarées).

## Phase 2 — Navigation & rendu des kinds

| # | Action | Fichiers |
|---|---|---|
| T-SH.2.1 | Convention de route + résolution (exact/paramétré) | `src/navigation/route.ts` |
| T-SH.2.2 | `navigate()` + guards centralisés + événements | `src/navigation/navigate.ts`, `src/navigation/guards.ts` |
| T-SH.2.3 | Hooks (currentRoute, navigation, composition) | `src/hooks/useCurrentRoute.ts`, `useNavigation.ts`, `useComposition.ts` |
| T-SH.2.4 | Renderer Registry (kind × device → composant) | `src/renderers/renderer-registry.ts` |
| T-SH.2.5 | Rail primaire + NavItem (kind `navigation`) accessible | `src/shell/ShellNav.tsx`, `src/shell/NavItem.tsx` |
| T-SH.2.6 | SEO/title sync + focus post-transition | `src/hooks/useSeoSync.ts` |
| T-SH.2.7 | Tests navigation (pushState, guards, forbidden, popstate) | `src/navigation/*.test.ts` |

Validation P2 : cliquer un item met à jour l'URL, monte la bonne expérience,
refuse les accès non autorisés (route forbidden), et restaure la route au
rechargement (popstate).

## Phase 3 — Experience Catalog & montage

| # | Action | Fichiers |
|---|---|---|
| T-SH.3.1 | Catalogue local (projection contrats → CompositionRuntime) | `src/catalog/experience-catalog.ts` |
| T-SH.3.2 | ShellStage : lazy load + retry + fallback | `src/shell/ShellStage.tsx` |
| T-SH.3.3 | Shadow mount + lifecycle mount/unmount | `src/mount/ExperienceMount.ts` |
| T-SH.3.4 | AccessDenied + erreur de montage | `src/shell/ExperienceFallback.tsx` |
| T-SH.3.5 | Tests (montage, échec, retry, démontage) | `src/mount/*.test.ts` |

Validation P3 : une expérience réelle (identity) se monte, se démonte à la
navigation, échoue proprement si bundle absent, refuse sans permission.

## Phase 4 — Composition visuelle (slots & policies)

| # | Action | Fichiers |
|---|---|---|
| T-SH.4.1 | Rendu des slots par surface (header, secondary, user-menu, content) | `src/shell/*.tsx` |
| T-SH.4.2 | PolicyResolver branché sur AuthorizationEngine (SDK access) | `src/composition/resolver.ts` |
| T-SH.4.3 | États registered/eligible/visible/active + cache/invalidation | `src/composition/states.ts`, `src/composition/cache.ts` |
| T-SH.4.4 | Surfaces contextuelles (déclarées par les apps) | `src/surfaces/contextual.ts` |
| T-SH.4.5 | Tests composition (perms OR/caps AND/scope/identities, états) | `src/composition/*.test.ts` |

Validation P4 : une contribution non autorisée n'est jamais rendue ; un
changement d'identité recalcuje l'éligibilité sans rechargement ; sidebar
fermée → visible ≠ eligible.

## Phase 5 — Header, identité, recherche & command surface

| # | Action | Fichiers |
|---|---|---|
| T-SH.5.1 | Header global + contributions header-right/trailing | `src/shell/ShellHeader.tsx` |
| T-SH.5.2 | Menu utilisateur (switch compte/espace, focus-trap) | `src/shell/UserMenu.tsx` |
| T-SH.5.3 | CompositionContext (identité, route, device, flags) + re-composition | `src/context/composition-context.ts` |
| T-SH.5.4 | Recherche globale fédérée (providers permissionnés) | `src/search/*` |
| T-SH.5.5 | Command palette minimale (kind `command`, placements multiples) | `src/command/CommandPalette.tsx` |
| T-SH.5.6 | Langue + thème (base) | `src/shell/LanguageSwitcher.tsx`, `ThemeToggle.tsx` |

Validation P5 : switch de compte → re-composition (capacités → contenu de la
sidebar) ; recherche ne répond que sur les providers autorisés ; une commande
déclarée apparaît dans palette + toolbar + menu selon placements.

## Phase 6 — Responsive & a11y

| # | Action | Fichiers |
|---|---|---|
| T-SH.6.1 | Breakpoints, drawer mobile, overlay, DevicePolicy | `src/hooks/useResponsiveShell.ts` |
| T-SH.6.2 | Skip-link, focus management, ARIA complet | `src/shell/*` |
| T-SH.6.3 | Raccourcis clavier (Ctrl+K, toggle sidebar) | `src/hooks/useGlobalShortcuts.ts` |

## Phase 7 — Intégration & DoD V1

| # | Action |
|---|---|
| T-SH.7.1 | Démo : identity + sales + expériences admin (governance) composées (kinds, placements, policies) |
| T-SH.7.2 | Le Shell affiche une app **sans** Governance installée (test d'isolation) |
| T-SH.7.3 | Tests E2E navigation + composition + permissions + responsive |
| T-SH.7.4 | Extraction candidate `@mosaix/ui` (renderers/primitives réutilisées ≥ 2) |

---

## Dépendances

```
P0 ──> P1 ──> P2 ──> P3 ──> P4 ──> P5 ──> P6 ──> P7
               P4 ──> (nécessite AuthorizationEngine ; parallèle partiel avec P2/P5)
P5 (recherche/command) consomme les kinds déclarés en P0
P0 est nécessaire avant toute intégration du Dashboard Governance (Phase 7 Governance)
```

---

# 18. Definition of Done V1

**Architecture**

- [ ] `src/` racine (alias `@src/*`), indépendant de Governance ; aucune import `src/` → `apps/*`
- [ ] Composition Model opérationnel : Surface/Slot/Contribution/Placement (ADR-0007)
- [ ] Découverte par `ExperienceContract` uniquement ; aucun registre parallèle
- [ ] Navigation URL-centric : le pathname est la source de vérité (R3)
- [ ] CompositionPolicyEngine (7 types) + CompositionContext unique (R5, R12)
- [ ] 4 états disjoints registered/eligible/visible/active (R11)
- [ ] Renderer exclu du contrat de contribution ; résolution kind × device (R9, R14)
- [ ] Montage expériences isolé (Shadow DOM) + retry + fallback (R4)
- [ ] Le Shell fonctionne avec **zéro** application et avec **n** applications

**Expérience**

- [ ] Frame complet déclaré : surfaces structurales + slots (rail, header, main, sidebar, user menu, footer)
- [ ] Surfaces contextuelles (apps) rendues dans le frame
- [ ] Menu utilisateur : switch compte/espace, liens rapides, contributions
- [ ] Recherche fédérée permissionnée ; raccourci Ctrl/Cmd+K
- [ ] Command palette minimale (kind `command`, placements multiples)
- [ ] États loading / setup_required / ready

**Sécurité**

- [ ] Guards centralisés (single-point `composition.assertAccess`) ; pas de double-guard
- [ ] Aucune donnée métier en dur ; aucune confiance à l'UI (backend re-vérifie)
- [ ] Deep-link : aucun contexte créé sans guard

**Qualité**

- [ ] Tests unitaires (composition, policies, navigation, montage) + tests E2E
- [ ] Accessibilité : skip-link, ARIA rail/menu, focus post-transition, clavier
- [ ] Responsive desktop/mobile ; budget performance (resolver check < 2 ms, cache)

---

# 19. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Shell devenant « God Object » de l'expérience | Périmètre strict §4 ; CompositionRuntime dans `@mosaix/core`, pas dans le Shell ; extraction `@mosaix/ui` en fin V1 (Q5) ; ne porte aucun état métier |
| Double source de vérité de navigation (routeur vs URL) | R3 : URL seule ; le routeur est un registre/match + guards |
| **Sur-abstraction du modèle de composition** | Slots typés fixes en V1 (pas de layout builder) ; policies limitées à 7 types ; escape hatch `kind:'component'` ; re-review après le Dashboard Governance |
| **`@mosaix/core` devenant un second kernel** | CompositionRuntime sans logique métier (invariant Kernel/arbiter) ; ne gère pas l'exécution applicative, uniquement la résolution de composition |
| Permissions dispersées (UI vs backend) | Resolver unique + AuthorizationEngine ; backend re-vérifie toujours |
| Expériences tierces rendues « dans » Governance | Q8 : Governance administre/catalogue ; le Shell rend ; jamais intégré au rendu governance |
| Placements multiples → surcharge visuelle | `maxItems` par slot, ordre/priority, tri déterministe |
| Scope creep (module federation, marketplace, layout builder) | Liste explicite hors périmètre V1 §4.2 |
| Échec d'une expérience cassant le frame | Shadow DOM + fallback + retry ; événement d'erreur propagé, frame intact |
| Migration mentale des apps existantes | API SDK `app.experience` progressive ; kinds sémantiques documentés ; legacy `renderer` → map automatique vers kinds en phase de migration |

---

# 20. Sources

* `.project/decisions/ADR-0007-experience-composition-model.md` (décision figée)
* `.project/reports/shell-analysis-meshjs-2026-08-08.md` (analyse du shell source)
* `.project/working/governance-questions.md` (Q1–Q11, verrouillées)
* `.project/working/governance-execution-plan.md` (D12/D13, phases Governance)
* `.project/roadmap.md` (Experience & Theme System, North Star, principles)
* `.project/architecture/constitution.md` (7 lois immuables)
* `.project/architecture/*-invariants.md` (manifest, capability, event)
