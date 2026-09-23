# Workflow — Repository Health Audit

- **Catégorie :** `audit`
- **Commande :** `/workflow audit repository-health`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/audit/repository-health.md`

## Purpose

Produire un diagnostic global et reproductible de la santé du repository,
structuré pour prioriser les prochaines actions.

## Trigger

- Au démarrage d'une session si l'état est incertain.
- Périodiquement (health check).
- Avant une release, après un refactoring majeur, ou à la demande.

## Inputs

- état Git (`git status`, log, branches)
- structure du repository
- docs de référence (`project_state.md`, `roadmap.md`, `dashboard.md`)

## Process

1. **Architecture** — dépendances, direction `apps → sdk → core → types`, couplage, duplication, cycles.
2. **Code quality** — complexité, fonctions surdimensionnées, incohérences, absence de validation.
3. **Tests** — couverture des zones critiques, régressions possibles.
4. **Documentation** — alignement code/docs, docs obsolètes, décisions manquantes.
5. **Sécurité** — secrets, dépendances vulnérables, permissions excessives, entrées non validées.
6. **Dépendances** — obsolescence, cohérence des versions.
7. **CI/CD** — pipeline actif et vert, reproductibilité du build.
8. **Dette technique** — TODO/FIXME, code mort, hacks.

## Outputs

- `.project/reports/repository-health-report.md` :

```markdown
# Repository Health Report

## Health Score
- Architecture : X/10
- Testing : X/10
- Documentation : X/10
- Security : X/10
- Maintainability : X/10

## Critical Issues
- ...

## Recommendations
- ...

## Backlog Candidates
- ...
```

- Tâches backlog créées pour chaque dérive.

## Validation

- Chaque score est justifié par une preuve (fichier, commande, log).
- Aucun score inventé : un point non analysé = 0 + mention « non vérifié ».
- Les issues critiques sont traçables vers une tâche backlog ou un risque.

## Risks

- Audit trop superficiel → analyser avec des preuves, ne pas deviner.
- Score sans base de comparaison → garder le rapport précédent pour mesurer la tendance.
- Scope creep → un audit produit des recommandations, il n'exécute pas les fixes.