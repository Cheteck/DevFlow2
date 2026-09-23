# Workflow — Technical Debt Audit

- **Catégorie :** `audit`
- **Commande :** `/workflow audit technical-debt`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/audit/technical-debt.md`

## Purpose

Identifier la dette technique de façon systématique et la transformer en
tâches backlog priorisées, pour réduire progressivement la complexité.

## Trigger

- Health check périodique.
- Avant un refactoring (pour mesurer l'existant).
- À la demande.

## Inputs

- code source
- dépendances déclarées
- historique Git (hacks, commits précipités)
- annotations (TODO/FIXME/HACK)

## Process

1. **TODO/FIXME/HACK** — inventaire et tri (permanents vs temporaires).
2. **Duplication** — blocs dupliqués, patterns réinventés.
3. **Code mort** — exports inutilisés, branches inaccessibles, fichiers orphelins.
4. **Complexité** — fonctions trop grandes, nid de conditions, responsabilités multiples.
5. **Anciennes dépendances** — versions obsolètes, dépendances inutilisées.
6. **Hacks temporaires** — workarounds sans issue de suivi.
7. **Priorisation** — chaque item reçoit un Decision Score (AGENTS.md, Phase 4).

## Outputs

- Tâches backlog dans `.project/backlog/` (typiquement `medium/`), chaque entrée contenant :
  - localisation (fichier:ligne)
  - type de dette
  - coût estimé de remboursement
  - bénéfice attendu
  - Decision Score
- Éventuellement `.project/reports/technical-debt.md` si volume important.

## Validation

- Chaque item est relié à une preuve dans le code.
- Les items sont actionnables (une tâche = une remédiation ciblée).
- Le rapport permet de mesurer une réduction de dette dans le temps.

## Risks

- Vouloir tout rembourser d'un coup → prioriser par valeur/coût, exécuter par incréments.
- Supprimer du code « mort » qui ne l'est pas → vérifier les usages avant suppression.
- Dette non priorisée qui s'accumule → classer et mesurer systématiquement.