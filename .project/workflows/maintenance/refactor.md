# Workflow : Refactoring contrôlé

## Purpose

Refactoriser le code pour en améliorer la structure, sans aucun changement de
comportement observable.

## Trigger

- `/workflow refactor`
- Dette identifiée par un audit
- Avant d'étendre une zone dont la structure devient fragile

## Inputs

- Module ciblé
- Comportement attendu à préserver (tests)

## Règles

- Aucun changement comportemental.
- Tests capturant le comportement avant ET après.
- Petits commits atomiques.
- Rollback possible à chaque étape.

## Analyse — renseigner pour chaque étape

```
Before
After
Risk
Validation
```

## Process

1. Capturer le comportement actuel avec des tests (si absence, les écrire d'abord).
2. Analyser `Before` (structure actuelle, responsabilités, couplage).
3. Refactorer par petits commits (une transformation à la fois).
4. Vérifier `After` : tests toujours verts, comportement inchangé.
5. Documenter le risque et la validation de chaque étape.

## Outputs

- Commits `refactor(scope): ...` atomiques
- Tests inchangés en sémantique (toujours verts)

## Validation

- Les mêmes tests passent avant et après pour le même comportement.
- `pnpm check` passe.
- Rollback assuré par un point Git avant le lancement.

## Risks

- Changement comportemental accidentel — d'où tests + petits commits.
- Refactoring dépassant le périmètre — rester sur la zone ciblée.efactor`)
- Tests inchangés et verts (comportement identique)
- Éventuel rapport ou note de connaissance

## Validation

- La suite de tests passe avant et après, sans modification des tests de comportement.
- Le diff ne contient **que** des changements structurels (pas de logique modifiée).
- Rollback possible commit par commit.

## Risks

- Changement de comportement furtif → diff minutieux, tests comme filet.
- Refactoring massif → découper, ne pas mélanger refactor + feature + doc (Commit Size Guidelines).
- Tests insuffisants avant refactor → refuser de commencer sans filet de tests (comportements critiques couverts).