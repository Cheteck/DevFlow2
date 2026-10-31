# Audit commit bf25309 + réanalyse god objects
Date: 2026-09-24 | Méthode: diff réel + mesure LOC + subagent vérification câblage/tests | Doc ignorée

## 0. Commit analysé

`bf25309` « refactor: decouple architecture and complete features » (Cheteck, 2026-09-24) — 39 fichiers, +3589/−5891. Prétentions : routing découplé via dispatcher centralisé, logique extraite en services, FEAT-01..13 « COMPLÉTÉ & TESTÉ ».

## 1. Verdict commit : PARTIEL — services réels mais non câblés, découplage affiché mais non branché

### 1.1 Ce qui est réellement livré (vérifié)
- 14 nouveaux modules métier existent : `auction.service.ts` (281 l.), `delivery-partner.service.ts` (217), `registration-wizard` (168), `product-wizard` (291), `shop-analytics` (131), `shop-inventory-report` (151), `csv-parser` (39), `maintenance.service` (72), `category-analysis` (100), `business-registry` (145), `social-auto-share` (147), `form-help-sidebar` (125), `qr-code-generator` (112), `imperia-helpers` (70).
- `portfolio-service.ts` allégé : `csv-parser` vraiment utilisé (`portfolio-service.ts:56,525,555`).
- `tests/backlog-features-2026-09-24.test.ts` existe (322 l., 12 `it`, 11 `describe`) avec assertions métier réelles (transitions, `reserveMet`, chaîne `previousHash`, exclusion bots, `progressPercent 33→100`).

### 1.2 Ce qui est faux ou prématuré
- **« Decouple server routing » contredit** : `src/server/routes/*.ts` (28–100 l.) + `api-dispatcher.ts` (50) + `middleware/maintenance-gate.ts` (69) existent mais **ne sont importés nulle part** (grep `server/routes|api-dispatcher` ne matche que les fichiers eux-mêmes). Code mort.
- **`src/start.ts` a grossi, pas maigri** : 1878 → **1955 l. (+77)**. La gate maintenance est dupliquée inline (`start.ts:176-254`, ~80 l.) au lieu d'utiliser le middleware mort, avec import cross-domain `../apps/imperia/...maintenance.service.js:63` (shell → app, violation layering).
- **`renderer.ts` a grossi** : 989 → **1035 l. (+46)**, `renderMaintenancePage` ajoutée au god object au lieu de le scinder.
- **13 statuts « ✅ COMPLÉTÉ & TESTÉ » prématurés** : tous les services sont en `export *` seul (commerce `index.ts:135-136`, imperia `:159-160`, portfolio `:152-154`, citadelle `:228`, solara `:122`, spaces `:161`, ui-runtime `:32-33`) — zéro `provideCapability`, zéro route, zéro `container`, zéro souscription event, zéro `SlotRegistry.register`. Seul FEAT-01 a un chemin d'exécution réel (gate `start.ts:214-254`). Tests = unitaires sur singletons in-memory (draft « persistant » volatil, anti-sniping jamais exercé, `category-analysis` testé avec `undefined`, share sans bus).
- **`pnpm-lock.yaml` supprimé** (−5807 l.) + ignoré via `.gitignore` : installs non reproductibles, `pnpm install --frozen-lockfile` du CI cassé.
- `packages/ports/http/src/index.ts` −33 l. : vérifier qu'aucun consommateur ne régresse.

### 1.3 Détail par FEAT (câblage réel)
| FEAT | Verdict | Preuve |
|---|---|---|
| 01 maintenance | partiel (gate shell réelle, middleware mort, hors DI) | `start.ts:63,176-211,214-254` vs `maintenance-gate.ts` orphelin ; `imperia/index.ts:90,94` sans capability |
| 02, 03, 04, 05 | non câblé (export seul) | `citadelle:228`, `portfolio:152`, `commerce:135-136` |
| 06+07, 09 | non câblé (volet email/plugin absent) | `portfolio:153-154` |
| 08 | non câblé (aucune écoute `vendable.published`) | `solara:122` vs capabilities `:77,88` |
| 10 | non câblé (pas de badge/révocation UI) | `spaces:161` vs `:81,92` |
| 11 | non câblé (test à vide) | `imperia:160`, `test:297` avec `undefined` |
| 12, 13 | non câblé (jamais `register`) | `ui-runtime:32-33` vs `:17` |

## 2. God objects restants (re-mesure)

| Fichier | Avant | Après bf25309 | Delta | Statut |
|---|---|---|---|---|
| `src/start.ts` | 1878 | **1955** | +77 | empire — a grossi (gate inline) |
| `src/shell/renderer.ts` | 989 | **1035** | +46 | empire — page maintenance ajoutée |
| `imperia/frontend/src/index.ts` | 1634 | 1634 | 0 (−70 extraits en `imperia-helpers.ts`) | reste |
| `beam/frontend/src/index.ts` | 927 | 927 | 0 | reste |
| `portfolio/frontend/src/index.ts` | 664 | 664 | 0 | reste |
| `packages/core/src/kernel.ts` | 578 | 578 | 0 | reste |
| `portfolio-service.ts` | 561 | **526** | −35 | partiellement traité (csv extrait) |
| `booking/frontend/src/index.ts` | 449 | 449 | 0 | reste (XSS `395` intact) |
| `commerce/frontend/src/index.ts` | 415 | 415 | 0 | reste (XSS `370` intact) |
| `feature-flags.ts` | ~319 | 293 | −26 | reste (divergence sync/async intacte) |
| `sdk/src/index.ts` | ~283 | 242 | −41 | reste (globalThis/barrel intactes) |

Bilan : **9 god objects intacts, 2 aggravés (`start.ts`, `renderer.ts`), 1 partiellement traité**. Les XSS P0 (booking `395`, commerce `370-386`, imperia `1198-1211`) sont intacts. Le plan `god-objects-remediation-plan.md` créé par le commit décrit la cible mais le code ne la réalise pas (routes/dispatcher non branchés).

## 3. Actions requises (ordre)
1. Brancher ou supprimer `src/server/routes/*` + `api-dispatcher` + `maintenance-gate` (mort = dette + fausse confiance) ; déplacer la gate `start.ts:214-254` dans le middleware.
2. Câbler les 14 services : `provideCapability` + routes + container + souscriptions events + `SlotRegistry.register` (12/13) ; persistance réelle des drafts (FEAT-03).
3. Corriger les XSS P0 frontends (inchangés).
4. Restaurer `pnpm-lock.yaml` au suivi ou assumer `bun.lock` seul + réparer le CI.
5. Rebasculer les statuts backlog en `partiel` sauf preuve d'intégration (seul FEAT-01 mérite `partiel`, pas `complété`).

## Sources
`git show bf25309 --stat` + diffs (`start.ts`, `index.ts` ×3, backlog), mesure LOC directe (11 fichiers), grep import `server/routes|api-dispatcher` (0 usage), subagent tests/câblage (`tests/backlog-features-2026-09-24.test.ts:27-312`, index/provider/capabilities par app).

## Addendum 2026-09-25 (re-mesure directe, faits vérifiés)
- **Point 1 (code mort) RÉSOLU** : `src/start.ts` importe et utilise `handleMaintenanceGate` (`server/middleware/maintenance-gate.ts`) et `dispatchApiRequest` (`server/api-dispatcher.ts`) — le dispatcher est branché, `start.ts` fait désormais **367 l.** (vs 1955 au moment de l'audit).
- **Point 4 (lockfile) RÉSOLU** : `pnpm-lock.yaml` re-suivi (retiré du `.gitignore`), `pnpm install --frozen-lockfile` fonctionnel.
- Points 2, 3, 5 : non re-vérifiés — restent d'actualité jusqu'à contre-preuve.
