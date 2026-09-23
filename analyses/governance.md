# Audit Gouvernance, Monorepo & Experience Développeur (DX Audit)

- **Auteur :** DX & Governance Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé

---

## 1. Structure du Monorepo & Outillage de Build

Le projet MosaiX s'appuie sur une structure moderne et standardisée :
- **Gestionnaire de Paquets :** `pnpm` avec espaces de travail (`pnpm-workspace.yaml`).
- **Linter & Formatteur :** `eslint` v9 avec configuration flat ESM (`eslint.config.mjs`) et Prettier (`.prettierignore`).
- **Moteur de Tests :** `vitest` v3 avec configuration unifiée (`vitest.config.ts`).
- **Protocole de Documentation Intégré :** Présence du dossier `.project/` incluant la mémoire système (`project_state.md`, `dashboard.md`), le registre des décisions d'architecture (ADR), la feuille de route (`roadmap.md`) et le journal des modifications (`changelog.md`).

---

## 2. Incohérences de Gouvernance & Standardisation

1. **Incohérence de Nommage des Fichiers (File Naming Rule Violation) :**
   - *Règle AGENTS.md :* Chaque fichier du repository doit posséder un nom unique (pas de duplication de nom de fichier entre domaines).
   - *Observation :* Quelques fichiers de tests portent des noms génériques comme `index.test.ts`. Ils doivent être qualifiés (ex: `identity-index.test.ts`, `commerce-index.test.ts`).
2. **Absence de Pipelines CI/CD Visibles dans le Repository local :**
   - *Observation :* Aucun fichier `.github/workflows/ci.yml` n'est configuré pour exécuter automatiquement `pnpm test` et `pnpm lint` sur les Pull Requests.

---

## 3. Plan d'Amélioration DX & Gouvernance

1. **Renommage des Fichiers de Tests Génériques :** Normaliser tous les fichiers `index.test.ts` en `bac-[domaine]-index.test.ts`.
2. **Création du Workflow GitHub Actions (`.github/workflows/ci.yml`) :**
   - Configurer un pipeline de validation automatique (Build, Typecheck Vitest, Lint ESLint, Conformité Monorepo).
3. **Maintien Automatique du Registre des ADRs (`/.project/decisions/`) :** Rédiger un ADR formel pour chaque décision structurante sur la plateforme.
