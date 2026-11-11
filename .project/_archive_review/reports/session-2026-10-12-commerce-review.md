# Session 2026-10-12 — Revue commerce-view : remédiation appliquée

## Portée
Revue externe du descripteur commerce (présentation + sémantiques). Appliquée dans l'ordre recommandé, sans réécriture. Verdict revue : fondation raisonnable, production incomplète — restes en BACKLOG (AUTH-05, COMMERCE-CART-01, VUES-AUTHFLAG-01).

## 1. Auth explicite (P1 revue)
- `BacExecutionContext.user.isAuthenticated: boolean` REQUIS au contrat (`platform.ts`) : les rôles ne décident plus, dans aucune vue.
- `start.ts` (2 sites) : `ssrAuth.kind !== "anonymous"` (démo incluse, cohérent avec le guard).
- Fixtures mises à jour (commerce, orchestrator, beam/solidarity/spaces/subscription/portfolio) : 0 changement de comportement hors commerce.
- `requiredPermissions: ["commerce:order:create"]` documenté comme déclaratif (enforcement = guard bac-access + gate MCP).
- `context.user.id` = id de profil d'affichage, PAS l'identité de session → commenté dans le code + BACKLOG AUTH-05 (le scoping commandes devient exact avec IdentityProfilePort).

## 2. Honnêteté commerce
- CTA « Ajouter au panier » (qui n'ajoutait rien) : guests → lien login (pattern existant) ; membres → badge désactivé « Panier bientôt disponible ». Pas de backend improvisé.
- Services manquants = état d'erreur explicite « Service indisponible » (vitrine ET commandes), jamais un faux vide. Échecs requête propagés au boundary central `start.ts` (vérifié : pas de try/catch masquant dans le descripteur).
- `resolveView()` : vues inconnues → `offers` (le guard strict a déjà refusé ce qu'il devait).

## 3. Monnaie + stock (sémantiques centralisées)
- `formatMoneyStrict` : entiers sûrs + ISO `^[A-Z]{3}$` + `Intl fr-FR` ; par carte en try/catch → « Prix indisponible » (jamais 0.00). Commandes : idem pour totaux (« Total indisponible »).
- `getOfferAvailability()` (domaine) : `undefined` = illimité (contrat modèle), `0` = rupture, `<0`/non-entier = invalide, `1` = « Plus qu'une unité » (grammaire corrigée). Vue purgée de toute inférence truthiness.
- Dates commandes : `Intl fr-FR` + « Date inconnue ».
- Échappement : `escapeHtml` couvre `&<>"'` (vérifié `support/html.ts`) ; `data-price` strictement numérique ; attributs couverts ; test d'injection ajouté.

## 4. Rendu + a11y
- Labels `aria-label` recherche/tri, `aria-live="polite"` sur le compteur. Focus/CSP/script-lifecycle : inchangés (architecture shell existante, documenté).
- `isAvailable()` : documenté comme enablement (pas de readiness) — inchangé.

## Ce qui n'est PAS fait (assumé, traçé)
- Backend panier, IdentityProfilePort, `isAuthenticated` dans spaces/autres vues, `totalAmount` unités côté domaine (vérifié usage : cents, cohérent service), perms `commerce:order:*` non-tenant (dette manifeste connue).

## Validation
- 101/101 verts : 33 commerce (11 vue + 4 modèle + 12 service + 6 plugins) + 68 voisins (spaces/solidarity/subscription/beam/portfolio/orchestrator/boundaries/bac-access/mcp).
- ESLint fichiers touchés : propre. Matrice revue couverte sauf E2E HTTP (guard déjà couvert) et perms admin effectives (S SSO-SEC-01 existant).

## Git State
- Modifiés : `platform.ts`, `start.ts`, `commerce-view(.test).ts`, `commerce-offer.model(.test).ts`, `order.service.ts`, `postgres-order-repository.ts`, 5 fixtures tests, `BACKLOG.md`.
- Rollback : `git checkout -- <liste>` (aucun nouveau fichier sauf `commerce-offer.model.test.ts` à supprimer).
