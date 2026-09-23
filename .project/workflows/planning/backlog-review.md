# Workflow — Backlog Review

- **Catégorie :** `planning`
- **Commande :** `/workflow planning backlog-review`
- **Niveau de risque par défaut :** `medium`
- **Chemin :** `.project/workflows/planning/backlog-review.md`

## Purpose

Réévaluer les priorités du backlog, retirer l'obsolète et recommander la
prochaine action de valeur maximale.

## Trigger

- Au démarrage d'une session (choix de l'objectif).
- Après un milestone, une release, ou un audit.
- Quand le backlog devient trop fourni ou ambigu.

## Inputs

- backlog courant (`.project/backlog/`)
- roadmap et état projet (`project_state.md`, `roadmap.md`)
- résultats d'audits récents et dashboard

## Process

```
Read backlog
  ↓
Score items
  ↓
Remove obsolete
  ↓
Update priorities
  ↓
Recommend next work
```

1. **Read** — lire le backlog et les tâches en cours.
2. **Score** — réappliquer le Decision Score (AGENTS.md, Phase 4) à chaque item.
3. **Remove obsolete** — items devenus sans valeur (avérée, documentée) ; les archiver, pas supprimer l'historique.
4. **Update priorities** — reclasser selon valeur/coût et dépendances.
5. **Recommend** — désigner la prochaine tâche à exécuter (blocage, dépendances, valeur).

## Outputs

- Backlog re-priorisé
- `.project/dashboard.md` mis à jour (prochaine action, statut, métriques)
- Recommandation explicite pour la session suivante

## Validation

- Chaque priorité est justifiée par un score et/ou une dépendance.
- L'obsolète supprimé est archivé (traçabilité), pas effacé.
- La recommandation est actionnable immédiatement par un nouvel ingénieur.

## Risks

- Scores arbitraires → appliquer les critères et poids du protocole, être transparent.
- Recycler indéfiniment le même backlog → xpirer/archiver les items qui ne progressent pas.
- Recommandation sans considération des dépendances → vérifier les blocs avant de proposer.