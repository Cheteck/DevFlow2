# Session 2026-10-10 — Analyse pré-production & livraison finale (exécution GO)

## Objective

Éliminer ou compléter tout aspect non-production, sur décision utilisateur (questionnaire 6 questions, toutes tranchées + 1 correctif `frontend/`).

## Travaux réalisés

1. **P1 suppressions sûres + `.gitignore`**
   - `git rm` : `CheckList.txt`, `analysis_files.txt`, `recreate_packages.py`.
   - `git rm --cached` : `data/mosaix.sqlite` (fichier local conservé, plus versionné).
   - `analyses/*.md` déplacés vers `.project/reports/analyse-*.md` (connaissance préservée, pas supprimée) ; dossier `analyses/` supprimé.
   - `checksum.cjs` supprimé (script ponctuel). `opencode.json` ajouté au `.gitignore` (config dev locale, jamais commité) + `data/*.sqlite*`, `analyses/`, `checksum.cjs`.
2. **Inventory P2** : `apps/inventory/node_modules/` local supprimé ; package conservé non stagé (hors release, implémentation ultérieure). Non importé par `src/`/`bootstrap/` (vérifié grep) → déjà exclu du boot.
3. **Runtime prod**
   - `compose.prod.yml` créé : pas de bind-mount, `NODE_ENV/MOSAIX_ENV=production`, `MOSAIX_DEMO_USERS=false`, `ALLOW_IN_MEMORY_IN_PRODUCTION=false`, secrets requis (`:?`), ports DB non publiés, mots de passe via env.
   - `Dockerfile` : `corepack pnpm@10.33.4` → `9.15.4` (aligné `packageManager` + CI).
   - CI réactivée : `on: push/PR → main,master` décommenté.
   - Constat honnête : `pnpm build` = typecheck seul (`tsconfig.build.json` `noEmit`), aucun pipeline `dist` n'existe → `CMD pnpm start (tsx)` conservé + dette P1 documentée dans `compose.prod.yml`. Basculer vers `node dist` sans pipeline casserait le boot.
4. **Paiements réels (BOUND-02)**
   - `checkout-order.workflow.ts` : doubles `Demo*` exportés `@testOnly`, défauts constructeur → `Unwired*Port` fail-closed (fini les commandes `Paid` silencieuses sans PSP).
   - `composition-root.ts` + `commerce-service-provider.ts` (prod) injectent `SatimPaymentPort`. Pas d'adaptateur inventaire réel → échec fort explicite au checkout jusqu'à BOUND-02 (jamais de no-op silencieux).
   - `satim-payment-port.ts` : config env (`SATIM_GATEWAY_URL`, `SATIM_TERMINAL_ID`, `MOSAIX_PUBLIC_BASE_URL`), `console.log` payload supprimés → `Logger` optionnel sans secrets ; note de non-persistance sur holds + `WalletEscrowManager`.
   - `env.schema.ts` + `.env.example` : 3 clés documentées/validées.
   - Tests mis à jour (doubles explicites) : `commerce.test.ts` (2 sites), `commerce-view.test.ts`, `index.ts` (composition legacy test-only).
5. **Câblage + tests** : stagés `bac-wiring`, `auth-guard`, `mcp-routes(+test)`, `bac-access(+test)`, `ssr-auth-context(+test)`, `auth-pages`, `portfolio/solidarity-controller`, composition-roots commerce/spaces, 3 `frontend/` slot-entries + tsconfigs, toutes les migrations BAC, tests solidarity/spaces/commerce/mcp/session-resolver, `tests/http/`.
   - Correctif vs décision initiale : les 3 `frontend/` sont des contributions de slots (rôle distinct des vues SSR `src/presentation`), donc **gardés + câblés**, non supprimés.
   - Non stagés (résiduel) : `apps/inventory/`, `packages/analytics/`, `packages/adapters/session-store-postgres/` (non importés nulle part — triage ultérieur), docs `.project/` (sessions précédentes).

## Validation effectuée

- `vitest` commerce (3 fichiers) : **16/16 verts**.
- Nouveaux modules stagés (18 fichiers) : **110/110 verts** (bac-access, ssr-auth, mcp-routes, session-resolver, solidarity ×6, spaces ×2, strip-fields, offer-repo, mcp ×3).
- `eslint` fichiers touchés : **0 erreur**.
- `tsc --noEmit` : erreurs uniquement dette pré-existante (contrats, `OrderModel`, orchestration) ; **0 erreur sur les lignes modifiées** (`satim-payment-port.ts` propre).
- `tests/http/` : échec environnemental pré-existant (requiert conteneur Docker `mosaix-db-1`, daemon injoignable ici) — à rejouer en CI avec services.

## Risques détectés

- Checkout prod échoue fort (message clair) tant que BOUND-02 n'a pas d'adaptateur inventaire persistant — assumé (fail-closed > oversell silencieux), suit BOUND-02 déjà P0 OPEN.
- ` WalletEscrowManager`/holds SATIM volatils (`Map`) — pas de flux monétaire réel avant persistance (noté en code).
- `mosaix_role` forgé / demo : couvert par `MOSAIX_DEMO_USERS=false` prod + tests `bac-access.http` (à rejouer sous Docker).

## Prochaines actions

1. Rejouer `tests/http/` + suite complète sous Docker/CI (désormais déclenchée).
2. BOUND-02 : adaptateur inventaire persistant + extraction PSP/webhooks/refund.
3. Pipeline `dist` compilé (P1) puis `CMD node dist`.
4. Triage résiduel : `packages/analytics/`, `session-store-postgres/`, `apps/inventory/` (P2).
5. Commit par l'utilisateur (conventionnel, ex. `chore(preprod): ...`) — non commis ici (pas de commit sans demande explicite).

## Git State

- Branche : `backlog-tasks-completion-16894022842581055701` (behind remote 1 commit, non mergé — inchangé).
- Commit avant/après : aucun commit créé (staging uniquement).
- Stagé : suppressions P1 + `.gitignore`, `compose.prod.yml`, `Dockerfile`, `ci.yml`, paiements commerce, `env.schema`, `.env.example`, câblage routes/slots/migrations/tests listés §5.
- Rollback : `git reset -q` (unstage) / `git stash` ; fichiers supprimés récupérables via `git checkout -- <fichier>` tant que non commis… après commit : `git revert`.
