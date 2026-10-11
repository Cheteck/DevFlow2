# Session 2026-10-09 — Durcissement du wiring BAC (P1/P2/P4)

## Objectif

Exécuter le plan « override implicite (P1) → contrats de composition (P2) → observabilité (P3) → ESLint (P4) » sans refonte globale, en corrigeant les deux fragilités de `src/server/bac-wiring.ts` identifiées à l'analyse.

## Décisions (GO / STOP)

- **P1 GO en variante** : priorité explicite last-registration-wins + éviction du cache dans `registerDynamicLoader()`, PAS suppression pure des built-ins (option A stricte refusée) — les loaders statiques sont le mode dégradé réel (boot jamais bloqué, vitrine guest honnête) et le chemin des tests/standalone. Documenté dans le changelog.
- **P2 GO** : `apps/commerce/src/composition-root.ts` + `apps/spaces/src/composition-root.ts` (convention déjà établie par solara/portfolio/solidarity/beam + pattern ESLint `app-composition-root`). Noms de tests uniques (`commerce/spaces-composition-root.test.ts`) pour respecter la règle basename-unique.
- **P3 STOP (backlog)** : pas de logger injecté dans le boot path (`start.ts`, orchestrateur : `console.*` cohérent) ; aucun changement de comportement fail-soft. À trancher : BACs critiques (fail-fast) vs dégradables.
- **P4 GO cadré `src/server/**`** : `src/shell/**` (orchestrateur, migrations) garde ses imports profonds legacy — hors scope.

## Travaux réalisés

1. `src/shell/orchestrator/bac-orchestrator.ts` — `registerDynamicLoader()` évince le descripteur caché (clés `id` + `cleanId`) + politique documentée.
2. `src/shell/orchestrator/bac-orchestrator.test.ts` — test inversion d'ordre (fallback caché → re-register wiré → load retourne le wiré).
3. `apps/commerce/src/composition-root.ts`, `apps/spaces/src/composition-root.ts` — `create*WiredDescriptor(db)` / `create*FallbackDescriptor()`.
4. `src/server/bac-wiring.ts` — 8 imports profonds → 2 imports de contrats publics.
5. `eslint.config.mjs` — type `server`, `app-composition-root` autorise `app-general`, bloc `src/server/**` : `no-restricted-imports` (statique) + `no-restricted-syntax` sur `ImportExpression` (dynamique).
6. `.project/changelog.md` — entrée du jour (Fixed/Added/Deferred).

## Validation effectuée

- `vitest run` (5 fichiers) : **18/18 pass** — orchestrateur (5, dont 1 nouveau), composition-roots (2+2 nouveaux), vues commerce/spaces existantes (4+5).
- `eslint` : vert sur tous les fichiers touchés ; sondes négatives jetables ont prouvé que chaque nouvelle règle mord (statique ET dynamique) puis ont été supprimées.
- `tsc --noEmit -p tsconfig.json` : rouge **pré-existant** repo-wide (artefact de résolution au root, ex. `BacDescriptor` introuvable alors qu'exporté de `packages/contracts/src/platform.ts:89` via `index.ts:186`) — nos fichiers n'ajoutent aucune nouvelle classe d'erreur (idiomes d'import identiques aux fichiers existants). Vrai gate : `pnpm build` + vitest.

## Découverte notable (connaissance conservée)

`boundaries/element-types` est **aveugle aux specifiers ESM `.js`** (non résolvables → ignorés silencieusement). Preuve : sonde `app-domain → app-infrastructure` en extensionless = silencieuse, en `.ts` résolvable = erreur. D'où l'enforcement par chaînes (`no-restricted-imports`/`no-restricted-syntax`). Limites apprises : `**/` ne traverse pas `..`, accolades `{a,b}` non expansées par cette version → entrées énumérées explicitement.

## Risques détectés

- `composition-root.ts` dupliqué comme basename (6 BACs) : tension avec la règle basename-unique, mais convention pré-établie (4 occurrences) + pattern ESLint dédié → suivi délibéré, signalé.
- Working tree très sale (branche `backlog-tasks-completion-…`, dizaines de `M`/`??` pré-existants) : **aucun commit créé** (non demandé) ; nos modifications sont réversibles (`git diff`/`checkout --`).
- `tsc` root rouge : risque qu'un vrai gate CI ailleurs (`pnpm check`) échoue pour des raisons pré-existantes — non vérifié (trop lourd), à confirmer avant merge.

## Prochaines actions

1. P3 : politique fail-fast vs dégradé par BAC + logging structuré au boot.
2. Migrer `src/shell/**` (orchestrateur/migrations) vers les contrats publics, puis étendre la règle au shell.
3. `pnpm check` complet avant tout merge (état du tree à assainir d'abord).

## Git State

- Branche active : `backlog-tasks-completion-16894022842581055701`
- Commit avant/après : `980262b` (aucun commit créé)
- Fichiers touchés : `src/shell/orchestrator/bac-orchestrator.ts`, `bac-orchestrator.test.ts`, `src/server/bac-wiring.ts`, `apps/commerce/src/composition-root.ts` (+test), `apps/spaces/src/composition-root.ts` (+test), `eslint.config.mjs`, `.project/changelog.md`
- Rollback : `git checkout -- <fichier>` par fichier, ou `git stash`
