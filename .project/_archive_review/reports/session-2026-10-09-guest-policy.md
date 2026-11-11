# Session 2026-10-09 — Politique guest + données réelles (commerce/spaces)

## Objectif
Adopter la politique produit guest (vitrine commerce + découverte spaces publiques, tout le reste derrière login) et purger les mocks des deux vitrines publiques.

## Constats vérifiés (Postgres Docker, pas sqlite)
- `commerce.offers` : table OK, **0 ligne** ; la vitrine affichait 4 produits en dur (`Xiaomi…`), panier et commandes statiques (`#ORD-8103-24`, livreur `Ali Express`).
- `spaces.spaces` : table OK, **0 ligne** ; liste/profil/membres/stats en dur (`CAJ`, `Sarah Connor`, `amel@mosaix.io`… — dont des EMAILS).
- `CommerceOfferService` sans méthode list-all, aucun repo du port, descripteurs sans services : le chemin réel n'existait pas.

## Changements
- `apps/commerce/.../postgres-offer-repository.ts` (nouveau) : port + `listActiveOffers()` (`commerce.offers` + jointure `portfolio.translations` fr, fallback référence, placeholders `$n`) + fallback mémoire ; `listAllActive()` côté service ; `findByUserId`/`listOrdersByUser` (fini le `findAll` exposé).
- `commerce-view.ts` : descripteur injecté `{offerService, orderService}`, grille réelle (prix `Money`, stock, vendeur), états vides honnêtes (vitrine/panier/commandes), onglets cart/orders masqués aux guests + prompt login, pas de faux filtres (sélecteur catégorie supprimé : backend inexistant).
- `spaces-view.ts` : `createSpacesDescriptor({spaceService})`, liste/profil réels, `toPublicSpace()` (nom/slug/catégorie/suiveurs — jamais owner/team/emails), répertoire + gestion/invitation membres-only, `?space=<slug|id>`, états vides.
- `src/server/bac-wiring.ts` (nouveau) : la composition (`start.ts`) injecte les services PG aux descripteurs via dynamic import (pattern `mcp-routes`, fail-soft loggé, boot jamais bloqué). Contexte d'exécution guest sans rôles.
- `bac-access.ts` : spaces `list/profile` publics (`defaultView: list`), `new` protégé ; nav anonyme = commerce + spaces.
- Tests : 13 nouveaux (repo mapping, descripteurs réel/vide/guest, pas d'emails) + matrice policy + 3 HTTP (directory sans zone membre, `new`→302, vitrine vide sans `Xiaomi`).

## Incidents de parcours (honnêtes)
- Harness booté sur sqlite au départ (mauvais réflexe) ; basculé sur Postgres Docker (clone `pg_dump` — `migrate` frais est cassé repo-wide : collision `booking.slots`, à traiter séparément).
- Faux négatifs du harness : serveurs orphelins squattaient 3217/3218 → le harness testait du vieux code. Fix : `freePort()` + kill arbre avant boot.
- Test attrapé : `defaultView` solara (`feed`) — sans lui le guard 403 les membres sur `/solara`.

## Validation
- 83 tests verts : 69 unit (9 fichiers) + 14 HTTP (2 boots réels PG).
- ESLint fichiers touchés : propre. Vérification live `/commerce` : vitrine sans menu, auth buttons, plus de mocks.

## Gaps déclarés (BACKLOG, pas de faux)
Page détail d'offre, recherche/tri/filtres backend, flag visibilité Space (tout listé = découvrable), backend panier, gating memberships (boutons gestion visibles aux membres sans vérification), `/api/*` par ressource, tranche inscription réelle (register 501).

## Git State
- Branche : `backlog-tasks-completion-16894022842581055701`, aucun commit.
- Nouveaux : `postgres-offer-repository(.test).ts`, `commerce-view.test.ts`, `spaces-view.test.ts`, `bac-wiring.ts`, ce rapport.
- Modifiés : `commerce-offer.model.ts`, `order.service.ts`, `postgres-order-repository.ts`, `commerce-view.ts`, `spaces-view.ts`, `bac-access(.test).ts`, `start.ts`, `tests/http/*`, `BACKLOG.md`.
- Rollback : `git checkout -- <modifiés>` + supprimer les nouveaux fichiers.
