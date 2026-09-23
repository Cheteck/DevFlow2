# Audit Dette Technique & Conformité Monorepo (Technical Debt Audit)

- **Auteur :** Technical Debt Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé (Basé sur le rapport d'exécution des 116 fichiers de tests Vitest)

---

## 1. Diagnostic de la Dette Technique & Tests Vitest

L'exécution complète de la suite de tests Vitest (`580 succèss, 7 échecs`) met en évidence plusieurs éléments de dette technique :

### 1. Incohérences de Configuration tsconfig.json dans les Plugins
- **Constat :** Erreur `TSConfckParseError` lors du chargement de `plugins/commerce-badge-plugin/tsconfig.json` et `plugins/solara-content-moderator/tsconfig.json`.
- **Cause Racine :** Le fichier `tsconfig.json` est manquant ou le chemin de référence est incorrect dans ces sous-dossiers de plugins.
- **Risque :** Échec potentiel du bundling de typecheck si ces plugins sont compilés de manière isolée.

### 2. Déphasage des Assertions de Conformité (`@mosaix/conformance`)
- **Constat :** Le test `AppConformanceValidator.validateAllWorkspaceApps` échoue en attendant 8 BACs alors que le monorepo en compte désormais 10 (ajout du dossier `_template` et du BAC `booking`).
- **Cause Racine :** Les tests de conformité n'ont pas été mis à jour suite à la création des nouvelles applications.

### 3. Résolution des Héritages de Classes ESM/CJS
- **Constat :** Erreur `TypeError: Class extends value undefined is not a constructor or null` sur certains modèles d'entités (`SpaceModel`, `VariantModel`).
- **Cause Racine :** Problème de résolution de l'import ESM de la classe de base `Model` de `@mosaix/sdk` dans l'environnement de test Vitest.

---

## 2. Plan de Résolution de la Dette Technique

1. **Génération des Fichiers `tsconfig.json` Manquants dans `plugins/` :** Ajouter la configuration TypeScript standard héritée de la racine.
2. **Mise à Jour des Assertions de Conformité (`packages/conformance`) :** Filtrer le dossier `_template` de la validation et mettre à jour le nombre d'applications attendues à 9 BACs actifs.
3. **Harmonisation des Barrel Imports (`@mosaix/sdk`) :** S'assurer que les exports de classes `Model`, `Container` et `Router` dans `@mosaix/sdk` utilisent des chemins explicites pour éviter les imports circulaires `undefined`.
