# Workflow — Memory Cleanup

- **Catégorie :** `project`
- **Commande :** `/workflow project memory-cleanup`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/project/memory-cleanup.md`

## Purpose

Maintenir la mémoire projet compacte, fiable et navigable. Réduire le volume
de contexte à charger, conformément au principe Context Management.

## Trigger

- Quand `.project/` devient volumineux ou dupliqué.
- Périodiquement (par exemple à chaque milestone).
- Avant de commencer une phase importante (mise au propre).

## Inputs

- contenu de `.project/` (reports, knowledge, backlog, working, completed, decisions)
- index des connaissances (`knowledge/`)
- redondances connues

## Process

1. **Audit** — lister les fichiers et leur valeur (pertinent / obsolète / dupliqué).
2. **Fusionner** — regrouper les connaissances éparses ; consolider les rapports.
3. **Archiver** — déplacer les anciens rapports/taches vers une zone d'archive (ne jamais détruire sans accord).
4. **Supprimer les doublons** — garder une source de vérité par sujet, faire pointer les autres.
5. **Mettre à jour l'index** — `knowledge/` et `README` reflètent l'état réel.
6. **Documenter** — changelog, toute suppression importante tracée.

## Outputs

- Mémoire projet compactée et consolidée
- Index (`knowledge/`) à jour, sans doublon
- Contexte minimal à charger en début de session

## Validation

- Aucune connaissance unique perdue (les doublons fusionnés sont vérifiés).
- Chaque dossier/fichier conservé a une raison d'exister et n'entre pas en contradiction avec une autre source.
- La consultation par un nouvel ingénieur est possible sans charger l'intégralité.

## Risks

- Supprimer une connaissance utile → archiver plutôt que détruire (Règles absolues AGENTS.md).
- Fusion qui perd des détails → vérifier le contenu avant de consolider.
- Mémoire trop élaguée pour être utile → garder ce qui documente des décisions/comportements persistants.