# Session 2026-10-11 — Fix rail primaire minimisé (scroll X + zone vide, pré-existant)

## Objectif
Améliorer l'état minimisé de la sidebar principale : le rail 76px gardait un
scroll horizontal et un espace vide à côté des icônes de BACs. Problème
pré-existant (antérieur aux travaux en cours), corrigé à la racine.

## Diagnostic (vérifié, pas supposé)
- Chaque icône du rail embarquait un tooltip `absolute` positionné au-delà du
  bord droit du rail (76px) ; le conteneur nav est `overflow-y-auto`, ce qui
  fait basculer l'axe X en `auto` → scroll horizontal + zone vide scrollable
  (les tooltips invisibles `opacity-0` occupaient l'espace).
- `.no-scrollbar` n'était servi que sur la home (`renderHeadBlock`) ; les
  pages BAC (`renderBacPage`) ne l'incluent pas → scrollbars visibles.
- Les tooltips du rail étaient de toute façon clippés/cassés dans le
  conteneur scrollable.

## Travaux réalisés
1. `src/shell/renderer.ts` — `renderPrimarySidebar` : suppression des 6
   tooltips absolus (brand, recherche, accueil, BACs, menu mobile, avatar) →
   `data-rail-tip`/`data-rail-sub` + `aria-label` ; nav `overflow-x-hidden`
   (+ `aria-label="Navigation principale"`) ; conteneur SSR unique
   `#rail-tooltip[role=tooltip][aria-hidden=true]`. Nouveau
   `PRIMARY_RAIL_SHARED_CSS` exporté (`.no-scrollbar` + `.rail-tip` en
   variables `--color-*`, indépendant du mode, `prefers-reduced-motion`).
2. `src/start.ts` — `getSharedStyles` embarque `PRIMARY_RAIL_SHARED_CSS`
   (toutes pages, tous modes) ; import ajouté (aucun cycle).
3. `src/shell/client/shell-client-scripts.ts` — `initRailTip` centralisé :
   mouseover/focusin, contenu `textContent` (anti-XSS), clamp viewport,
   hide sur scroll/resize/blur/Escape, rail masqué (mobile) ignoré.
4. `src/shell/guest-surfaces.test.ts` — 5 verrous : axe X, absence tooltips
   absolus (guest + member), data/aria + conteneur, CSS partagé, wiring JS.

## Validation
- `vitest run src/shell` : **74/74 verts** (8 fichiers, baseline 69 + 5).
- ESLint propre (renderer, shell-client-scripts, start, test).
- Serveur réel (PG `mosaix_dev`, port 3199) : `/` et `/commerce` → `84px`
  absent du HTML, `#rail-tooltip` + `overflow-x-hidden` + `.no-scrollbar`
  présents. Fausse alerte écartée en cours de route (le motif venait d'un
  commentaire JS embarqué, reformulé).

## Non-scope (Minimal Sufficient Change)
- Sidebar secondaire / état `sidebar-collapsed` : inchangés.
- Autres modifications non commitées de l'arbre (bac-access, commerce-view…)
  : non touchées.
- `renderHeadBlock` garde son `.no-scrollbar` historique (duplication
  inoffensive, même règle).

## Git State
- Fichiers touchés : `src/shell/renderer.ts`,
  `src/shell/client/shell-client-scripts.ts`, `src/start.ts`,
  `src/shell/guest-surfaces.test.ts`, `.project/changelog.md`.
- Rollback : `git checkout --` ces 4 fichiers source. Aucun commit (non demandé).
