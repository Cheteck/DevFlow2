# Plan de Remédiation Architecture MosaiX

Date : 2026-09-20
Statut : Plan validé suite à l'audit technique

---

## 1. Objectifs du Plan
Ce plan de remédiation adresse les points d'amélioration et les dettes techniques relevés lors de l'évaluation du dépôt :
1. Élimination des redondances et modules obsolètes (`apps/citadelle`, `apps/booking`).
2. Modularisation et assainissement du shell (`src/shell/renderer.ts`).
3. Suppression des utilitaires dupliqués (`src/utils/security.ts`, `packages/orm/src/traits.ts`).
4. Harmonisation des configurations de build (`tsconfig.json`) et nettoyage des artefacts jetables.

---

## 2. Étapes d'Exécution

### Phase 1 : Nettoyage et Suppression des Redondances
- [ ] **Suppression de `apps/citadelle`** : Redondant avec les modules d'authentification et d'identité centraux (`packages/auth`).
- [ ] **Suppression ou Archivage de `apps/booking`** : Squelette TODO sans logique métier avérée.
- [ ] **Suppression des fichiers jetables** : Nettoyage de `recreate_packages.py` et autres scripts temporaires hors workspace standard.

### Phase 2 : Dédoublonnage des Utilitaires et Traits
- [ ] **Suppression de `src/utils/security.ts`** : Migration complète des appels vers `packages/support/src/html.ts` (échappement HTML, `safeHref`).
- [ ] **Suppression de `packages/orm/src/traits.ts`** : Utilisation exclusive du paquet unifié `packages/traits` (`CacheableTrait`).

### Phase 3 : Refactorisation du Shell Monolithique (`src/shell/renderer.ts`)
- [ ] Extraire les vues de la console d'administration Imperia et les tableaux CTA par BAC dans des sous-modules modulaires (`src/shell/views/`).
- [ ] Éliminer les chaînes HTML monolithiques, les scripts inline (`onclick`, `alert()` de debug) au profit d'une approche événementielle propre ou de templates structurés.

### Phase 4 : Harmonisation TypeScript & Validation
- [ ] Unifier les configurations `tsconfig.json` des applications BAC (`apps/_template`, `apps/portfolio`) pour respecter les alias globaux du monorepo.
- [ ] Exécuter `compile_applet` et `lint_applet` pour garantir l'absence de régression.
