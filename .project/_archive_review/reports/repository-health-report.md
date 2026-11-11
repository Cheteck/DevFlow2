# Repository Health Report

- **Date :** 2026-10-11 · **Workflow :** `/workflow audit repository-health` (risque `low`, diagnostic seul — aucun fix exécuté)
- **Branche :** `backlog-tasks-completion-16894022842581055701` · **Baseline :** premier rapport de ce type (pas de tendance antérieure)
- **État Git au moment de l'audit :** 222 entrées `git status` (travail pré-prod 2026-10-10 stagé, non commité) · HEAD `980262b`

## Health Score

| Dimension | Score | Preuve principale |
|---|---|---|
| Architecture | 8/10 | 0 import direct `@apps/*` inter-BAC (grep vide) ; 10/10 manifestes ; `build:raw` vert (exit 0) |
| Testing | 7/10 | Suite complète : 150 fichiers, **834 passés / 3 échoués / 14 skippés** (36 s) |
| Documentation | 6/10 | README/FRAMEWORK/PACKAGES/bacs présents, BACKLOG piloté ; dashboard figé au 25/09 |
| Security | 6/10 | 0 secret tracké/codé ; `pnpm audit` = **27 GHSA distincts dont ≥2 critical** |
| Maintainability | 7/10 | `eslint .` 0 erreur/0 warning ; 0 TODO/FIXME dans `apps/` ; 32 `console.*` dans `src/` |
| **Moyenne** | **6,8/10** | 🟠 Risques à traiter (pas de bloquant release nouveau) |

## Critical Issues

1. **SEC-DEPS (nouveau, P1)** — `apps/solidarity` épingle `vitest ^1.3.0` (résout 1.6.1) et `apps/subscription` `vitest ^2.0.0` (résout 2.1.9), tous deux sous `GHSA-5xrq-8626` (critical, <3.2.6 ; racine à 3.2.7 patchée). `pnpm audit` liste 27 GHSA distincts (revue exhaustive non faite). Dev-only → blast radius limité, mais CI exécute ce code.
2. **Régression migrate CLI (pré-existante, déjà couverte)** — `packages/cli/tests/cli.test.ts` 3 échecs. Prouvé hors changements locaux : test rejoué avec `migration-commands.ts` HEAD via `git stash` → mêmes 3 échecs, stash restauré proprement. Déjà suivie par `TEST-DEBT-RUNTIME` (pas de doublon créé).
3. **Harness HTTP exige Docker (déjà couvert)** — `tests/http` requiert `docker exec mosaix-db-1` ; daemon injoignable dans ce sandbox → 14 skipped + hooks en échec. Déjà suivi par `TEST-DEBT-RUNTIME`.
4. **État Git sale (222 entrées)** — tout le travail pré-prod 10/10 est stagé mais non commité ; aucun commit créé par cet audit (décision : pas de commit sans demande). Risque : perte/perrissement du staging.
5. **Dashboard obsolète** — `.project/dashboard.md` figé au 2026-09-25, antérieur à ~222 fichiers modifiés + décisions pré-prod. À resynchroniser via `/workflow agent session-end`, pas à la main.

## Mesures corrigées pendant l'audit (honnêteté)

- Première mesure `tsc --noEmit` brut : dizaines d'erreurs → **fausse alerte**, mauvaise config (`tsconfig.json`). La gate canonique `pnpm build:raw` (`tsconfig.build.json`) est **verte, exit 0**. Le rapport ne retient que la gate canonique.

## Recommendations

1. Merger ou commiter le staging pré-prod (puis resynchroniser dashboard via `session-end`).
2. Traiter `SEC-DEPS` avant d'élargir la CI (un `pnpm audit --audit-level=high` en gate CI suivra).
3. Migrer les 32 `console.*` de `src/` vers le `Logger` `@mosaix/core` (voir `LOG-STRUCT`) ; interdire les nouveaux via règle eslint.
4. Ajouter `.gitattributes` (`* text=auto eol=lf`) — warnings LF/CRLF à chaque staging Windows.
5. `pnpm outdated` : 12 devDeps en retard dont 4 majeurs (eslint 10, TS 7, vitest 5, @types/node 26) → planifier hors release (déjà couvert par `CONF-DETTE`).

## Backlog Candidates

- `SEC-DEPS` (P1, créé) — voir BACKLOG.md.
- `LOG-STRUCT` (P2, créé) — voir BACKLOG.md.
- Dérives déjà couvertes, non dupliquées : `TEST-DEBT-RUNTIME` (migrate CLI, harness Docker, prettier 935 fichiers), `CONF-DETTE` (majors + prettier), `BOUND-02` (PSP live), `TSC-RAW` (DONE).

## Non vérifié (score 0, mention explicite)

- Couverture % (pas de `test:coverage` lancé — 36 s déjà consommées par le run simple).
- Fichiers >400 lignes (scan complet >120 s, abandonné ; `renderer.ts`/`bac-orchestrator.ts` suspects habituels non mesurés).
- Sévérités détaillées des 27 GHSA (seules 2 critical lues).
- CI verte de bout en bout (`pnpm check` complet non relancé ici ; vitest seule = 3 rouges pré-existants → CI serait rouge).
