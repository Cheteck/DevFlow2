# ADR-0026 — Migration Identity & Naming

**Date :** 2026-11-09  
**Statut :** Accepté (proposition de phase 02 de la roadmap migrations TypeScript)  
**Décideurs :** Architecture Steward  
**Lié à :** PRD-0006 (R6, R7), ADR-0006, ADR-0025  
**Roadmap :** Phase 02 — T02-01, T02-04, T02-08

---

## 1. Contexte

Les identifiants de migration doivent être uniques, deterministement triables, et namespacés par origine. Jusqu'à présent :

- Les 10 BACs et le Shell Core utilisent des IDs canoniques `owner.module.version.sequence_name` (via `bac-migrations.ts`).
- La migration `otp` (`apps/otp/src/infrastructure/migrations/20261108000000_create_otp_table.ts`) utilise un ID timestamp `20261108000000_create_otp_table` non canonique, violant R6 et R7.
- Certains fichiers autonomes utilisent des IDs timestamp sans prefixe owner.

Sans convention figée, le tri `compareMigrationIds` échoue et le moteur ne peut pas garantir l'ordre déterministe.

---

## 2. Décision

### 2.1 Convention canonique d'ID

**Format obligatoire :** `<ownerId>.<module>.<migrationVersion>.<sequence>_<name>`

| Champ | Description | Règle |
|-------|-------------|-------|
| `ownerId` | Namespace du propriétaire | `framework.<package>` \| `bac.<name>` \| `plugin.<publisher>.<name>` |
| `module` | Sous-domaine ou flux de migrations | Identifiant stable par module, ex. `identity`, `schema`, `billing`, `reports` |
| `migrationVersion` | Version du module | `v1`, `v2`, … |
| `sequence` | Entier strictement croissant | Comparaison **numérique**, jamais lexicale. Padding recommandé (`001`, `002`). |
| `name` | Libellé descriptif | `create_users`, `add_email`, `move_to_schema`, … |

**Exemples :**
- `framework.core.schema.v1.001.create_settings`
- `bac.citadelle.identity.v1.001.create_users`
- `bac.subscription.billing.v1.001.create_invoices`
- `plugin.ijideals.analytics.reports.v1.001.create_reports`

### 2.2 Version du package vs version du flux de migrations

**Décision D2 :** La version du package logiciel est indépendante de la version du flux de migrations.

Une mise à jour de `@mosaix/core` de 1.2 à 1.3 n'entraîne pas la création d'un nouveau module de migrations. Le package ajoute une migration à son historique existant (ex. `framework.core.schema.v1.003.add_feature_flags`).

Les migrations historiques sont immuables : une migration appliquée ne peut jamais être modifiée.

### 2.3 Migration des IDs non canoniques existants

| Migration actuelle | ID actuel | ID cible | Action |
|--------------------|-----------|----------|--------|
| `20261108000000_create_otp_table` | Timestamp non canonique | `framework.core.otp.v1.001.create_otp_table` | Renommer, mettre à jour le provider |
| `20261108000000_create_otp_table_sqlite` | Timestamp + suffixe | Supprimé (fusionné avec la variante PG) | Unifier en une seule migration compilable PG + SQLite |

### 2.4 Migration du module

Un module représente un flux stable de migrations, avec un ordre de séquence propre. Deux migrations du même module ne peuvent pas partager la même séquence.

---

## 3. Conséquences

- Le `parseMigrationId` existant fonctionne déjà avec ce format (4 parties séparées par des points).
- Le tri `compareMigrationIds` (numérique sur la séquence) est respecté.
- Le `DependencyResolver` peut ordonner les migrations par dépendances déclarées.
- Le `MigrationRegistry` détecte les collisions d'identité complète.

---

## 4. Critère de sortie (Jalon G0 de Phase 02)

La convention d'ID est figée dans cet ADR. Tous les IDs de migration existants sont soit canoniques, soit ont un plan de migration vers le format canonique.

---
*ADR produit dans le cadre de la Phase 02 de la roadmap migrations TypeScript. Aucun code modifié.*