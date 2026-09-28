# Structural Gap Analysis Report

**Date :** 28 Septembre 2026
**Auteur :** Jules (Agent IA Principal)
**Portée :** Monorepo MosaiX (`apps/`, `packages/`, `bootstrap/`, `src/shell/`)
**Statut :** Nominal — 0 Violation Majeure de Dépendances

---

## 1. Synthèse de l'Architecture Intentionnelle vs Réelle

L'architecture intentionnelle de MosaiX repose sur une **Architecture Hexagonale Découplée (Ports & Adapters)** et un **Rendu Tri-Zone Découplé (Composition Runtime)** :
- **Couche Contrats & Fondations (`@mosaix/contracts`, `@mosaix/foundation`, `@mosaix/schemas`)** : Doit rester indépendante de tout moteur HTTP, base de données ou UI spécifique.
- **Couche Domaine BAC (`apps/*`)** : Chaque Bounded Application Context (10 BACs) possède son propre domaine autonome (`src/domain/`) et expose un manifest canonique.
- **Couche Infrastructure & Adapteurs (`packages/adapters/*`)** : Contient les implémentations concrètes (PostgreSQL, SQLite, S3, Ses, LaunchDarkly).
- **Runtime Shell (`src/shell/`) & Bootstrap (`bootstrap/`)** : Orchestration globale, résolveur de sessions central (`SessionResolver`), et routage applicatif.

---

## 2. Matrice d'Écart Structurel

| Composant / Domaine | Structure Intentionnelle | Structure Réelle | Écart Constaté | Sévérité | Détecté par CI ? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **@mosaix/contracts** | Pure ABI/Interface sans dépendances d'infra | Exporte uniquement interfaces et VO pure | Aucun | 🟢 Conforme | Oui (`scripts/check-contracts.ts`) |
| **Manifests BACs (10/10)** | Topologie ordonnée et déclarative (`MANIFEST`) | 10 manifests découverts et ordonnés sans cycles | Aucun | 🟢 Conforme | Oui (`scripts/check-contracts.ts`) |
| **Session Authority** | Moteur centralisé dans `@mosaix/auth` (ADR-017) | `SessionResolver` + Composition Root `bootstrap/auth-composition.ts` | Aucun (Traité dans AUTH-01..08) | 🟢 Conforme | Oui (`pnpm vitest`) |
| **Shell HTML Renderer** | Composants isolés par zone UI | Décomposé sous `src/shell/render/` (`sidebar`, `user-menu`, etc.) | Aucun (Traité dans RENDERER-SPLIT) | 🟢 Conforme | Oui (`check-integrity.ts`) |
| **In-Memory Guard** | Refus des stubs/fallbacks si `MOSAIX_DEMO_USERS=false` | `InMemoryGuard` protège les repositories de production | Aucun | 🟢 Conforme | Oui (`pnpm vitest`) |

---

## 3. Analyse des Violations de Dépendances & Import Graphs

- **Direction des Dépendances :** `apps/* -> packages/ports/* -> packages/contracts/*`.
- **Graphe d'import :** Aucun import circulaire inter-BAC direct constaté (`citadelle`, `solara`, `solidarity`, `imperia`, `spaces`, `commerce`, `beam`, `portfolio`, `booking`, `subscription` communiquent uniquement via les contrats `@mosaix/*` ou le EventBackplane).
- **Validation CI :** Les contrôles `scripts/check-contracts.ts` et `scripts/check-integrity.ts` s'exécutent en amont de la CI et empêchent tout contournement d'architecture.

---

## 4. Recommandations & Backlog Candidates

1. **[STRUC-01] Automatisation du contrôle d'isolation des imports (ESLint Boundaries)** :
   - *Description* : Ajouter une règle `eslint-plugin-boundaries` stricte dans le CI pour interdire formellement aux Bounded Contexts d'importer directement depuis `src/shell/` ou les dossiers internes d'autres BACs.
   - *Priorité* : Faible (préventif).
   - *Decision Score* : 8.2/10.

