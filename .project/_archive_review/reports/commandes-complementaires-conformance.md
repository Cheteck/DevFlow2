# Document de Proposition — Commandes Complémentaires `@mosaix/conformance` & Slop Checker

**Statut** : Proposition & Guide CLI v1.0
**Auteur** : Senior Conformance & Performance Engineer
**Cible** : Développeurs MosaiX, CI/CD GitHub Actions & Agents d'IA

---

## 1. Contexte & Motivation

Afin de renforcer la gouvernance de la qualité de code, l'isolation des Bounded Contexts (BACs) et l'éradication du code factice (« slop »), MosaiX s'appuie sur le package `@mosaix/conformance` et la CLI `packages/cli`.

Ce document recense les **commandes complémentaires existantes et proposées** pour enrichir la suite de contrôle et faciliter le travail au quotidien.

---

## 2. Catalogue des Commandes de Conformité & Slop Checker

### 2.1 Commandes Slop Checker (`PRD-0012`)

| Commande | Scope & Options | Description & Usage | Code de sortie |
|---|---|---|---|
| `pnpm mosaix check:slop` | Scope `code` (par défaut) | Analyse tous les fichiers `.ts`/`.tsx` sous `src/`, `apps/`, `packages/`, `scripts/` (hors tests). | `0` (Vert), `1` (Fautif), `2` (Erreur) |
| `pnpm mosaix check:slop --scope=diff` | Scope `diff` (`origin/main`) | Analyse uniquement les fichiers modifiés par rapport à la branche de base. | Idem (bloquant PR) |
| `pnpm mosaix check:slop --scope=docs` | Scope `docs` (`.md`) | Contrôle la documentation, les promesses non tenues et les TODOs obsolètes. | Idem |
| `pnpm mosaix check:slop --strict` | Mode strict | Traite également les avertissements P1 (`warn`) comme bloquants. | `1` si avertissement présent |
| `pnpm mosaix check:slop --format=json` | Output JSON public v1 | Génère un rapport JSON structuré et déterministe pour les agents d'IA. | Utile pour skill `slop-check` |

### 2.2 Commandes d'Architecture & Invariants `@mosaix/conformance`

| Commande | Script / Classe | Description & Périmètre |
|---|---|---|
| `pnpm check:conformance` | `scripts/validate-conformance.ts` | Valide la conformité des 11 BACs aux spécifications PRD-App (structure, manifests, services). |
| `pnpm check:integrity` | `scripts/check-integrity.ts` | Valide les règles d'intégrité globale (DDL hors migrations, SQL direct, imports inter-BAC). |
| `pnpm check:contracts` | `scripts/check-contracts.ts` | Vérifie la cohérence des contrats d'interface, des types exportés et des dépendances. |
| `pnpm check:manifests` | `scripts/validate-manifests.ts` | Découvre, trie topologiquement et valide tous les fichiers `mosaix.json`. |
| `pnpm check:ui-contracts` | `scripts/validate-ui-contracts.ts` | Valide la structure des cartes d'applications (`appCard`), icônes et titres. |
| `pnpm check:themes` | `scripts/check-themes.ts` | Valide la cohérence des thèmes enregistrés sous `themes/`. |

---

## 3. Commandes Complémentaires Proposées (Feuille de Route)

### 3.1 `pnpm mosaix check:deps` (Analyse de Graphe de Dépendances)
- **Objectif** : Détecter les dépendances non déclarées dans les `package.json` de workspace ou les cycles de dépendances entre packages `@mosaix/*`.

### 3.2 `pnpm mosaix check:performance` (Budgets de Performance SSR & Bundles)
- **Objectif** : Valider le poids du HTML SSR (< 50 KB) et les métriques de rendu avant livraison en pré-production.

### 3.3 `pnpm mosaix check:all` (Suite de Validation Globale)
- **Objectif** : Exécuter séquentiellement l'ensemble des vérifications `check:*` et `check:slop` avec agrégation des rapports SARIF/JSON pour la CI.

---

## 4. Intégration dans le Workflow Développeur & CI

```bash
# Workflow de développement quotidien :
pnpm mosaix check:slop --scope=diff     # Avant chaque commit
pnpm check                              # Valide l'ensemble des contrats avant PR
```
