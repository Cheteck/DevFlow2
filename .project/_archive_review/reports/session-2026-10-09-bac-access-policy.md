# Session 2026-10-09 — Frontière guest globale (BAC access policy)

## Objectif
Un guest pouvait ouvrir solara et tous les BACs : le guard filtrait sur `currentUser.allowedBacs` (profil d'affichage, `LOCAL_USER_PROFILE` membre). Solution globale : politique unique guard + navigation.

## Changements (4 ajustements de la revue appliqués)
1. **Politique stricte** (`src/shell/bac-access.ts`) : `allowed|login|forbidden`, whitelist par (BAC, vue), vues inconnues refusées, `?view=` répété → refus, `defaultView` par BAC (`solara→feed`, `commerce→offers`) identique guard/rendu. Pas de kind `not-found` : le guard ne voit que des BACs issus de discovery (chemins inconnus → home/default, couverts), les ids inconnus directs sont deny-by-default (login/forbidden) — documenté dans le module. `strictViews` sur commerce+solara ; autres BACs en inventaire progressif (anonyme : rien d'ouvert).
   Table : commerce `""+offers` publics / cart+orders+inconnu → login ; solara/feed/profile → login ; portfolio/booking/beam/spaces/solidarity/subscription/citadelle → login ; imperia → admin-only (403 membre) ; `/` anonyme → 302 `/commerce`.
2. **Navigation dérivée** : `visibleBacIds()` + `buildNavProfile()` calculent depuis la politique (anonyme → commerce seul, permissions `[]`). `ANONYMOUS_NAV_PROFILE` = présentation neutre. Pages reçoivent `navProfile` pour les 4 rendus nav ; `executionContext.user` anonyme = guest sans rôles/permissions (least privilege). Onglets commerce cart/orders masqués aux guests + prompt login en second verrou (vue).
3. **`resolveSafeNext()` serveur** : relatif interne uniquement, rejette `//`, absolus, backslash, boucles `/login`/`/register`, utilisé à chaque redirection + page login.
4. **Tests HTTP réels** (`tests/http/bac-access.http.test.ts`) : boot `tsx src/start.ts` (ports 3217/3218, sqlite copié+migré via vrai CLI, cleanup taskkill Windows) — 11/11 : `/`→302 commerce, vitrine sans menu, cart→302 login+next, solara/beam/imperia/spaces→302, cookie forgé inopérant, form login, 401 générique sans fuite d'email, register 501, démo admin 200 solara+imperia, démo membre 403 imperia.
- `/login` fonctionnel (fetch `/api/auth/login`, erreurs génériques, pas de log credentials) ; `/register` = waiting room explicite (option 1 revue) + `POST /api/auth/register` → 501 `registration_not_enabled` (2 voies), jamais de faux compte. Non-authentifié sur `/login`+`?next=` valide ; authentifié → 302 next||/ ; POST → 405.

## Non fait (annoncé, pas de prétention globale)
- Endpoints `/api/*` par ressource : chantier séparé (P0 avant release exposée) — la PR verrouille SSR+navigation uniquement.
- `PostgresSessionStoreAdapter`, gateway mobile, `dispatchApiRequest`, memberships espace (`getActiveSpaceProfile` non vérifié), inventaire `strictViews` restants.

## Validation
- 56 tests verts : 21 politique + 8 ssr-auth + 6 resolver + 3 auth-routes + 7 profiles + 11 HTTP (9.3s, 2 boots réels).
- ESLint fichiers touchés : propre.
- Incident harness : boot fail-fast DB (copie non migrée) → migrate CLI dans le harness ; cleanup Windows (taskkill /T + retries rm).

## Git State
- Branche : `backlog-tasks-completion-16894022842581055701`, aucun commit.
- Nouveaux : `bac-access.ts`, `bac-access.test.ts`, `pages/auth-pages.ts`, `tests/http/bac-access.http.test.ts`, ce rapport.
- Modifiés : `start.ts`, `home-page.ts`, `bac-page.ts`, `renderer.ts` (déjà), `auth-routes.ts` (501), `commerce-view.ts`, `packages/auth/*` (déjà).
- Rollback : `git checkout -- <modifiés>` + supprimer les 5 nouveaux fichiers.
