# Workflow : Correction de bug (fix)

## Purpose

Résoudre un problème connu de manière méthodique, en garantissant la cause racine
plutôt qu'un correctif superficiel.

## Trigger

- `/workflow fix`
- Bug signalé (issue, test rouge, rapport utilisateur)
- Échec de validation inattendu

## Inputs

- Description du bug
- Composant affecté
- Comportement attendu

## Process

```
Understand
 ↓
Reproduce
 ↓
Find root cause
 ↓
Fix
 ↓
Test
 ↓
Document
```

1. **Understand** : reformuler le bug et le contexte.
2. **Reproduce** : écrire un test qui reproduit le bug (ou reproduire manuellement).
3. **Root cause** : remonter à la cause, pas au symptôme.
4. **Fix** : appliquer la correction minimale suffisante.
5. **Test** : le test de non-régression passe ; la suite complète passe.
6. **Document** : commit conventionnel, entrée dans `.project/working/` → `completed/`.

## Outputs

- Commit `fix(scope): ...`
- Test de non-régression ajouté
- Tâche déplacée vers `.project/completed/`

## Validation

- Le bug est reproduit puis constaté corrigé.
- `pnpm check` passe intégralement.
- Le test de régression existe pour empêcher le retour du bug.

## Risks

- Correctif superficiel masquant la cause racine.
- Régression dans une zone liée : vérifier les consommateurs du code modifié.�gression).
- La cause racine est documentée (pourquoi le bug existait).

## Risks

- Corriger le symptôme et pas la cause → toujours valider la root cause.
- Fix qui en cache un autre → rester dans le périmètre, backloguer le reste.
- Régression non détectée → exécuter toute la suite, pas seulement le test ciblé.