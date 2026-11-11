# ADR-0022 — Tiroir mobile canonique (un seul par page)

**Status:** Proposed (2026-10-13, en attente de validation humaine avant migration).
**Date:** 2026-10-13.
**Deciders:** Shell steward (proposé par l'agent).
**Références :** `src/shell/ssr-engine.ts` (`renderMobileDrawer` slide-over),
`src/shell/renderer.ts` (`renderMobileDrawer` bottom-sheet), `src/shell/drawer-exclusivity.test.ts`,
revue SSR 2026-10-13 (GO conditionnel), `.project/reports/analyse-god-objects-audit.md` (doublon signalé).

---

## Context

Deux implémentations coexistent :

| | `renderer.ts` | `ssr-engine.ts` |
|---|---|---|
| UX | bottom-sheet + grille BAC, sélecteur de thème | slide-over latéral |
| Consommateurs | home-page, bac-page (toutes les pages servies) | aucun (code mort servi nulle part) |
| Filtrage | RBAC (`getUserAllowedBacs`) | fragment libre fourni par l'appelant |
| Accessibilité | `setOverlayOpen` central, pas de `role="dialog"` | `role="dialog"` + cycle modal complet (2026-10-13) |
| Identifiants | `id="mobile-drawer"` | `id="mobile-drawer-container"` + `id="mobile-drawer"` |
| Global JS | `toggleMobileDrawer()` sans argument (via `shell-client-scripts`) | `toggleMobileDrawer(open?, trigger?)` (script embarqué) |

Inclure les deux sur une même page dupliquerait `id="mobile-drawer"` et
redéfinirait le global `toggleMobileDrawer` (dernier script gagné, comportement
indéterminé).

## Decision

1. **Canonique pour les pages applicatives : le bottom-sheet de `renderer.ts`.**
   C'est le seul servi, le seul filtré RBAC, le seul branché aux triggers existants.
2. **`ssr-engine.ts` reste une implémentation standalone** pour pages sans
   renderer (ex. futures pages publiques légères) — jamais en doublon.
3. **Interdit : les deux tiroirs sur la même page.** Garde-fou exécutoire :
   `src/shell/drawer-exclusivity.test.ts` (un seul `id="mobile-drawer"`, pas de
   `mobile-drawer-container`, un seul global `toggleMobileDrawer`).
4. **Suppression du non-canonique uniquement quand** : tous les consommateurs
   sont identifiés (grep `renderMobileDrawer` + revue), les pages cibles
   migrées, et le test garde-fou étendu aux pages migrées.

## Consequences

- Aucun changement de comportement immédiat (décision de trajectoire, pas de migration).
- La conformité WCAG 2.1 AA du tiroir canonique reste à vérifier
  (clavier + lecteur d'écran) : le cycle modal de `ssr-engine.ts` sert de
  référence d'implémentation lors de la migration.
- Les triggers des pages servies ne portent pas `aria-expanded`/`aria-controls`
  tant qu'ils ciblent le bottom-sheet (ajout prévu à la migration, pas avant —
  un pointeur ARIA vers un composant absent est pire que l'absence).

## Validation

- [x] Test garde-fou vert (home + bac, 6/6).
- [ ] Validation humaine de la trajectoire (ce statut Proposed).
- [ ] Tests clavier/lecteur d'écran du tiroir canonique avant de clore.
