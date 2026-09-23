# Workflow — Session End

- **Catégorie :** `agent`
- **Commande :** `/workflow agent session-end`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/agent/session-end.md`

## Purpose

Clôturer une session proprement : documenter les résultats, mettre à jour l'état,
archiver les connaissances et recommander la suite.

## Trigger

À la fin de chaque session significative (obligatoire si des travaux ont été réalisés).

## Inputs

- travaux réalisés pendant la session
- validations effectuées
- état Git après travaux
- éventuels risques détectés

## Process

1. **Update working** — marquer les tâches terminées, déplacer vers `completed/` si applicable.
2. **Update dashboard** — statut, métriques, points de vigilance, prochaine action.
3. **Update state** — `project_state.md` reflète la réalité.
4. **Update changelog** — entrée datée et horodatée par thème.
5. **Update knowledge** — conserver les leçons réutilisables (`.project/knowledge/`).
6. **Update risks** — inscrire les risques nouveaux dans `.project/risks/`.
7. **Rapport de session** — créer `.project/reports/session-YYYY-MM-DD.md` avec Git State.
8. **Recommend next** — proposer la prochaine action (backlog priorisé).

## Outputs

- Rapport de session (`reports/session-YYYY-MM-DD.md`)
- Dashboard, état, changelog, risks, knowledge à jour
- Recommandation pour la session suivante

## Validation

- L'auto-évaluation finale d'AGENTS.md répond « oui » à au moins une dimension (idéalement toutes).
- Aucune connaissance utile perdue ; aucun résultat inventé.
- `git status` cohérent avec le rapport (commits listés, rollback documenté).

## Risks

- Oublier une trace (travail non documenté = perdu).
- Surgonfler le changelog → rester concis, un commit par intention.
- Omettre un risque critique → le risque non documenté ne peut pas être géré.