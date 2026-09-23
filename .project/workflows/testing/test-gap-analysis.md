# Workflow — Test Gap Analysis

- **Catégorie :** `testing`
- **Commande :** `/workflow testing test-gap-analysis`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/testing/test-gap-analysis.md`

## Purpose

Identifier les zones insuffisamment testées et transformer les lacunes en
tâches de couverture priorisées.

## Trigger

- Après une phase ou une feature (contrôle de couverture).
- Avant un refactoring sur une zone sensible.
- Détection de régressions répétées dans un module.

## Inputs

- liste des modules/comportements critiques
- suite de tests existante
- objectifs de couverture (par priorité, pas nécessairement un % global)

## Process

1. **Modules critiques** — identifier les zones à fort risque (sécurité, permissions, sync, kernel).
2. **Inventaire des tests** — pour chaque module : quels comportements sont couverts.
3. **Gap mapping** — lister les comportements non testés, chemins dangereux, cas limites.
4. **Risques de régression** — où une future modification peut casser sans être détectée.
5. **Priorisation** — classer les gaps par impact × probabilité (Decision Score).
6. **Backlog** — créer une tâche par gap (test à écrire, fixture à ajouter, refactor pour testabilité).

## Outputs

- Liste des gaps avec localisation et justification
- Tâches backlog `test:` priorisées
- Éventuellement `.project/reports/test-gap-analysis.md`

## Validation

- Chaque gap est relié à un comportement réel du code.
- L'ajout des tests ciblés fait passer la couverture des zones critiques.
- Une régression future dans une zone analysée serait capturée.

## Risks

- Poursuivre un % de couverture global au détriment des zones critiques → prioriser par risque.
- Tests « pour le chiffre » sans valeur (mock tautologique) → privilégier les assertions de comportement.
- Ignorer les chemins d'erreur → couvrir succès ET échecs.