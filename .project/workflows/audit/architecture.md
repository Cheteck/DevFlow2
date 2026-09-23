# Workflow — Architecture Audit

- **Catégorie :** `audit`
- **Commande :** `/workflow audit architecture`
- **Niveau de risque par défaut :** `medium`
- **Chemin :** `.project/workflows/audit/architecture.md`

## Purpose

Évaluer la cohérence architecturale du système et détecter les dérives
(duplication d'architecture, responsabilités floues, couplage, cycles).

## Trigger

- Avant/après une réorganisation de modules.
- À la demande, ou lors d'un health check qui pointe un problème d'architecture.
- Avant de créer un ADR.

## Inputs

- architecture documentée (`.project/architecture/`, `roadmap.md`)
- code source et structure des packages
- contraintes de dépendances (eslint-plugin-boundaries)
- fichiers de décisions existants (`decisions/`)

## Process

1. **Responsabilités** — chaque module a-t-il une responsabilité unique et claire ?
2. **Dépendances** — la direction est-elle respectée et vérifiée automatiquement ?
3. **Cycles** — cyclisme de dépendances (interne et inter-packages).
4. **Frontières de modules** — fuites entre bounded contexts, accès directs illégaux.
5. **Patterns utilisés** — cohérence des patterns, pas de « nouveau pattern sans justification ».
6. **Duplication architecturale** — de l'architecture dupliquée (Architecture Drift Prevention).

## Outputs

- `.project/reports/architecture-audit.md`
- Actions possibles en sortie :
  - création d'un ADR (via `architecture/adr-create`)
  - tâches backlog (refactoring, suppression de duplication)
  - validation humaine si impact High/Critical

## Validation

- Les findings sont reliés à des fichiers/lignes réelles.
- Chaque dérive est classée par gravité et reliée à une action.
- Le rapport confirme que les responsabilités restent séparées (Architecture Fitness).

## Risks

- Proposer un refactoring massif → à découper en petites étapes validées (Minimal Sufficient Change).
- Casser une interface sans migration → respecter les règles de compatibilité.
- Analyse sur intuition → s'appuyer sur preuves et analyse statique.