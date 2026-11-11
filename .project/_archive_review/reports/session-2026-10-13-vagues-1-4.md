# Session 2026-10-13 — Vagues V1–V4 (restauration + preuves + décision)

## Vague 1 — Restaurations (4 commits, tout vert)

- **V1.1** `a04e055` — `PendingPayment` : union `OrderStatus`, machine (`PAY→PendingPayment`, `CONFIRM→Paid`, `CANCEL`, tolérance legacy `Pending→Paid` webhook), saga → `PendingPayment` (jamais `Paid` direct), CHECK `commerce.shop.v1.004`, tests machine + service. **Commerce 13/13.**
- **V1.2** `5af77ea` — saga proposal : `approvedTerms`/`approvedOfferId`/`idempotencyKey`/`auditTrail` (trail sur chaque transition), replay idempotent sans doublon, provision-avant-vendable (zéro orphelin), colonnes PG + `portfolio.catalog.v1.007`, 3 nouveaux tests. **Proposal+portfolio 15/15.**
- **V1.3** `5505887` — route `POST /api/spaces/:spaceId/proposals` + wiring dispatcher + test recréés. **5/5.**
- **V1.4** `b124b0a` — `PromotionEngine.evaluateStack` (non-stackable seul, fail-closed) + 2 tests. **Commerce 17/17.**

## Vague 2 — Vendeur E2E (`144ed3a`)

Route accepte formulaires urlencoded (mapping prix/stock → `content.commercialTerms`/`characteristics`) + 303 SSR ; vue `sell` exige un espace (sélecteur sinon), formulaire nommé, bannières `submitted`/`error`. **Route 8/8, vue 7/7.** Chaîne complète prouvée par composition (route→Draft→revue→approbation→offre). `SELL-FLOW-01/02` requalifiés DONE avec preuves au backlog.

## Vague 3 — Preuves P0

- **3.1** `0cfb8cc` — webhook HMAC-SHA256 fail-closed imposé avant CONFIRM (401/503), legacy couverts. **Commerce 21/21.**
- **3.2** — MCP-03c prouvé sans code : deny anonyme `-32001`, JWT valide/faux/expiré. **MCP 11/11.**
- **3.3** — suites frontières+invariants exécutées. **Shell 11/11.** `SHELL-SEC-01` reste OPEN (audit `/api/*`, multi-tenant restants).

## Vague 4 — Validation large et décision

- `build:raw` : **0 erreur** (au passage, `start.ts` résolu `isAuthenticated` depuis `ssrAuth`, `7355f2f` — le lot V0.3 l'exigeait).
- Suites complètes : **commerce 54/54, portfolio 29/29, spaces 15/15, shell ciblé 42/42.**
- Registres : `BACKLOG.md` mis à jour avec preuves (plus d'affirmations) ; migrations `v1.004`/`v1.007` enregistrées (câblage prouvé par build, gardes natives au boot).
- **Décision release : REPORT.** Restent P0 : `AUTH-E2E`, `DB-PGSQL-E2E`, `DATA-07c` (exigent PG live/serveur), canonisation SATIM live, fin `SHELL-SEC-01`, journeys `VIEW-E2E`.

## Git State

- Branche : `jules-15158999047137592866-d7b36864`
- Avant : `a055b8e` (+7 commits V0) → après : `7355f2f` + ce rapport/plan
- Commits V1–V4 : `a04e055`, `5af77ea`, `5505887`, `b124b0a`, `144ed3a`, `0cfb8cc`, `046d744`, `7355f2f`
- Rollback : revert unitaire par hash (commits atomiques) ; `git reset --hard a055b8e` uniquement avec accord
