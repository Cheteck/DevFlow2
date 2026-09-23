# Workflow : Démarrage de session

## Purpose

Initialiser chaque session correctement : charger la mémoire minimale, vérifier l'état,
évaluer la santé, sélectionner un objectif et démarrer.

## Trigger

- Automatique, au démarrage de chaque session (Phase 1 — Observe du protocole)

## Inputs

- État du repository (structure, Git, documentation, mémoire projet)

## Process

```
Load memory
 ↓
Check working
 ↓
Health scan
 ↓
Select objective
 ↓
Start work
```

1. **Git** : `git status`, branche, `git log`, remote — ne jamais modifier un état inconnu.
2. **Load memory** : lire `.project/dashboard.md`, `.project/project_state.md`, `.project/working/`.
3. **Check working** : état des tâches en cours, questions ouvertes, blocages.
4. **Health scan** : health check rapide (pas l'audit complet).
5. **Select objective** : tâche active prioritaire ou amélioration à fort score (Decision Score).
6. **Start work** : lancer le travail sur l'objectif retenu.

## Outputs

- Objectif de session défini et communiqué
- État Git, working et mémoire chargés (contexte minimal)

## Validation

- L'objectif est aligné avec l'état du projet et la roadmap.
- Aucune modification effectuée avant l'observation complète.
- Le contexte chargé reste minimal (pas toute la mémoire).

## Risks

- Contexte surchargé : lire uniquement ce qui est nécessaire à la tâche.
- Tâche obsolète en `working/` : la vérifier avant de la reprendre.