# Experience Composition Protocol — Spécification normative signable

- **Livrable de** : ticket **T-SH.0.0** (PRD-0007 §17, Phase 0)
- **Statut** : **PROPOSITION — en attente de signature** (aucune implémentation
  T-SH.0.1 → T-SH.0.6 avant signature, R20)
- **Décision liée** : ADR-0007 (`.project/decisions/ADR-0007-experience-composition-model.md`)
- **PRD lié** : PRD-0007 V2.2 (`.project/prd/PRD-0007-shell-experience.md`)
- **Révision** : 2.0 (2026-08-08) — révision normative, audit ambiguïtés intégré
- **Langage normatif** : RFC 2119 — `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`

## 0. Statut et portée

Cette spécification est le **protocole formel de composition de la plateforme**.
Elle fixe, pour chaque point bloquant, **un comportement observable unique** :
deux équipes indépendantes implémentant T-SH.0.1 → T-SH.0.6 à partir de ce
document **MUST** produire le même comportement.

Tout point non couvert ici est **hors contrat** : l'implémentation qui aurait
besoin d'une décision non spécifiée **MUST NOT** l'inventer — elle ouvre un
amendement de cette spécification.

La source normative initiale est l'ADR-0007. En cas de conflit entre ce document
et l'ADR-0007 ou le PRD-0007, **ce document fait autorité** pour la sémantique
de composition (il est le verrouillage exigé par R20).

---

## 1. Définitions normatives

| Terme | Définition normative |
|-------|----------------------|
| `Surface` | Région de composition déclarative (donnée, `SurfaceContract`). **Jamais** un propriétaire de Contribution, **jamais** une classe d'exécution. Aucune méthode runtime (`render`/`mount`/`unmount`/`hide`/`show`/`resolve`). |
| `Slot` | Point d'extension typé dans une surface (`SlotContract`). Déclaration, jamais une classe d'exécution. |
| `Placement` | Couple discret `{ surface, slot, order?, priority?, group?, variant? }`. Une Contribution est **projetée** via des placements ; elle n'est jamais « attachée » à une surface. |
| `Contribution` | Intent sémantique `{ id, appId, kind, content, policies, placements[], metadata? }`. Le renderer est **exclu** du contrat (sauf `kind:'component'` gouverné). |
| `Experience` | Unité de navigation d'une application (`ExperienceContract`) : identité, route, policies, contributions. |
| `CompositionContext` | **Snapshot unique et immuable** d'état utilisé pour toute évaluation (route, device, user, tenant, capabilities, permissions, flags). |
| `registered` | État persistant du `ContributionRegistry` : la contribution est enregistrée et validée. |
| `eligible` | **Projection dérivée** (avec cache) : `Eligible(contribution.policies, context) === true`. Dépend du contexte ; jamais persistée. |
| `visible` | Projection dérivée : l'état courant (layout/device/route) permet l'affichage. **Jamais une autorisation.** |
| `active` | Projection dérivée : contribution « sélectionnée » (ex. item de navigation = route courante). **Jamais persistée.** |
| `PolicyResolver` | Évalue l'algèbre des policies contre le contexte. Porte **aucune** règle métier. Point unique d'évaluation. |
| `PolicyAdapter` | Adaptateur par type de policy ; seule interface vers `AuthorizationEngine`. |
| `AuthorizationEngine` | Source de vérité des permissions/capabilities. Appelé **uniquement** par les adaptateurs. |
| `RendererRegistry` | Table `kind × device → renderer`. |
| `contractVersion` | MAJOR du protocole de contrat (rupture = incompatible). |
| `schemaVersion` | `MAJOR.MINOR` du schéma (MINOR = évolutions additives). |
| `VERSION` | Incompatibilité de version constatée (voir §11). |

---

## 2. Identité Surface / Slot / Placement

### 2.1 Format canonique des IDs

```
segment   = [a-z0-9-]+                       // minuscules, chiffres, tirets
surfaceId = segment "." segment [("." segment)*]   // ≥ 2 segments
slotLocal = segment                          // exactement 1 segment, sans point
slotId    = surfaceId "." slotLocal
prefix(x) = x privé de son dernier segment   // "a.b.c" → "a.b"

INV-ID-001 : slot.surface  === prefix(slot.id)
INV-ID-002 : placement.surface === prefix(placement.slot)
```

- **Le `slotLocal` MUST NOT contenir de point.** C'est ce qui rend `prefix()`
  **déterministe** : le préfixe d'un slot est unique.
- Les IDs sont **globaux** : le `appId` préfixe surface, slot et contribution.
  Il n'existe **aucune** résolution tardive dans les registres.
- Convention : `shell.<zone>` pour les surfaces structurales (déclarées par le
  Shell) ; `<appId>.<expérience>` pour les surfaces contextuelles (déclarées par
  les applications).

### 2.2 Source de vérité et relation `SlotContract.surface` / `SurfaceContract.slots`

**Décision normative (lève la contradiction ADR/PRD) :**

- **`SlotRegistry` est l'unique source de vérité des slots.** Chaque
  `SlotContract` déclare son `surface` ; l'invariant INV-ID-001 est **validé à
  l'enregistrement** (violation → `CONTRACT_INVALID`).
- **`SurfaceContract.slots` n'est PAS une donnée écrite.** C'est une
  **projection dérivée**, calculée par le runtime :
  `slots(surfaceId) = { s.id | s ∈ SlotRegistry ∧ s.surface === surfaceId }`.
- **Conséquence** : le champ `slots` **MUST NOT** être fourni dans un payload de
  déclaration de surface. Un payload contenant `slots` → `CONTRACT_INVALID`
  (le champ est réservé). La projection étant dérivée, les états « slot
  enregistré mais absent de l'index » et « index contredisant le slot » sont
  **impossibles par construction**.
- Ce document **remplace** la forme de `SurfaceContract.slots` de l'ADR-0007
  (array de `SlotContract[]`) et du PRD-0007 §5.1 (array de `string[]`) : la
  forme normative est la projection dérivée définie ci-dessus.

### 2.3 Enregistrement : ordre, duplications, conflits

- **Aucun ordre imposé** entre l'enregistrement d'une surface et celui de ses
  slots. Les registres sont indépendants (`SurfaceRegistry`, `SlotRegistry`).
- Un slot dont la surface n'existe pas encore est **enregistré mais orphelin** :
  il **n'est pas résolvable** (aucun placement ne peut l'atteindre) tant que sa
  surface n'existe pas. À la requête, un slot orphelin est traité comme
  **inexistant** → `COMPOSITION_INVALID` pour les placements le visant.
- **Deux surfaces ne peuvent pas posséder le même slot** : par construction,
  `slot.surface === prefix(slot.id)` est unique, et `slot.id` est unique dans le
  `SlotRegistry`.
- **Double enregistrement d'un même slot** :
  - contenu **identique** → **idempotent** (succès, no-op) ;
  - contenu **différent** → `REGISTRATION_CONFLICT` (le premier gagne).

### 2.4 Placement

```
Placement {
  surface: SurfaceId;       // MUST === prefix(slot)
  slot: SlotId;
  order?: number;           // clé de tri primaire, ascendant
  priority?: number;        // départage à order égal, descendant
  group?: string;           // label de groupement — n'affecte PAS le tri
  variant?: string;         // variante de rendu — hint, jamais un critère d'autorisation
}
```

**Tri total déterministe des contributions dans un slot** (INV-SORT-001) :

```
ordre = (order ascendant, priority descendant, contributionId ascendant)
```

- `order` absent → `0`. `priority` absent → `0`.
- Le dernier critère `contributionId` garantit un ordre **total** : aucune
  égalité parfaite possible.
- `group` n'a **aucun effet sur le tri** ; il est un label de présentation.
- `variant` : si le renderer résolu ne la connaît pas → renderer par défaut pour
  `kind × device` ; **pas une erreur**.

### 2.5 Validation des placements : quand ?

- **À l'enregistrement** (statique) : schéma + invariants structurels
  (INV-ID-002). Une incohérence `surface ≠ prefix(slot)` → `CONTRACT_INVALID`.
- **À la résolution** (existence) : le slot existe, sa surface existe, et le
  kind de la contribution est accepté par le slot. Tout manquement →
  `COMPOSITION_INVALID` (placement écarté, diagnostic, telemetry). La
  contribution reste utilisable via ses autres placements.

### 2.6 Invariants testables

```
INV-ID-001 : slot.surface === prefix(slot.id)
INV-ID-002 : placement.surface === prefix(placement.slot)
INV-ID-003 : slotLocal sans point ⇒ prefix() unique
INV-ID-004 : IDs conformes au format canonique (§2.1)
INV-ID-005 : slot.id unique dans SlotRegistry
INV-ID-006 : SurfaceContract.slots est dérivé, jamais fourni dans un payload
INV-ID-007 : double enregistrement identique → idempotent ; différent → REGISTRATION_CONFLICT
INV-SORT-001 : tri total (order asc, priority desc, contributionId asc)
```

---

## 3. Contribution Contract

### 3.1 Union discriminée exhaustive

Le contrat est une **union discriminée** (TypeScript) + **discriminated union
Zod**. Le discriminateur est `kind`.

```
type ContributionContract = NavigationContribution
  | ActionContribution | InsightContribution | BadgeContribution
  | AvatarContribution | SectionContribution | WidgetContribution
  | CommandContribution | ComponentContribution;
```

- **Tout `kind` hors de cette union → `CONTRACT_INVALID`** à l'inscription
  (INV-CONTRIB-003). Il n'existe aucun `kind` libre.
- **Tout champ inconnu dans `content` → `CONTRACT_INVALID`** (schéma strict per
  kind, INV-CONTRIB-004). Seul `metadata` accepte des clés inconnues.

### 3.2 Champs communs à toutes les contributions

```
{
  id: string;                       // "<appId>:contribution:<name>" — MUST
  appId: string;                    // propriétaire — MUST
  kind: ContributionKind;           // discriminateur — MUST
  content: KindSpecificContent;     // strict per kind — MUST
  policies: CompositionPolicy[];    // algèbre §4 — MUST (peut être [])
  placements: Placement[];          // ≥ 1 — MUST (une contribution sans placement n'est jamais composée)
  metadata?: Record<string, unknown>;  // opaque — MAY
  contractVersion: 1;               // MUST
  schemaVersion: "1.0";             // MUST
}
```

- `placements` **MUST** être non vide (`CONTRACT_INVALID` sinon) : une
  contribution sans placement ne peut jamais être composée.
- `id` **unique** dans le `ContributionRegistry` (INV-CONTRIB-001) :
  - enregistrement identique → idempotent ;
  - enregistrement différent → `REGISTRATION_CONFLICT` (premier gagne).
- Une contribution possède donc une **identité propre** ; les doublons sont
  détectés par `id`.

### 3.3 Contrats de `content` par kind (requis / optionnel / interdit)

| kind | Requis (MUST) | Optionnel (MAY) | Interdit (MUST NOT) |
|------|---------------|-----------------|---------------------|
| `navigation` | `label`, `route` | `icon`, `invoke` | `valueSource` |
| `action` | `label`, `invoke` | `icon` | `route`, `valueSource` |
| `insight` | `label`, `valueSource` | `trend?: "up"\|"down"\|"flat"` | **`route`** (rejet schéma) |
| `badge` | `countSource` | `label`, `icon` | `route`, `invoke` |
| `avatar` | — (aucun champ requis) | `source?: "identity"\|"space"\|"custom"` | `route`, `invoke` |
| `section` | `label` | `icon` | `route`, `invoke`, `valueSource` |
| `widget` | `label`, `valueSource` | `size?: "sm"\|"md"\|"lg"` | `invoke` |
| `command` | `id`, `label`, `invoke` | `shortcut` | `route`, `valueSource` |
| `component` | `component` (id de composant) | — | — |

Exemples :

```ts
navigation : { label, route: "/admin/identity/users", icon?, invoke? }
action     : { label, invoke: "governance.roles.create", icon? }
command    : { id: "governance.create-role", label: "Create role",
               invoke: "governance.roles.create", shortcut?: "mod+shift+r" }
insight    : { label, valueSource: "capability:x" }     // route → CONTRACT_INVALID
```

### 3.4 `metadata`

- Rôle : données d'extension opaques transmises **telles quelles** au renderer.
- `metadata` **MUST** être JSON-serialisable (rejet → `CONTRACT_INVALID`).
- `metadata` **MUST NOT** influencer l'autorisation : le `PolicyResolver`
  **ne lit jamais** `metadata` (INV-CONTRIB-005). L'autorisation dépend
  uniquement de `policies`.
- `metadata` est validée en `passthrough` (clés inconnues autorisées) ; il n'y a
  **pas** de schéma strict per kind sur `metadata`.

### 3.5 Multiplicité des placements

- Une contribution **peut** avoir plusieurs placements (≥ 1, MUST).
- Une contribution **peut** être projetée dans **plusieurs surfaces**
  (chaque placement porte sa propre paire `{surface, slot}`).
- Une contribution est unique ; ses placements sont validés structurellement à
  l'inscription, existentiellement à la résolution (§2.5).

### 3.6 `kind:'component'` — escape hatch gouverné

- **Activation** : le rendu de `kind:'component'` est conditionné à un
  **octroi de gouvernance** (feature flag plateforme + allowlist d'`appId`),
  contrôlé par le `RendererRegistry`. Le propriétaire de cet octroi est
  **Governance** (configuration plateforme), jamais l'application.
- **Moment du contrôle** : à la **résolution** (le registre refuse de rendre),
  **et** à l'inscription pour signalement (diagnostic `RENDERER_UNAVAILABLE`).
- **Flag absent** : la contribution est `registered`, `eligible`, `visible`,
  mais **n'est pas rendue** → `RENDERER_UNAVAILABLE`. Ce n'est **pas**
  `CONTRACT_INVALID` : le contrat lui-même est valide (INV-CONTRIB-007).
- **Flag désactivé après activation** (révocation) : même comportement
  (non rendue + diagnostic + telemetry). Le registre n'est pas purgé ; la
  révocation est une décision de rendu.
- **Le rejet n'est donc JAMAIS `CONTRACT_INVALID` pour cause d'octroi** :
  `CONTRACT_INVALID` est réservé aux violations de schéma (ex. `content.component`
  absent).

---

## 4. Algèbre des Policies

### 4.1 Union discriminée des policies (V1)

```
type CompositionPolicy =
  | { type: "permission";   value: PermissionString }
  | { type: "capability";   value: string }
  | { type: "identity";     value: "personal" | "space" | "platform" }
  | { type: "tenant";       value: TenantId | "current" }
  | { type: "feature-flag"; value: string; expected?: unknown }
  | { type: "route";        value: GlobPattern }
  | { type: "device";       value: "mobile" | "tablet" | "desktop" };
```

V1 = ces **7 types exactement**. Aucun type supplémentaire (Subscription,
Lifecycle) n'est activé en V1.

### 4.2 Algèbre formelle

Soit `P = [p1, …, pn]` la liste de policies d'une contribution.

**Partitions :**

```
perms(P) = { v | (type:"permission", value:v) ∈ P }
caps(P)  = { v | (type:"capability",  value:v) ∈ P }
rest(P)  = { p ∈ P | type ∉ {permission, capability} }
```

**Éligibilité (définition formelle unique) :**

```
Eligible(P, ctx) =
      ( perms(P) = ∅  ∨  ∃ v ∈ perms(P) : v ∈ ctx.permissions )
  AND ( caps(P)  = ∅  ∨  ∀ v ∈ caps(P)  : v ∈ ctx.capabilities )
  AND ( ∀ p ∈ rest(P) : Eval(p, ctx) )

Eval(p, ctx) par type :
  identity     : ctx.user?.identityType === value
  tenant       : value === "current" ? ctx.tenant === tenantActif
                                      : ctx.tenant?.id === value
  feature-flag : flagAbsent(ctx, value)
                     → false
                 sinon (expected === undefined)
                     → Boolean(ctx.featureFlags[value])
                 sinon
                     → ctx.featureFlags[value] === expected
  route        : matches(ctx.route.pathname, value)
  device       : ctx.device?.type === value
```

**Résultats normatifs explicites :**

| Cas | Résultat |
|-----|----------|
| `P = []` | `Eligible([], ctx) === true` (INV-POLICY-004) — absence de policy = aucune exigence |
| `[perm a, perm b]` | `a ∈ perms ∨ b ∈ perms` → **a OR b** (INV-POLICY-005) |
| `[cap c1, cap c2]` | `c1 ∈ caps ∧ c2 ∈ caps` → **c1 AND c2** (INV-POLICY-006) |
| `[perm a, perm b, cap c]` | `(a ∨ b) ∧ c` (INV-POLICY-007) |
| groupes multiples (identity ∩ tenant ∩ route …) | **AND** entre groupes |

L'algèbre est **commutative** : l'ordre des policies dans `P` n'affecte jamais
le résultat. L'évaluation est déterministe.

### 4.3 Contextes incomplets — fail-closed

Tout champ de contexte manquant au moment d'évaluer la policy concernée →
**le prédicat vaut `false`** (INV-POLICY-003) :

| Donnée absente du contexte | Résultat |
|----------------------------|----------|
| `permission` requise non présente dans `ctx.permissions` | `false` |
| `capability` requise non présente dans `ctx.capabilities` | `false` |
| `featureFlags` sans la clé demandée | `false` |
| `tenant` absent | `false` |
| `user.identityType` absent | `false` |
| `route.pathname` absent | `false` |
| `device` absent | `false` |

Résultat global : contribution **non éligible**. Il n'existe aucune
interprétation « open » possible : contexte incomplet = **DENIED**.

### 4.4 Policies inconnues ou invalides

| Cas | Résultat |
|-----|----------|
| type de policy inconnu dans le contrat | `CONTRACT_INVALID` à l'inscription (INV-POLICY-001) |
| type reconnu mais `value` invalide | `CONTRACT_INVALID` (INV-POLICY-002) |
| adapter absent pour un type reconnu (hors V1, forward) | `DENIED` + telemetry (fail-closed) |
| exception levée par un adapter | `DENIED` + telemetry, jamais propagée (INV-POLICY-008) |
| exception levée par l'AuthorizationEngine | `DENIED` + telemetry, jamais propagée |

Le résultat d'évaluation exposé au runtime est un **booléen**. Les diagnostics
(`reason: "explicit" | "missing-context" | "adapter-error" | "engine-error"`)
sont transportés **hors-bande** pour la telemetry, sans changer le booléen.

---

## 5. Frontière PolicyResolver / AuthorizationEngine

### 5.1 Chaîne d'évaluation — unique

```
CompositionPolicy
   → PolicyResolver.evaluate(policy, context)      // SEUL point d'entrée d'évaluation
   → PolicyAdapter (un par type de policy)         // traduction vers l'engine
   → AuthorizationEngine                           // source de vérité permissions/capabilities
```

**Réponses normatives :**

- **Qui appelle AuthorizationEngine ?** Uniquement les adaptateurs de policies
  `permission` et `capability`. Aucun autre composant.
- **Qui a le droit d'évaluer une permission ?** `PolicyResolver` via
  `PolicyAdapter`. `composition.assertAccess` et `resolve` sont les **deux seuls**
  consommateurs publics de cette chaîne, et **ils passent tous deux par le même
  `PolicyResolver`** — il n'existe aucun chemin d'évaluation parallèle.
- **Un resolver peut-il appeler plusieurs adaptateurs ?** Oui, un par policy
  (en parallèle ou séquence, au choix de l'implémentation — le résultat est
  l'AND logique défini en §4.2).
- **Un adapter peut-il appeler un autre adapter ?** **MUST NOT.** Les adaptateurs
  sont indépendants ; le `PolicyResolver` orchestre. Aucune chaîne
  adapter→adapter.
- **Le resolver contient-il de la logique métier ?** **MUST NOT.** Il applique
  exclusivement l'algèbre §4.2. Il ne connaît aucune valeur de permission, de
  capacité, ni de règle métier.
- **Adapter absent** → `DENIED` (fail-closed) + telemetry (§4.4).
- **Adapter en échec (exception)** → `DENIED` + telemetry, **MUST NOT** propager
  l'exception au renderer.
- **Pureté** : l'évaluation est **pure** vis-à-vis d'un snapshot de contexte.
  Le contexte **MUST NOT** être muté pendant l'évaluation.
- **Async** : l'évaluation **MAY** être asynchrone (l'AuthorizationEngine peut
  être asynchrone). `evaluate` retourne donc `Promise<boolean>` ; les appels
  concurrents sur le même snapshot sont déterministes.

### 5.2 `composition.assertAccess(experience, context)`

```
assertAccess(experience, context) = Eligible(experience.requiredPolicies, context)
```

- C'est **exactement la même fonction** `Eligible` (§4.2) et **le même
  `PolicyResolver`** que celui utilisé par `resolve()`.
- **Garantie anti-divergence** (INV-POLICY-009) : pour un même snapshot de
  contexte,
  `assertAccess(e) === "allowed"` ⟺ `Eligible(e.requiredPolicies, ctx) === true`,
  et `resolve(slot, ctx)` calcule l'éligibilité de chaque contribution par la
  même `Eligible`. Il est **impossible** d'avoir
  `assertAccess() === allowed` et `resolve() === ineligible` pour une même
  expérience et un même contexte : les deux reposent sur la même fonction pure.
- Le résultat de `assertAccess` est `allowed | denied` (V1). Les distinctions
  `not_authenticated` / `insufficient_permission` sont des raisons
  diagnostiques hors-bande, pas des résultats de l'algèbre.

---

## 6. Sémantique registered / eligible / visible / active

### 6.1 Nature des états — décision architecturale

| État | Nature | Défini par | Dépend de | Persisté ? |
|------|--------|-----------|-----------|:---:|
| `registered` | état persistant du registre | `ContributionRegistry` | enregistrement | **oui** |
| `eligible` | **projection dérivée** (+ cache par `contextVersion`) | `Eligible(policies, context)` | contexte | **non** |
| `visible` | projection dérivée (prédicat) | `VisibilityPredicate` | contexte (layout/device/route) | **non** |
| `active` | projection dérivée | `activation(kind, contribution, context)` | contexte / route | **non** |

**Décision explicite : `eligible` n'est PAS un état persistant du registre.**
C'est une **projection calculée** sur un snapshot de contexte, avec cache optionnel
keyé par `contextVersion`. Le registre stocke les `policies` ; l'éligibilité est
**recalculée** à chaque changement de contexte et **invalidée** (cache) — jamais
stockée comme source de vérité (INV-STATE-004, INV-STATE-005).

### 6.2 Implications — décidées explicitement

```
eligible  ⊆ registered     (une contribution doit être enregistrée pour être éligible)  — registered ⇏ eligible
visible   ⊆ eligible       (INV-RESOLUTION-001)                                         — eligible ⇏ visible
active    ⊆ eligible       (orthogonal à visible)                                       — active ⇏ visible, visible ⇏ active
```

- `active` est une propriété de **sélection** : un item de navigation peut être
  `active` (route courante) alors que son conteneur est replié (`visible =
  false`). `active` et `visible` sont des **projections orthogonales** de
  `eligible`.
- **`visible` n'est jamais une autorisation** : seule `eligible` l'est. Une
  contribution `eligible` mais non `visible` n'est pas affichée — décision de
  présentation, pas de sécurité.
- **`active` n'est jamais un état persistant** (INV-ACTIVATION-001).

### 6.3 Pipeline de calcul (ordre déterministe)

```
1. registered   — filtrage du registre
2. eligible     — Eligible(policies, snapshot)
3. visible      — VisibilityPredicate(snapshot)   (layout/device/route)
4. renderer     — RendererRegistry[kind × device] (disponibilité)
5. active       — activation(kind, contribution, snapshot)   (kinds concernés)
6. tri          — (order asc, priority desc, contributionId asc)
```

Le pipeline est exécuté sur **un snapshot de contexte unique** : tous les états
sont calculés avec les mêmes valeurs.

---

## 7. Resolution

### 7.1 Contrat conceptuel

```
resolve(slot: SlotId, context: CompositionContext): SlotResolution
```

`SlotResolution` est un objet **structuré** (pas un tableau nu) :

```ts
interface SlotResolution {
  eligible: ResolvedContribution[];  // toutes les contributions éligibles du slot (triées)
  visible: ResolvedContribution[];   // subset passant les prédicats de visibilité (triées)
  active: ResolvedContribution[];    // projections d'activation pour les kinds concernés (triées)
}
interface ResolvedContribution {
  contribution: ContributionContract;
  placement: Placement;              // le placement spécifique du slot résolu
  eligible: boolean;
  visible: boolean;
  active: boolean | null;            // null = kind sans activation (ex. insight)
  renderer: { available: boolean; key: string | null };  // key = "kind×device"
}
```

### 7.2 Sélection (déterministe)

1. Prendre toutes les contributions dont un placement cible `slot`.
2. Filtrer sur `registered` (§6.3) puis `eligible` (algèbre §4.2, même snapshot).
3. Filtrer les placements : slot existe ∧ surface existe ∧
   `kind ∈ slot.acceptsKinds`. Un placement échouant → écarté +
   `COMPOSITION_INVALID` (diagnostic, telemetry), sans affecter les autres
   placements.
4. Appliquer `visible` (prédicats de visibilité : layout, device, route).
5. Résoudre le renderer : `RendererRegistry[kind][device]`. Absence →
   `renderer.available = false` + `RENDERER_UNAVAILABLE` (diagnostic). La
   contribution reste dans `eligible`/`visible` ; le Shell **ne la rend pas**.
6. Calculer `active` (§7.3) pour les kinds à activation.
7. Trier chaque array avec INV-SORT-001.

### 7.3 Activation — `navigation` (normatif)

**Forme du contrat :**

```ts
type Activator = (contribution: ContributionContract, context: CompositionContext) => ActivationResult;
interface ActivationResult { active: boolean }
```

- Chaque kind **peut** fournir son propre activateur (`activation(kind, ...)`).
  En V1, **seul `navigation`** a un activateur ; les autres kinds retournent
  `null` (pas de champ artificiel).
- **Normalisation du pathname** avant comparaison (INV-ACTIVATION-002) :
  retrait de la query string (`?`), du hash (`#`), et du trailing slash
  (sauf `/` racine).
- **Matching** : correspondance **exacte** d'abord ; si aucune, correspondance
  **paramétrée** (`:param` = un segment, valeur exposée dans
  `context.route.params`). Le matching d'activation suit la résolution de route
  du Shell (T-SH.2.1), pas un glob.
- **Plusieurs correspondances simultanées** (INV-ACTIVATION-003) : priorité —
  (1) correspondance exacte > paramétrée ; (2) longueur du préfixe littéral
  (plus longue gagne) ; (3) `order` ascendant ; (4) `contributionId` ascendant.
  **Au plus un item `active` par slot `navigation`**, ou aucun (pas de match).
- **Pas de match** → `active: false`.
- La **query string et le hash n'influencent jamais** l'activation.

---

## 8. ExperienceLoader / Mount

### 8.1 Séparation des responsabilités

```
ExperienceContract  (déclaratif : identité, route, policies, contributions)
        ↔
ExperienceMountDescriptor (mécanique : loader, bundle, entry)
```

Le contrat déclaratif **MUST NOT** dépendre du mécanisme de chargement.

### 8.2 Contrats

```ts
interface ExperienceMountDescriptor {
  id: ExperienceId;
  loader: "dynamic-import" | "url" | "manifest";  // V1 : uniquement "dynamic-import"
  bundle?: string;
  entry: string;                                  // ex. "./experience.ts"
  integrity?: string;                             // SRI (MAY, V1)
}

interface ExperienceModule {
  mount(stage: ExperienceStage): void | Promise<void>;
  unmount(): void | Promise<void>;
}

interface ExperienceStage {
  root: HTMLElement;                // shadow root
  params: Record<string, string>;
  activeAppId: string;
  theme?: Record<string, string>;
  context: CompositionContext;
}

interface ExperienceLoader {
  load(descriptor: ExperienceMountDescriptor): Promise<ExperienceModule>;
}
```

### 8.3 Matrice des responsabilités (réponses normatives)

| Question | Réponse |
|----------|---------|
| Qui connaît le `bundle` ? | L'application (le déclare dans le descriptor) |
| Qui connaît `entry` ? | L'application |
| Qui résout `entry` ? | L'`ExperienceLoader` (ou son adapter) |
| Qui effectue le dynamic import ? | L'`ExperienceLoader` |
| Qui valide le descriptor ? | `@mosaix/schemas` (à l'enregistrement) ; le loader **peut** re-valider (SHOULD) |
| Qui appelle `mount()` ? | Le Shell (transaction de navigation §9) |
| Qui appelle `unmount()` ? | Le Shell |
| Qui gère les exceptions ? | Le Shell (transactions, §9) — les erreurs ne doivent jamais fuiter |

En V1, `loader !== "dynamic-import"` → le descriptor est **rejeté à
l'enregistrement** (`CONTRACT_INVALID`) : Module Federation et loaders
alternatifs sont hors périmètre V1.

### 8.4 Cycle de vie & isolation

- `mount(stage)` est appelé **après** `attachShadow()`.
- **`mode: "open"` par défaut** (débogage, a11y, tests, monitoring autorisés).
  `mode: "closed"` **MAY** être utilisé **uniquement** si une exigence de
  sécurité documentée et validée par Governance l'exige. **Décision** : le choix
  `open`/`closed` appartient à la **configuration du Shell**, pas à
  l'application.
- **Isolation — décision normative (INV-ISOL-001) :**

```
DOM isolation  ≠  CSS isolation  ≠  JS isolation  ≠  sandbox de sécurité
```

  V1 garantit **uniquement DOM/CSS** (Shadow DOM). Il **ne garantit PAS**
  l'isolation JavaScript ni une sandbox de sécurité. Toute interprétation
  « Shadow DOM === sandbox de sécurité » est **interdite**. Aucune expérience
  tierce non fiable n'est montée en V1 ; si ce besoin survient, une iframe /
  sandbox dédiée sera évaluée **hors périmètre V1** (aucune décision en V1).

### 8.5 Idempotence (normative)

| Opération | Idempotente ? | Règle |
|-----------|:---:|-------|
| `load` | oui (cache) | le même descriptor charge une fois |
| `mount` | **non** | un montage d'une expérience déjà montée → `MODULE_MOUNT_FAILED` |
| `unmount` | **oui** | un second `unmount` sur une expérience déjà démontée → no-op |

- Double `mount` du même id d'expérience : interdit (état machine, §9).
- Double `unmount` : no-op (sûr, sans erreur).

---

## 9. Navigation transaction

### 9.1 Machine d'état normative

```
IDLE → GUARDING → LOADING → MOUNTING → COMMITTED
   ↘             ↘         ↘
   GUARDING*      FAILED    FAILED          (* : guard refusé → blocage, URL non modifiée)
```

Transitions (avec garanties) :

```
1. guard (assertAccess)         → allowed | denied
     denied    → état bloqué ; URL MUST NOT être modifiée ; expérience courante intacte (INV-NAV-001)
     allowed   → 2
2. URL update (pushState) + état PENDING observable
3. load nouvelle (ExperienceLoader)
     échec load → retry (1s, 2s, 4s, max 3) ; entre-temps l'ancienne reste montée ;
                  échec final → FAILED (écran d'erreur + bouton Retry) (INV-NAV-004)
4. mount nouvelle
     échec mount → best-effort unmount de la nouvelle (nettoyage) → FAILED (écran d'erreur)
5. commit (activer la nouvelle) → ancienne unmount (différé après commit, pas de conflit React)
6. COMMITTED
```

### 9.2 État observable « URL nouvelle + ancienne expérience montée »

Cet état existe **uniquement pendant la transaction** (LOADING/MOUNTING) :
l'URL affiche la route cible, le contenu affiche soit l'ancienne expérience
encore montée, soit un indicateur de transition. Ce n'est **jamais** un état
stable. Garantie : à l'issue de la transaction, **l'expérience affichée
correspond à l'URL** (COMMITTED) ou un écran d'erreur est affiché (FAILED).

### 9.3 Échecs — comportements déterministes

| Cas | Comportement |
|-----|--------------|
| `load` échoue | retry backoff (1/2/4 s, max 3) ; ancienne montée pendant retry ; échec final → `MODULE_LOAD_FAILED`, écran erreur + Retry |
| `mount` échoue | best-effort `unmount` de la nouvelle ; `MODULE_MOUNT_FAILED` ; écran erreur + Retry |
| `mount` réussit partiellement puis lève | traité comme échec : `unmount` best-effort, nettoyage DOM, `MODULE_MOUNT_FAILED` |
| `unmount` de l'ancienne échoue | `MODULE_UNMOUNT_FAILED` : log + telemetry, puis **force-detach** du shadow root (aucune fuite DOM) ; la transaction continue — jamais frame-fatal |
| nouvelle navigation pendant un `load` | **last-request-wins** : génération (token) incrémentée ; la charge précédente est abandonnée, la nouvelle prend le relais (INV-NAV-002) |
| double `mount` | `MODULE_MOUNT_FAILED` (idempotence §8.5) |
| double `unmount` | no-op (idempotence §8.5) |
| navigation concurrente | last-request-wins (génération) |
| ancienne expérience déjà démontée | `unmount` no-op |
| nouvelle montée mais commit impossible | traité comme échec de montage : `unmount` best-effort, `MODULE_MOUNT_FAILED` |

Retry : le compteur de retry est **annulé** si l'utilisateur navigue ailleurs
(la nouvelle navigation remplace). L'ancienne expérience n'est démontée que si
elle n'est plus valide pour la nouvelle cible (sinon elle est conservée pendant
la transition).

---

## 10. Versioning & compatibilité

### 10.1 Contrat de version

```ts
interface VersionedContract {
  contractVersion: 1;      // MAJOR du protocole
  schemaVersion: "1.0";    // MAJOR.MINOR du schéma
}
```

**Porteurs** : Experience, Surface, Slot, Placement, Contribution, Policy,
Renderer, ExperienceMountDescriptor. **Le champ `version` est requis sur
chaque contrat** (manquant → `CONTRACT_INVALID`, INV-VERSION-002).

### 10.2 Responsabilités

- **Qui négocie** : le Shell (il accepte ou rejette) ; les applications
  déclarent leur version dans chaque contrat.
- **Qui compare** : le Shell, à l'**ingestion/enregistrement** (contrôle
  primaire) et à la **résolution** (contrôle de cohérence pour les données
  embarquées).
- **Quand** : à l'enregistrement de chaque contrat ; toute incompatibilité y est
  rejetée avant tout rendu.

### 10.3 Règles de compatibilité (normatives)

| Cas | Comportement |
|-----|--------------|
| `contractVersion` ≠ shell (majeur différent) | **`VERSION_MISMATCH`** — rejet à l'enregistrement, message explicite |
| `schemaVersion` `1.1` vs shell `1.0` (MINOR supérieur) | accepté **si** les champs supplémentaires sont optionnels (additifs) et ignorés ; sinon (champ requis inconnu) → `CONTRACT_INVALID` |
| `schemaVersion` `2.0` vs `1.0` (MAJOR) | **`VERSION_MISMATCH`** |
| champ de version **manquant** | `CONTRACT_INVALID` |
| format de version **invalide** | `CONTRACT_INVALID` |
| **champ requis absent** (connu du schéma, manquant dans le payload) | `CONTRACT_INVALID` |
| **champ requis inconnu** (déclaré requis par une MINOR supérieure, inconnu du shell) | `CONTRACT_INVALID` |
| **champ optionnel inconnu** | **ignoré** (forward-compatible), sauf sécurité : un type de policy inconnu ou un kind inconnu reste rejeté |
| kind inconnu | `CONTRACT_INVALID` / quarantaine |
| type de policy inconnu | `CONTRACT_INVALID` (fail-closed) |
| kind × device sans renderer | contribution non rendue + `RENDERER_UNAVAILABLE` |
| placement vers slot inconnu | placement écarté + `COMPOSITION_INVALID` |

### 10.4 Compatibilité forward / backward

- **Forward** : un Shell V1.0 accepte les payloads avec des champs optionnels
  inconnus (MINOR >) — il les ignore. Il **refuse** les nouveaux champs requis
  qu'il ne peut garantir.
- **Backward** : un Shell plus récent accepte les payloads produits contre un
  schéma MINOR inférieur tant que les champs requis du shell sont présents.
- **Sécurité** : jamais de « forward-compat » pour l'autorisation : un type de
  policy inconnu est rejeté, jamais ignoré.

---

## 11. Error model

### 11.1 Taxonomie exhaustive (V1)

```ts
type ShellError =
  | "CONTRACT_INVALID"
  | "REGISTRATION_CONFLICT"
  | "VERSION_MISMATCH"
  | "POLICY_DENIED"
  | "ROUTE_NOT_FOUND"
  | "MODULE_LOAD_FAILED"
  | "MODULE_MOUNT_FAILED"
  | "MODULE_UNMOUNT_FAILED"
  | "RENDERER_UNAVAILABLE"
  | "COMPOSITION_INVALID";
```

### 11.2 Attributs par erreur

| Erreur | Condition de déclenchement | Propriétaire | Retry | User-visible | Telemetry | Impact registre | Impact frame | Impact navigation |
|--------|---------------------------|--------------|:---:|:---:|:---:|-----------------|--------------|-------------------|
| `CONTRACT_INVALID` | échec de schéma / champ interdit / version manquante / valeur invalide | `@mosaix/schemas` | non | non (log) | oui | contribution/slot non enregistré | aucun | aucun |
| `REGISTRATION_CONFLICT` | id en double avec contenu différent | registre | non | non (log) | oui | seconde enregistrée rejetée (première conservée) | aucun | aucun |
| `VERSION_MISMATCH` | `contractVersion`/`schemaVersion` incompatible | ingestion registre | non | non (log) | oui | contrat rejeté | aucun | aucun |
| `POLICY_DENIED` | `Eligible() === false` (y c. adapter/engine en erreur) | `PolicyResolver` | non (recalcul sur changement contexte) | oui (AccessDenied / item absent) | oui | aucun | aucun | guard bloqué (URL non modifiée) |
| `ROUTE_NOT_FOUND` | aucune expérience/route ne matche le pathname | résolution de route | non | oui (page 404) | oui | aucun | aucun (frame intact) | URL affichée, contenu 404 |
| `MODULE_LOAD_FAILED` | `load()` échoue (import, bundle absent, module introuvable) | Shell (transaction) | oui (1/2/4 s, max 3) | oui (écran erreur + Retry) | oui | aucun | aucun (frame intact) | FAILED → écran erreur |
| `MODULE_MOUNT_FAILED` | `mount()` échoue / double mount / commit impossible | Shell (transaction) | oui | oui (écran erreur + Retry) | oui | aucun | aucun (frame intact) | FAILED → écran erreur |
| `MODULE_UNMOUNT_FAILED` | `unmount()` échoue | Shell (transaction) | non | non (log) | oui | aucun | force-detach (pas de fuite DOM) | transaction continue |
| `RENDERER_UNAVAILABLE` | aucun renderer pour `kind × device` (y c. `component` non octroyé) | `RendererRegistry` | non | non (contribution absente) | oui | aucun | aucun (item non rendu) | aucun |
| `COMPOSITION_INVALID` | placement vers slot/surface inexistant, slot n'acceptant pas le kind | `CompositionResolver` | non | non (log) | oui | aucun | aucun (placement écarté) | aucun |

### 11.3 Pourquoi ces erreurs ne doivent pas être confondues

- **`CONTRACT_INVALID` ≠ `COMPOSITION_INVALID`** : le premier est une violation
  de **forme** (schéma), déterministe **à l'inscription** ; le second est une
  incohérence **d'existence/cible**, constatée **à la résolution** (les cibles
  peuvent s'enregistrer plus tard). Un contrat valide peut produire un placement
  invalide ; l'inverse est impossible.
- **`POLICY_DENIED`** est un résultat **d'autorisation** (dépend de l'utilisateur
  et du contexte), indépendant des erreurs structurelles.
- **`MODULE_*`** sont des erreurs de **cycle de vie** du montage ; elles n'ont
  aucun impact sur les registres ni sur la composition.
- **`RENDERER_UNAVAILABLE`** n'est pas une erreur d'autorisation : la
  contribution est légitime mais son rendu n'existe pas (ou n'est pas octroyé).

---

## 12. Fail-open / Fail-closed — règles décisionnelles par domaine

### 12.1 Table de décision normative

| Domaine | Erreur / condition | Résultat | Signification |
|---------|--------------------|----------|---------------|
| **sécurité** | policy inconnue | **FAIL CLOSED** | `CONTRACT_INVALID` — jamais éligible |
| **sécurité** | contexte incomplet | **FAIL CLOSED** | `DENIED` — jamais éligible |
| **sécurité** | permission/capability absente | **FAIL CLOSED** | `DENIED` |
| **sécurité** | adapter/engine en erreur | **FAIL CLOSED** | `DENIED` + telemetry |
| **sécurité** | guard indisponible (engine down) | **FAIL CLOSED** | navigation **bloquée** (URL non modifiée) + état d'erreur |
| **sécurité** | `component` non octroyé | **FAIL CLOSED** | non rendu (`RENDERER_UNAVAILABLE`) |
| **composition** | slot inconnu | **FAIL OPEN** | placement écarté + diagnostic (le frame continue) |
| **composition** | surface inconnue | **FAIL OPEN** | placement écarté + diagnostic |
| **composition** | slot n'accepte pas le kind | **FAIL OPEN** | placement écarté + diagnostic |
| **rendu** | renderer inconnu | **FAIL OPEN** | item non rendu + diagnostic (jamais de crash) |
| **chargement** | module indisponible | **FAIL OPEN** | fallback + retry + écran erreur (frame intact) |
| **navigation** | guard indisponible | **FAIL CLOSED** | blocage (jamais d'accès sans vérification) |
| **navigation** | route invalide (aucune expérience) | **FAIL OPEN** | page 404 (frame intact) |
| **navigation** | load/mount échec | **FAIL OPEN** | écran d'erreur + Retry (frame intact) |

### 12.2 Définition normative de « fail-open » (lève l'ambiguïté)

**`fail-open` ne signifie JAMAIS `autoriser`.** Il signifie exclusivement
**« continuer sans casser le Shell »** : dégrader (écarter un item, afficher un
écran d'erreur, ne pas rendre) tout en gardant le frame fonctionnel.

Toute frontière **sécurité** est **fail-closed** : un doute, un contexte
incomplet, une erreur d'engine = **refus**, jamais autorisation par défaut.
Le `fail-open` ne s'applique qu'aux domaines **UI / composition / chargement /
résolution**, où la dégradation est une erreur de présentation, pas de sécurité.

---

## 13. Invariants normatifs (testables)

```
INV-ID-001     slot.surface === prefix(slot.id)
INV-ID-002     placement.surface === prefix(placement.slot)
INV-ID-003     slotLocal sans point ⇒ prefix() unique et déterministe
INV-ID-004     tous les IDs respectent le format canonique (§2.1)
INV-ID-005     slot.id unique dans SlotRegistry
INV-ID-006     SurfaceContract.slots est dérivé, jamais fourni dans un payload
INV-ID-007     double enregistrement identique → idempotent ; différent → REGISTRATION_CONFLICT
INV-SORT-001   tri total : (order asc, priority desc, contributionId asc)
INV-PLACE-001  placement résolu ⇒ slot existe ∧ surface existe ∧ kind ∈ slot.acceptsKinds
INV-CONTRIB-001 contribution.id unique
INV-CONTRIB-002 enregistrement dupliqué différent → REGISTRATION_CONFLICT
INV-CONTRIB-003 kind inconnu → CONTRACT_INVALID
INV-CONTRIB-004 champ de content inconnu → CONTRACT_INVALID
INV-CONTRIB-005 metadata jamais lu par PolicyResolver (aucune influence d'autorisation)
INV-CONTRIB-006 insight avec route → CONTRACT_INVALID
INV-CONTRIB-007 component non octroyé → RENDERER_UNAVAILABLE (jamais CONTRACT_INVALID)
INV-POLICY-001 type de policy inconnu → CONTRACT_INVALID
INV-POLICY-002 valeur de policy invalide → CONTRACT_INVALID
INV-POLICY-003 contexte insuffisant → DENIED (fail-closed)
INV-POLICY-004 Eligible([], ctx) === true
INV-POLICY-005 permissions groupées en OR : Eligible([perm a, perm b]) ⇔ a∈perms ∨ b∈perms
INV-POLICY-006 capabilities groupées en AND : Eligible([cap c1, cap c2]) ⇔ c1∈caps ∧ c2∈caps
INV-POLICY-007 groupes croisés en AND : (a ∨ b) ∧ c
INV-POLICY-008 exception adapter/engine → DENIED, jamais propagée
INV-POLICY-009 assertAccess(e) === Eligible(e.requiredPolicies, ctx) — même fonction que resolve()
INV-STATE-001  eligible ⊆ registered
INV-STATE-002  visible ⊆ eligible
INV-STATE-003  active ⊆ eligible (orthogonal à visible)
INV-STATE-004  seuls registered est persisté ; eligible/visible/active sont dérivés
INV-STATE-005  éligibilité évaluée sur snapshot ; cache keyé par contextVersion
INV-RESOLUTION-001 visible ⊆ eligible
INV-RESOLUTION-002 resolve retourne un array trié (INV-SORT-001), déterministe
INV-RENDER-001  renderer manquant → RENDERER_UNAVAILABLE, jamais de crash
INV-ACTIVATION-001 active est une projection, jamais un état persistant
INV-ACTIVATION-002 activation navigation = match exact puis paramétré sur pathname normalisé
INV-ACTIVATION-003 au plus un item actif par slot navigation ; tie-break déterministe
INV-ISOL-001    Shadow DOM ≠ sandbox de sécurité ; V1 = DOM/CSS uniquement
INV-LOAD-001    mount appelé au plus une fois par instance ; double unmount → no-op
INV-NAV-001     guard fail-closed : refus → URL non modifiée
INV-NAV-002     navigation last-request-wins (génération)
INV-NAV-004     échec load final → écran d'erreur, frame intact
INV-VERSION-001 contractVersion ≠ shell → VERSION_MISMATCH
INV-VERSION-002 version manquante ou format invalide → CONTRACT_INVALID
INV-VERSION-003 champ requis inconnu → CONTRACT_INVALID ; optionnel inconnu → ignoré
```

---

## 14. Matrice des cas limites

Chaque ligne : `Input → Evaluation → Résultat → Erreur → Effet utilisateur → Telemetry`.

| # | Cas | Évaluation | Résultat | Erreur | Effet utilisateur | Telemetry |
|---|-----|-----------|----------|--------|-------------------|-----------|
| 1 | slot inexistant (placement vers slot inconnu) | résolution : existence slot | placement écarté | `COMPOSITION_INVALID` | item absent | oui |
| 2 | surface inexistante (slot orphelin) | résolution : existence surface | placement écarté | `COMPOSITION_INVALID` | item absent | oui |
| 3 | slot appartenant à une autre surface (placement.surface ≠ prefix(slot)) | enregistrement : INV-ID-002 | contrat rejeté | `CONTRACT_INVALID` | non enregistré (log) | oui |
| 4 | placement incohérent (surface vs slot) | enregistrement : INV-ID-002 | contrat rejeté | `CONTRACT_INVALID` | non enregistré (log) | oui |
| 5 | contribution inconnue (id non enregistré) | résolution : registered | exclue | aucun (filtre) | item absent | non |
| 6 | kind inconnu | enregistrement : schéma | contrat rejeté | `CONTRACT_INVALID` | non enregistré (log) | oui |
| 7 | policy inconnue | enregistrement : schéma | contrat rejeté | `CONTRACT_INVALID` | non enregistré (log) | oui |
| 8 | permission absente (requise, non possédée) | Eligible : perms | non éligible | `POLICY_DENIED` | item absent | oui |
| 9 | capability absente | Eligible : caps (AND) | non éligible | `POLICY_DENIED` | item absent | oui |
| 10 | contexte incomplet (device absent) | Eval(device) | `false` → non éligible | `POLICY_DENIED` | item absent | oui |
| 11 | feature flag absent | Eval(feature-flag) | `false` → non éligible | `POLICY_DENIED` | item absent | oui |
| 12 | tenant incorrect | Eval(tenant) | `false` → non éligible | `POLICY_DENIED` | item absent | oui |
| 13 | route incorrecte (policy route) | Eval(route) | `false` → non éligible | `POLICY_DENIED` | item absent | oui |
| 14 | renderer absent (kind × device) | RendererRegistry | non rendu | `RENDERER_UNAVAILABLE` | item absent (diagnostic) | oui |
| 15 | bundle absent | load() | retry puis échec | `MODULE_LOAD_FAILED` | écran erreur + Retry | oui |
| 16 | module introuvable (entry invalide) | load() | retry puis échec | `MODULE_LOAD_FAILED` | écran erreur + Retry | oui |
| 17 | mount en échec | mount() throw | unmount best-effort | `MODULE_MOUNT_FAILED` | écran erreur + Retry | oui |
| 18 | unmount en échec | unmount() throw | force-detach, transaction continue | `MODULE_UNMOUNT_FAILED` | aucun (log) | oui |
| 19 | version incompatible (contractVersion 2) | ingestion | rejet | `VERSION_MISMATCH` | non enregistré (log) | oui |
| 20 | champ optionnel inconnu | schéma passthrough/forward | ignoré | aucun | rien | non |
| 21 | champ requis inconnu (MINOR >) | ingestion | rejet | `CONTRACT_INVALID` | non enregistré (log) | oui |
| 22 | contribution sans policy (P = []) | Eligible([]) | `true` → éligible | aucun | item affiché | non |
| 23 | plusieurs permissions (OR) | Eligible : perms | éligible si l'une possédée | `POLICY_DENIED` sinon | item affiché / absent | oui |
| 24 | plusieurs capabilities (AND) | Eligible : caps | éligible si toutes possédées | `POLICY_DENIED` sinon | item affiché / absent | oui |
| 25 | eligible mais invisible (sidebar repliée) | VisibilityPredicate | `visible = false` | aucun | item non affiché (repli) | non |
| 26 | visible mais inactive (route différente) | activation | `active = false` | aucun | item affiché non sélectionné | non |
| 27 | navigation concurrente (deux demandes) | génération | last-request-wins | aucun | la dernière gagne | oui (abandon première) |
| 28 | guard indisponible (engine down) | assertAccess | denied | `POLICY_DENIED` (fail-closed) | navigation bloquée | oui |
| 29 | route invalide (aucune expérience) | résolution de route | 404 | `ROUTE_NOT_FOUND` | page 404 | oui |
| 30 | `component` non octroyé | RendererRegistry | non rendu | `RENDERER_UNAVAILABLE` | item absent | oui |
| 31 | re-enregistrement id identique | registre | idempotent | aucun | rien | non |
| 32 | re-enregistrement id différent | registre | seconde rejetée | `REGISTRATION_CONFLICT` | non enregistré (log) | oui |

---

## 15. Critères de validation (acceptance)

Une implémentation T-SH.0.1 → T-SH.0.6 est conforme si et seulement si :

1. **Tous les invariants du §13 sont vérifiés par des tests automatisés.**
   (T-SH.0.6)
2. Les cas limites §14 reproduisent **exactement** les résultats du tableau.
3. `assertAccess` et `resolve` produisent des résultats identiques pour la même
   expérience/contribution et le même snapshot (INV-POLICY-009).
4. L'ordre de rendu d'un slot est **déterministe** (INV-SORT-001) :
   deux exécutions → même ordre.
5. La machine de navigation §9 respecte last-request-wins et les garanties
   d'échec (frame jamais cassé).
6. Aucun appel à `AuthorizationEngine` en dehors des adaptateurs (INV + §5.1).

---

## 16. Décisions et alternatives rejetées

| # | Décision normative | Alternative rejetée | Justification |
|---|--------------------|--------------------|---------------|
| D1 | `SurfaceContract.slots` = projection dérivée, jamais écrite | slots comme champ déclaré (ADR/PRD) | élimine toute contradiction index ↔ slot par construction (R17, §2.2) |
| D2 | Aucun ordre d'enregistrement surface/slot ; slots orphelins = inexistants | ordre imposé surface→slot | robustesse bootstrap ; registres indépendants |
| D3 | `active` orthogonale à `visible`, `active ⊆ eligible` | active après visible | un item peut être sélectionné dans un conteneur replié |
| D4 | `eligible` = projection dérivée (+ cache par contextVersion) | `eligible` persistant au registre | l'éligibilité dépend du contexte ; une persistance serait une seconde source de vérité |
| D5 | `component` non octroyé → `RENDERER_UNAVAILABLE` | `CONTRACT_INVALID` | le contrat est valide ; c'est un refus de rendu, pas une erreur de forme |
| D6 | `VERSION_MISMATCH` distincte de `CONTRACT_INVALID` | fusion dans `CONTRACT_INVALID` | cause et message distincts ; nécessité opérationnelle (10 erreurs, aucune gratuite) |
| D7 | `fail-open` = « continuer sans casser le Shell » | `fail-open` = autoriser | toute frontière sécurité reste fail-closed (§12.2) |
| D8 | Shadow DOM `open` par défaut ; `closed` si exigence documentée | `closed` par défaut (PRD §11.3) | a11y/tests/monitoring ; le Shadow DOM n'est pas une sandbox (§8.4) |
| D9 | 7 types de policy exactement en V1 | extensibilité activée en V1 | plafonnement V1 (ADR-0007) ; types supplémentaires différés |
| D10 | évaluation policy pure, résultat booléen, raisons hors-bande | résultat riche dans le contrat | le runtime reste simple ; la telemetry ne change pas la décision |

---

## SIGN-OFF GATE

Checklist binaire :

```
[x] Une seule source de vérité est définie pour chaque donnée.        (SlotRegistry, ContributionRegistry, AuthorizationEngine, URL, §2.2/§5/§8)
[x] Toutes les transitions d'état sont déterministes.                 (§6.2, §6.3, §9.1)
[x] L'algèbre des policies est formellement définie.                  (§4.2, partitions, INV-POLICY-004..007)
[x] Aucun chemin d'autorisation parallèle n'existe.                   (§5.1, INV-POLICY-009)
[x] registered / eligible / visible / active sont non ambigus.        (§6, implications décidées)
[x] Le protocole de mount est déterministe.                           (§8.5, §9, idempotence)
[x] Les échecs de navigation sont déterministes.                      (§9.3, machine d'état)
[x] Le versioning est déterministe.                                   (§10, INV-VERSION-001..003)
[x] Les erreurs sont exhaustives pour V1.                             (§11.1, 10 erreurs)
[x] Fail-open / fail-closed est défini par domaine.                   (§12)
[x] Les cas limites critiques sont couverts.                          (§14, 32 cas)
[x] Les invariants sont testables.                                    (§13, 40 invariants)
[x] Deux implémentations indépendantes produisent le même comportement. (§15)
[x] Aucun point architectural critique ne reste à décider.            (§16)
```

**Verdict final :**

> **GO — SIGNABLE**
>
> La spécification est signable. Toute ambiguïté recensée a reçu une décision
> normative. Restent deux **points de suivi** (non bloquants pour la signature,
> à traiter dans les tickets d'implémentation ou comme amendements) :
>
> 1. **D8** : le PRD-0007 §11.3 (`Shadow DOM closed`) doit être mis en
>    conformité avec cette spécification (`open` par défaut) — alignement
>    documentaire, pas architectural.
> 2. **D1** : la forme de `SurfaceContract.slots` dans l'ADR-0007 et le
>    PRD-0007 §5.1 doit être remplacée par la projection dérivée (§2.2) lors
>    de l'implémentation des contrats (T-SH.0.1).
