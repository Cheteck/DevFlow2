# Workflow — ADR Create

- **Catégorie :** `architecture`
- **Commande :** `/workflow architecture adr-create`
- **Niveau de risque par défaut :** `medium`
- **Chemin :** `.project/workflows/architecture/adr-create.md`

## Purpose

Créer une Architecture Decision Record (ADR) : capturer **pourquoi** une
décision technique a été prise, avec les options écartées et les conséquences.

## Trigger

- Décision d'architecture significative (pattern, frontière, dépendance majeure).
- Nouvelle approche sans précédent dans le projet (Architecture Drift Prevention).
- Demande explicite de documenter une décision.

## Inputs

- contexte de la décision (problème résolu)
- options considérées
- décision retenue
- personnes/éléments concernés

## Process

1. **Numéro** — choisir le prochain identifiant libre (`ADR-0042-...`).
2. **Rédiger** le format canonique :

```markdown
# ADR-XXXX : <Titre>

## Status
Accepted | Proposed | Superseded

## Context
Le problème et les contraintes du moment.

## Problem
Ce que la décision résout.

## Options
Les alternatives considérées (avec avantages/inconvénients).

## Decision
La décision retenue, avec son raisonnement.

## Trade-offs
Ce qui est perdu/accepté.

## Consequences
Impacts positifs et négatifs, suivis.
```

3. **Ranger** dans `.project/decisions/ADR-XXXX-title.md`.
4. **Lier** — référencer l'ADR dans le commit de l'implémentation (Git History as Knowledge).
5. **Diffuser** — mention dans le changelog et les docs concernées.

## Outputs

- Fichier ADR dans `.project/decisions/`
- Référence dans le commit associé
- Connaissance conservée pour les futurs ingénieurs

## Validation

- Le format canonique est respecté.
- La décision est compréhensible sans contexte oral.
- Les options écartées sont documentées (pourquoi pas elles).

## Risks

- ADR creux (décision évidente sans réel choix) → ne documenter que les décisions qui comptent (Proportional Process).
- ADR qui ne reflète pas l'implémentation → relire l'ADR à la fin de l'implémentation, marquer Superseded si dépassé.
- Pas de suivi des conséquences → mettre à jour l'ADR quand les faits évoluent.