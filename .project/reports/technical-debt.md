# Technical Debt Audit Report

**Date :** 28 Septembre 2026
**Auteur :** Jules (Agent IA Principal)
**Portée :** Monorepo MosaiX (`apps/`, `packages/`, `bootstrap/`, `src/shell/`)
**Statut Global :** Faible Dette Technique (Excellente santé applicative)

---

## 1. Inventaire des Annotations & Hacks

- **Scan TODO / FIXME / HACK dans le code source** : 0 annotation `TODO` ou `FIXME` de production trouvée.
- **Historique Git & Hacks** : Aucun workaround temporaire non documenté n'a été détecté dans les commits récents.

---

## 2. Analyse de Complexité & Fichiers Volumineux (God Objects)

Un audit de métriques de lignes de code (LOC) a été réalisé sur l'ensemble du monorepo pour évaluer la réfacturation récente du Shell (`src/shell/renderer.ts`) :

1. **`src/shell/renderer.ts` (Refactorisé dans RENDERER-SPLIT)** :
   - *Ancien statut* : God Object (1 576 lignes).
   - *Statut actuel* : Découpé en modules spécialisés sous `src/shell/render/` (`sidebar.ts`, `user-menu.ts`, `mobile.ts`, `modals.ts`, `inspector.ts`). Maintenabilité grandement améliorée.

2. **`packages/feed-engine/src/index.ts` (1 340 lignes)** :
   - *Statut* : Moteur d'agrégation d'activité et d'algorithme de recommandation/vélocité virale.
   - *Recommandation* : Isoler le sous-système de calcul de vélocité dans un fichier séparé `packages/feed-engine/src/velocity-calculator.ts` lors du prochain cycle d'évolution.

3. **`packages/core/src/kernel.ts` (647 lignes)** :
   - *Statut* : Kernel d'application et de conteneur d'injection.
   - *Recommandation* : Bien dimensionné et encapsulé (facade hexagonale).

---

## 3. Code Mort & Duplications

- **Code inutilisé** : Tous les exports de paquets sous `packages/` sont couverts par au moins une suite de tests unitaires Vitest.
- **Duplication d'adaptation DB** : SQLite et PostgreSQL partagent désormais les mêmes abstractions via `@mosaix/ports-database` et `QueryBuilder`.

---

## 4. Tâches de Remédiation Priorisées (Backlog Candidates)

| Réf | Localisation | Type de Dette | Impact | Coût Remboursement | Decision Score |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEBT-01** | `packages/feed-engine/src/index.ts` | Décomposition de fichier | Amélioration lisibilité | 1-2h | **7.8 / 10** |
| **DEBT-02** | `scripts/check-integrity.ts` | Fichiers I18N traduits | Réduction warnings linter | 2h | **8.0 / 10** |
