# Audit God Objects — code réel uniquement
Date: 2026-09-24 (création) + mise à jour post-commit `bf25309` | Méthode: mesure LOC + 3 subagents white-box + re-mesure directe | Doc ignorée

## Intention

Cartographier les fichiers qui concentrent trop de responsabilités, quantifier le risque (testabilité, conflits merge, blast radius) et proposer un découpage module par module avec plages de lignes, sans changer le comportement.

## Verdict global

7 god objects avérés + 2 quasi/dispersés. Le plus rentable à attaquer : `src/start.ts` (17 responsabilités, testabilité ~nulle) puis `src/shell/renderer.ts` (filtre RBAC tripliqué), puis les XSS des frontends booking/commerce/imperia.

**Mise à jour post-`bf25309` (re-mesure directe, voir §5) : 9 god objects intacts, 2 aggravés (`start.ts` +77 l., `renderer.ts` +46 l.), 1 partiellement traité (`portfolio-service.ts` −35 l. via `csv-parser`). Les XSS P0 sont intacts. Les `src/server/routes/*` + `api-dispatcher` créés par le commit sont du code mort (0 import) — voir `analyses/commit-bf25309-audit.md`.

## 1. Classement (hors node_modules, hors tests)

| # | Fichier | Lignes (post-`bf25309`) | Responsabilités | Risque |
|---|---|---|---|---|
| GO-1 | `src/start.ts` | **1955** (+77, gate maintenance inline `176-254`) | ~18 (12 routes API + gate 503 + page maintenance + 2 pages SSR + JS client ×2 + boot) | Critical |
| GO-2 | `apps/imperia/frontend/src/index.ts` | 1634 (−70 extraits vers `components/imperia-helpers.ts`) | ~8 (imports cycliques, styles, settings 550 l., gouvernance 930 l., client-JS 500 l., page dupliquée) | Critical (XSS flags) |
| GO-3 | `src/shell/renderer.ts` | **1035** (+46, `renderMaintenancePage` ajoutée) | ~13 (RBAC, 2 sidebars, CTA 9 BAC en dur, usermenu, drawer, palette, inspector, toast, maintenance) | High (filtre RBAC ×3) |
| GO-4 | `apps/beam/frontend/src/index.ts` | 927 | ~4 (admin, messenger 900 l., client-JS + 15 stubs, contribs) | Medium (perf SSR, logique simulée) |
| GO-5 | `apps/portfolio/frontend/src/index.ts` | 664 | ~4 (catalogue, PIM-admin redondant, client-JS, contribs) | Medium (dérive catalogue/PIM) |
| GO-6 | `packages/core/src/kernel.ts` | 578 | ~9 (config, façade 10 getters, modules, lifecycle, apps, capabilities 60 l., router, santé, tri topo) | High (effets de bord constructeur, diamant) |
| GO-7 | `apps/portfolio/src/domain/portfolio-service.ts` | **526** (−35, `csv-parser.ts` extrait et câblé `56,525,555`) | ~5 (CRUD, workflow, invariants, search in-memory, scoring — CSV sorti) | High (import CSV sans transaction) |
| GO-8 | `apps/booking/frontend/src/index.ts` | 449 | ~5 (admin, CSS 100 l., page, client-JS, contribs) | Critical (XSS `bookSlot` L395 intact) |
| GO-9 | `apps/commerce/frontend/src/index.ts` | 415 | ~4 (admin, CSS 177 l., checkout saga simulée, contribs) | High (XSS `startCheckout` L370 intact) |
| Q-1 | `src/shell/feature-flags.ts` | 293 | 5 (catalogue 17 flags, seed+disque, évaluation, cast interne, persistance) | High (sync/async divergent, perte allowlists) |
| Q-2 | `packages/sdk/src/index.ts` | 242 | 5 (façade, barrel 5 paquets, store global, résolution 4 niveaux, bootstrap) | Medium (globalThis, bundle serveur côté client) |

Non god objects : `theme-resolver.ts` (386 l., 5 steps pures OK — seuls factory/wiring à sortir), `discovery.ts` (60 l. — effet de bord à l'import à corriger).

## 2. Détail par fichier (preuves)

### GO-1 `src/start.ts` — 1955 l. post-`bf25309` (+77), ~18 responsabilités
R1 bootstrap/DI `20-37,63-130` ; R2 HTTP (CORS `140-147`, OPTIONS, static, rate-limit) `132-171` ; **R2bis gate maintenance inline `176-254`** (route `/api/imperia/maintenance` + 503 APIs + page 503 HTML — aurait dû vivre dans `src/server/middleware/maintenance-gate.ts`, mort) ; R3 theme ; R4 cookies ; R5 flags ; R6 compositions ; R7 preset ; R8 PSP ; R9 GDPR ; R10 SSE ; R11 feed ; R12 diag/404 ; R13 RBAC ; R14 SSR BAC ; R15 SSR Home ; R16 JS client ×2 (~180 l. dupliquées) ; R17 `listen`. Un seul closure.
Mélanges : GDPR parse+anonymize+publish+writeHead ; `POST /api/feed` escape+2 persistances+publish ; double import `renderMobileDrawer` (signatures incompatibles `ssr-engine.ts:107` / `renderer.ts:722`) ; **import cross-domain `../apps/imperia/...maintenance.service.js:63`** (shell → app). Blast radius : `loadManifest` sync crash tout le boot.
Découpage : **brancher d'abord** `src/server/routes/*.routes.ts` + `api-dispatcher` + `maintenance-gate` (morts) puis `shell/server/{bootstrap,middlewares}.ts` + `shell/pages/{bac,home}.page.ts` + `shell/client/*.js` statiques ; résiduel `start.ts` ~80 l.

### GO-2 `apps/imperia/frontend/src/index.ts` — 1785 l.
Imports cycliques `5-12` ; `renderBacAdminSafely 40-65` ; settings 550 l. `87-637` (7 sous-pages) ; gouvernance 930 l. `645-1574` ; `<script>` 500 l. `1074-1572` (flags `1124-1296` via `fetch /api/feature-flags`, `saveSettingsCategory → POST /imperia/settings/batch 1492`, `shipCommerceOrder 1564`) ; page dupliquée `1577-1708` (re-appelle `renderImperiaSettingsView 1601`, script dupliqué `1603-1705`).
XSS : flags-table `1187-1211` (`flag.key/description/roles 1190-1201` sans escape, source `flagKeyInput 1047`) ; `${message} 60`. IDs `settings-subpage-*` en double.
Découpage : `styles/imperia.css` + `views/settings/*.html.ts` ×7 + `views/governance-page.ts` + `client/{settings-batch,feature-flags,diagnostics}.js` + `contributions/imperia.contribs.ts` ; supprimer `1577-1708`.

### GO-3 `src/shell/renderer.ts` — 1035 l. post-`bf25309` (+46)
+ `renderMaintenancePage` (nouvelle responsabilité R13, aurait dû aller dans `src/shell/components/maintenance-page.ts` qui existe mais n'est pas utilisé par le renderer — vérifier le doublon). Reste inchangé : RBAC ; primary sidebar ; CTA 9 BAC en dur `137-199` ; Imperia admin hardcodé `215-376` ; sidebar générique ; usermenu (contributions hardcodées `671-704`) ; drawer ; search ; palette ; inspector ; toast.
Filtre `allowedApps` tripliqué. `onclick="alert(...)"` + `switchActiveSpace` sans escape systématique.
Découpage : `shell/ui/{rbac-helpers,primary-sidebar,secondary-sidebar,imperia-admin-nav,bac-ctas,user-switcher,mobile-drawer,command-palette,dev-inspector,toast}.ts` ; registre `Map<bacId,CtaConfig>` + contributions registry ; trancher le double `renderMobileDrawer` ; fusionner `renderMaintenancePage` avec `components/maintenance-page.ts`.

### GO-4 beam frontend — 1010 l.
Admin `4-77` ; messenger 900 l. `79-977` (liste `91-289`, chat `292-494`, inspector `497-663`) ; client-JS `667-974` (`appendMessage 721`, `showSimulatedReply 775` hardcodé, ~15 `window.*` stubs `880-972`) ; contribs `979-1010`. 15 `<img lh3.googleusercontent>` sans lazy. Point positif : `escapeHtml 786-790` utilisé `740`.
Découpage : `views/admin-channels.ts` + `views/messenger/{list,thread,inspector}.ts` + `client/{messenger,beam-actions}.js` (stubs → vraies API).

### GO-5 portfolio frontend — 706 l.
Catalogue `36-642` (header, modal, KPI, toolbar, table `218-367`, grille) + `<script> 431-639` (`exportPortfolioJson 563` via Blob, `addNewProductItem 580-638` avec `row.innerHTML 591-631`) ; PIM-admin redondant `644-677` (mêmes SKU `237,280` vs `669-670`) ; contribs `679-706`. `exportPortfolioJson 564` lit le DOM comme source de vérité.
Découpage : `views/catalog/{header,kpi,toolbar,table,grid}.ts` + fusion/suppression PIM-admin + `client/{pim-filters,pim-crud}.js`.

### GO-6 `packages/core/src/kernel.ts` — 647 l.
Config+bootstrap `60-87` (installe `ObservabilityModule` + `defaultModules 79-84` dans le constructeur — effet de bord) ; façade 10 getters `98-178` ; modules `182-206` ; lifecycle 7 états `210-307` ; apps `311-406` ; capabilities `410-539` (`executeCapability 464-523` : permission+contrat+tracing+metrics+lookup en 60 l.) ; router `543-585` ; santé `587-612` ; tri topo `616-646`. Validation zod `313`, `RouteRegistry` champ `57`, grammaire permissions en dur `532-539`.
Découpage : `kernel-{config,lifecycle}.ts` + `module-registry.ts` + `app-registry.ts` + `capability-boundary.ts` + `router-mount.ts` + `module-health.ts` ; façade fine ou suppression getters legacy `store:142,bus:155,authz:164`.

### GO-7 `portfolio-service.ts` — 526 l. post-`bf25309` (−35, partiellement traité)
`csv-parser.ts` (39 l.) extrait et réellement câblé (`portfolio-service.ts:56,525,555`) — seule extraction effective du commit. Reste : CRUD ; workflow ; invariants ; search in-memory (via `findAll`, contourne le repo) ; scoring (poids magiques, i18n). `importCsv` sans transaction (état moitié-importé), lignes sautées silencieusement. Validateurs `private` non testables.
Découpage restant : `vendable-{crud-service,search,invariants}.ts` + `workflow-machine.ts` + `completeness-scorer.ts` (poids injectables) ; `importCsv` transactionnel ; `search` délégué au repository.

### GO-8 booking frontend — 478 l. — XSS avéré
`submitNewSlot 385-396` : `${serviceName}` (input `slot-service-name 238`) dans `innerHTML` + attribut `onclick="bookSlot('slot-custom','${serviceName}',...)" 395` → casse d'attribut. `showBookingNotice 404-409` = `alert`. `catch` → faux succès `427,444`. `content:{html:render()} 476` fige le HTML (vs `render:()=>` ailleurs).
Découpage : `styles/booking.css` (`67-168`) + `views/{admin-slots,booking-page}.ts` + `client/booking.js` (`textContent` + `addEventListener`) + contribs uniformisées.

### GO-9 commerce frontend — 433 l. — XSS + saga simulée
`startCheckout(productName) 359` concaténé dans `innerHTML 370,378` sans escape (source `onclick 294,307,320`) ; saga `setTimeout 800/1600/2400` 100% client, aucun `fetch` ; `showCommerceToast 62-67` = `alert` ; double enregistrement admin `order:40` vs `order:30` (`406-410` vs `81`).
Découpage : `styles/commerce.css` (`90-267`) + `views/{admin-orders,checkout}.ts` + `client/checkout-saga.js` (vraie API) + fusion contribs.

### Q-1 `feature-flags.ts` — 319 l.
Catalogue `12-130` ; seed+disque `147-194` (JSON sans schéma `167-171`) ; évaluation `200-256` (hash inline `244-250`) ; cast interne `(adapter as …).flags 258-264` ; persistance `266-316` qui jette allowlists/rollout pourtant évalués. `isEnabledSync` ignore allowlists → 2 réponses différentes pour un même flag. Singleton à l'import `319`.
Découpage : `flag-{catalog,disk-store,policy-evaluator,manager}.ts`, init explicite, validation schéma.

### Q-2 `sdk/src/index.ts` — 283 l.
Façade `28-105` ; barrel 5 paquets `107-128` ; store global + `globalThis.__mosaix_feature_flags 130-161` ; résolution 4 niveaux ×2 `171-240` (+ `process.env`, `console.warn`) ; bootstrap `256-281` (connaît `kernel.context.container 262`). Importe runtime+ORM+orchestration dans le bundle client.
Découpage : `mosaix-app.ts` + `bootstrap.ts` + `feature-flags/{flag-store,flag-resolution}.ts` ; supprimer le barrel ou le déplacer.

## 3. Duplication inter-frontends (factuel)
- `window.alert` identique : imperia `1075-1080`+`1604-1609`, beam `872-877`, portfolio `524-529`, booking `404-409`, commerce `62-67` → un `client/notice.js` partagé.
- Export JSON : imperia `1214-1222`+`1525-1531`, portfolio `570-576` → un `client/export-json.js`.
- Modales : imperia `1039-1068`+`1248-1296` ≈ portfolio `82-101`+`531-561`.
- `registerAdminPage({badge,metrics})` même shape : beam `71-75`, portfolio `14-18`, booking `59-63`, commerce `82-86`.
- Filtres DOM + switch tabs : beam `839-846`, portfolio `501-522`, booking `358-368`, imperia `1083`+`1611`, `1374-1383`.

## 4. Plan de découpage priorisé (sans changement de comportement)
P0 sécurité : XSS booking `395`, commerce `370-386`, imperia `1198-1211` (`escapeHtml` + `textContent`) — intacts post-`bf25309`.
P1 shell : **brancher ou supprimer** `src/server/routes/*` + `api-dispatcher` + `maintenance-gate` (morts, grep 0 usage) ; déplacer la gate `start.ts:176-254` dans le middleware ; extraire `shell/pages/*.page.ts` + `shell/client/*.js` ; dédupliquer filtre RBAC `renderer.ts` (1 source) ; trancher `renderMobileDrawer` ; sortir contributions usermenu/CTA vers registry ; fusionner `renderMaintenancePage` avec `components/maintenance-page.ts`.
P2 domaine : scinder `kernel.ts` (7 modules), `portfolio-service.ts` restant (5 modules), `feature-flags.ts` (4 modules) ; sortir `*.css` et `client/*.js` des 5 frontends ; casser le cycle d'imports imperia `5-12` ; câbler les 14 services FEAT (`provideCapability`/routes/container/events/slots — actuellement `export *` seul).
P3 hygiène : `importCsv` transactionnel, `search` délégué au repository, poids scorer injectables, `discovery.ts` sans exécution à l'import, SDK sans `globalThis`/`process.env`/barrel, `pnpm-lock.yaml` re-suivi ou CI réparé.

## 5. Re-mesure post-`bf25309` (directe, 2026-09-24)

| Fichier | Avant commit | Après commit | Delta |
|---|---|---|---|
| `src/start.ts` | 1878 | 1955 | **+77** (gate inline, routes/ mortes non branchées) |
| `src/shell/renderer.ts` | 989 | 1035 | **+46** (`renderMaintenancePage`) |
| `imperia/frontend/src/index.ts` | 1634 | 1634 | 0 (−70 vers `imperia-helpers.ts`) |
| `beam/frontend/src/index.ts` | 927 | 927 | 0 |
| `portfolio/frontend/src/index.ts` | 664 | 664 | 0 |
| `packages/core/src/kernel.ts` | 578 | 578 | 0 |
| `portfolio-service.ts` | 561 | 526 | −35 (seule extraction effective) |
| `booking/frontend/src/index.ts` | 449 | 449 | 0 |
| `commerce/frontend/src/index.ts` | 415 | 415 | 0 |

Détail complet : `analyses/commit-bf25309-audit.md`.

## Sources
Subagents : shell (`start.ts`+`renderer.ts`), frontends (imperia/beam/portfolio/booking/commerce), domaine-core (kernel/portfolio-service/sdk/resolver/discovery/feature-flags). Mesure LOC : `Get-ChildItem -Recurse *.ts` hors node_modules/tests.

## Addendum 2026-09-25 (re-mesure directe)
| Fichier | Audit (2026-09-24) | Aujourd'hui | Statut |
|---|---|---|---|
| `src/start.ts` | 1955 (GO-1 Critical) | **367** (dispatcher + maintenance-gate branchés) | **Résolu** — découpage effectif |
| `packages/core/src/kernel.ts` | 578 (GO-6) | 578 | Inchangé — toujours à traiter |
| `packages/feed-engine/src/index.ts` | non listé | 580 | Nouveau candidat à auditer |
| Autres GO-2..GO-9, Q-1/Q-2 | voir §1 | non re-mesurés | Présumés inchangés |
