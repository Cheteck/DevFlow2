# ADR-0019 — Gestion des options produit (Portfolio)

**Status:** Accepted (appliqué 2026-10-10)
**Date:** 2026-10-10
**Deciders:** Maintainer (demande : options type couleurs)

---

## Context

Les fiches importées portent un bloc `options` libre (coloris, poids,
configs mémoire) sans validation ni sémantique partagée : pas de codes
canoniques, pas de valeurs contraintes, pas d'incompatibilités, groupes de
variation réservés aux axes SKU. Fait vérifié : `responsibilities.md`
autorise déjà les options descriptives (jamais tarifaires).

## Decision

1. **Modèle domaine** (`domain/product-options.ts`) : groupes typés
   `{code, label, required, values[{value, label, incompatibleWith}]}`,
   normalisation (même règle que les features), validation (codes, doublons,
   clés commerciales interdites, références d'incompatibilité), validation
   de configuration `{groupe: valeur}` (groupes requis + paires
   incompatibles), conversion bloc aller/retour (métadonnées
   `source/modeling/note` préservées).
2. **Écriture** : `PortfolioService.setProductOptions` (Draft/In
   Review/Validated uniquement) remplace le bloc et repasse par
   `updateVendable` (invariants + complétude).
3. **Persistance** : tout groupe d'options obtient un `variation_groups`
   (reconstruit à chaque save, comme les axes SKU) ; `purpose='variation'`
   pour les axes SKU (liens vers features de variantes distinctes),
   `purpose='option'` pour les autres (lien vers leur feature énumérée).
4. **Transport** : outil MCP `portfolio_vendable_options_set`
   (permission création, id ou référence).
5. **Hors périmètre v1** : liaison variante ↔ valeur d'option (pas de donnée
   source), media par valeur d'option, options tarifaires (Commerce, jamais).

## Consequences

- Options requêtables par jointure (`variation_groups` + purpose).
- Aucun changement du contrat `Vendable` ni des outils existants.
- Suivi : traductions EN/AR, media ré-hébergés, publication des fiches.
