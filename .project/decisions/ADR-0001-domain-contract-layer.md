# ADR-0001 — Domain Contract Layer (`@mosaix/contracts`)

- **Date :** 2026-08-03
- **Statut :** Accepted
- **Décideurs :** Architecture Steward
- **Lié à :** roadmap §1, §4, §8 ; T-10

## Context

MosaiX permet à des applications développées indépendamment de devenir des
citoyens d'un écosystème composable. Sans frontière de contrats stable, chaque
artefact (application, plugin, theme, capability, event, experience) définit
ses propres conventions → dérive, incompatibilités, couplage implicite.

Avant cette ADR, la couche basse (`@mosaix/types`) mélangeait types primitifs
(TenantIdentity, grammaire de permission) et contracts applicatifs (enveloppe
d'événement, manifests). Aucune couche ne définissait de manière canonique et
versionnée ce que le Runtime peut enregistrer, charger, exécuter et gouverner.

## Decision

Introduire un **Domain Contract Layer** : `@mosaix/contracts`, considéré comme
le **ABI layer** de la plateforme (rôle analogue à OpenAPI pour HTTP, Protobuf
pour les systèmes distribués, OCI Manifest pour les containers).

### Responsabilités

`@mosaix/contracts` contient **uniquement** :

- Types TypeScript
- Interfaces
- Enums
- Versioning des contrats (`CONTRACT_VERSION`)

Il ne contient **jamais** :

- Logique métier
- Code runtime
- Accès réseau
- Dépendances UI
- Valideurs Zod (délégués à `@mosaix/schemas`)

### Principe central — Mosaix Artifacts

Le Runtime ne connaît pas des « apps React », des « plugins npm » ou des
« bundles ». Il connaît des **Mosaix Artifacts** : unités gouvernées, versionnées
et signées qui déclarent ce qu'elles fournissent, exigent et comment elles
s'intègrent. `ApplicationManifest`, `PluginManifest`, `ThemeManifest` étendent
tous `MosaixArtifactManifest`.

### Structure

```
packages/contracts/src/
  index.ts
  version.ts
  mosaix-artifact.ts
  application/   manifest, lifecycle, permissions, experience
  plugin/        manifest, lifecycle, permissions, extension
  capability/    contract, provider, consumer
  experience/    contract, layout, navigation, widget, theme
  theme/         manifest, design-tokens, branding, accessibility
  events/        event-contract, command, query
  security/      permission-contract, trust-level, signature
```

### Schémas runtime séparés : `@mosaix/schemas`

Les valideurs Zod (manifestes, enveloppe d'événement, permissions) vivent dans
`@mosaix/schemas`, dépendant de `@mosaix/contracts`. Séparation motivée par :
les applications qui n'ont besoin que des types ne doivent pas embarquer Zod.

### Direction des dépendances

```
types
  ↑
contracts
  ↑
schemas   (Zod validators)
  ↑
core
  ↑
sdk
  ↑
apps
```

Interdits : `contracts → core/runtime`, `contracts → react/ui`,
`schema → runtime`. Enforced par `eslint-plugin-boundaries`.

## Consequences

### Positive

- Frontière stable et unique entre Runtime, Applications, Plugins et outils.
- Contracts runtime-validables (Zod) → validation de manifests, compatibilité
  de versions, marketplace, signature de packages, tooling CLI.
- Versioning explicite du contrat (`CONTRACT_VERSION`), découplé des artefacts.
- Réutilisable tel quel dans le Control Plane et les adapters.

### Negative

- Coût de création d'une couche de plus (peu élevé : purement déclarative).
- Nécessite la migration progressive des types « contractuels » de
  `@mosaix/types` vers `@mosaix/contracts` — **résolue (T-12)** : `types` ne
  contient plus que les primitives ; `core`/`sdk`/`apps` consomment `contracts`.

### Risks

- **Dérive entre `@mosaix/types` et `@mosaix/contracts`** : la migration des
  types contractuels vers `contracts` est faite ; les consommateurs (core, sdk,
  apps) importent depuis `@mosaix/contracts`, `TenantIdentity` est exposé par
  l'index public de `contracts`, la duplication est supprimée (0 consommateur
  legacy). Enforcement : règle boundaries + tâche T-12 clôturée. Suivi restant :
  validation Zod des manifests au runtime (T-18).

## Alternatives considered

1. **Continuer avec `@mosaix/types` seul** — rejeté : pas de frontière stable,
   versioning implicite, pas de runtime-validabilité.
2. **Schémas Zod dans `@mosaix/contracts`** — rejeté : impose Zod à tous les
   consommateurs de types (apps légères).
