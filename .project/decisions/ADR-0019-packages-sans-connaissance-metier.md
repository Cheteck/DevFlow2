# ADR-0019 — Les packages framework ne portent aucune connaissance métier BAC

**Status:** Accepted (appliqué 2026-10-11, purge `packages/schemas`)
**Date:** 2026-10-11
**Deciders:** Maintainer (demande explicite : les packages ne doivent pas connaître les tables/modèles des BACs ; `schemas` fournit des abstractions)

---

## Context

L'analyse dogfooding `@apps/portfolio` (2026-10-11) a établi que `packages/schemas`
hébergeait 5 schémas Zod miroirs de domaines BAC — `VendableCharacteristicsSchema`,
`MediaItemMetadataSchema` (portfolio), `CommerceOfferMetadataSchema` (commerce),
`PostMetadataSchema` (solara), `AuditLogMetadataSchema` — créés par DATA-08.

Recherche exhaustive le 2026-10-11 : ces 5 schémas sont **définis mais consommés
nulle part** — ni par les BACs, ni par le framework. Le package n'est réellement
consommé que pour ses abstractions (enveloppes d'événements, manifests
application/plugin, contrats theme) par `@mosaix/core` et `@mosaix/theme`.

Tentative écartée : brancher portfolio sur ces schémas. Le modèle portfolio
légitime (attributs imbriqués `options.color.values`, tableaux `color_options`)
serait **rejeté** par le schéma partagé trop étroit — preuve que la concrétion
vit au mauvais étage.

---

## Decision

> **Direction de connaissance unique : `apps → packages`, jamais l'inverse.**
> Un package framework fournit des **abstractions** (mécanismes génériques :
> enveloppes, manifests, versioning, primitives). Tout contenu nommé d'après un
> concept BAC (tables, modèles, vocabulaires métier) vit dans
> `apps/<bac>/src/domain`, jamais dans `packages/*`.

**Test d'appartenance :** un schéma reste dans `packages/schemas` s'il contraint
un mécanisme du framework ou sert de socle générique étendu par les BACs.
Un miroir de domaine BAC en est exclu, même s'il est « strict et bien écrit ».

**Corollaires :**
- Les 5 schémas concrétions sont purgés (zéro consommateur prouvé → zéro
  changement comportemental). Aucune abstraction de remplacement inventée :
  une abstraction naît avec son premier vrai consommateur (YAGNI).
- Les BACs gardent leurs validations propres (ex. `FORBIDDEN_OPERATIONAL_KEYS`
  portfolio) jusqu'à extraction future d'un socle générique, si un besoin
  partagé par ≥2 BACs se démontre.
- DATA-08 reste DONE pour sa partie utile (socle strict consommé) ; sa partie
  concrétions est révisée par la présente (historique non réécrit).

---

## Consequences

- `packages/schemas` redevient cohérent avec son nom : abstractions consommées.
- Tout ajout futur nommé d'après un concept BAC dans `packages/*` exige une ADR
  d'exception.
- Dette résiduelle connue, hors périmètre : `main: ./dist` fictif (9 BACs,
  dépend du pipeline dist), MANIFEST dupliqué JSON↔TS (gate de parité proposée).
