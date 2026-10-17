# Session 2026-10-13 — Remédiation SSR `ssr-engine.ts` (revue P1/P2)

## Objectif

Traiter la revue du moteur SSR `@mosaix/shell` : clé de cache incomplète (P1),
fragments HTML injectés sans contrat (P1), drawer mobile modal incomplet (P1),
dérives head/viewport/CSP (P2).

## Travaux réalisés

- `src/shell/ssr-engine.ts` : clé cache complète (titre + mode pont + theme id +
  hash FNV-1a des 2 fragments), retour = contenu INTÉRIEUR du `<head>`,
  viewport sans `maximum-scale`, `safeJsonForScript()`, drawer modal accessible
  complet (focus/trap/Échap/inert/scroll-lock/reduced-motion/anti-race, zéro
  `onclick`), contrats de confiance + notes prod en en-tête.
- `src/server/middleware/maintenance-gate.ts` : ordre d'arguments corrigé
  (étaient permutés).
- `src/shell/pages/home-page.ts`, `auth-pages.ts` : recomposition
  `<head>…</head>` valide.
- `src/shell/pages/bac-page.ts` : neutralisation `<` dans le JSON Tailwind.
- `src/shell/ssr-engine.test.ts` : 15 tests de non-régression.
- `.project/changelog.md` : entrée datée.

## Décisions prises

- **GO** sur le périmètre P1+P2 drawer/cache/sécurité (score 34). **STOP** :
  migration Tailwind CDN → build (High, validation humaine requise),
  unification des deux `renderMobileDrawer` (décision architecture, backlog),
  ajout `aria-expanded` sur les triggers existants (pointeraient vers un tiroir
  absent de ces pages — pire que l'absence).
- Retour contenu-intérieur plutôt que bloc `<head>` complet : seul montage
  permettant un document valide avec les scripts client injectés par l'appelant.
- Pas de reformatage Prettier des 3 fichiers pré-existants non conformes à
  HEAD (Minimal Sufficient Change).

## Validation effectuée

- `vitest run src/shell/ssr-engine.test.ts` : 15/15 verts.
- Voisins : 43/43 verts (`guest-surfaces`, `ssr-auth-context`, `bac-access`).
- `eslint` : propre sur les 6 fichiers touchés.
- `tsc -p tsconfig.json` global : rouge pré-existant hors scope ; fichiers
  touchés sans erreur propre (test en `.js`-imports, plus strict que la
  convention locale).
- Prettier : alertes sur 3 fichiers vérifiées pré-existantes à HEAD.

## Risques détectés

- `maintenance-gate.ts:7` : `maintenanceService` absent de `@mosaix/core`
  (erreur tsc pré-existante) — le middleware de maintenance ne compile pas
  dans ce workspace ; à traiter hors session.
- Doublon `renderMobileDrawer` (`ssr-engine.ts` vs `renderer.ts`) toujours
  vivant — trancher en ADR/backlog avant qu'une page n'inclue les deux
  (conflit d'`id` + global `toggleMobileDrawer`).
- Tailwind CDN + `onclick` inline + fonts Google : CSP prod à durcir.

## Prochaines actions

1. ADR build Tailwind prod + CSP (nonce, pas de CDN JS).
2. Trancher le doublon de drawer (supprimer ou migrer les pages).
3. Mesurer SSR froid/chaud sur pages représentatives (`ssr-cache.ts` + pipeline).

## Git State

- Branche active : `feat-plugin-engine-audit-11753157743017484321`
- Commit avant/après : `5eabadc` (aucun commit créé, changements non stagés)
- Fichiers : 6 modifiés + 1 nouveau (`src/shell/ssr-engine.test.ts`)
- Rollback disponible : `git checkout -- <fichiers>` / `git clean -f src/shell/ssr-engine.test.ts`
- Non lié à la session (laissé intact) : `.project/knowledge/cli-commandes-proposees.md`,
  `multivendeur_grille_e_commerce_enrichie_buy_box.html` (untracked pré-existants)
