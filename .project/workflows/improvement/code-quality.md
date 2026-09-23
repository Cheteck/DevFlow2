# Workflow — Code Quality

- **Catégorie :** `improvement`
- **Commande :** `/workflow improvement code-quality`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/improvement/code-quality.md`

## Purpose

Amélioration continue de la qualité du code (lisibilité, simplicité,
maintenabilité) par petites interventions ciblées.

## Trigger

- Opportunité identifiée pendant une session (without mission unrelated to current task → backlog).
- Demande dédiée ou planifiée.
- Réduction de complexité locale.

## Inputs

- zone cible
- objectif de qualité (simplicité, clarté, cohérence)
- style et conventions existantes

## Process

```
Detect
  ↓
Evaluate
  ↓
Score
  ↓
Implement
  ↓
Validate
  ↓
Document
```

1. **Detect** — identifier l'intervention (simplification, renommage, extraction, réduction de duplication).
2. **Evaluate** — impact sur le comportement ; vérifier que c'est un changement purement structurel.
3. **Score** — Decision Score pour prioriser si plusieurs options.
4. **Implement** — petit commit atomique (`refactor` ou `improvement`).
5. **Validate** — tests + lint + type check.
6. **Document** — changelog, connaissance si pattern réutilisable.

## Outputs

- Commits atomiques d'amélioration
- Code plus lisible/maintenable, tests verts
- Lignes de changelog

## Validation

- La suite passe ; le diff est structurel.
- Le style respecte les conventions existantes (pas de nouvelle convention sans justification).

## Risks

- Refactoring opportuniste hors périmètre de la mission → backlog, pas dans la foulée.
- Changement de conventions existantes sans justification → Architecture Drift Prevention.
- Amélioration non mesurable → rester sur des gains évidents et vérifiables (Evidence Based Engineering).