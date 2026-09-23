# Workflow — Documentation Sync

- **Catégorie :** `documentation`
- **Commande :** `/workflow documentation sync`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/documentation/sync.md`

## Purpose

Synchroniser la documentation avec la réalité du code, pour que toute
documentation soit fiable et exploitable.

## Trigger

- Après une modification de code notable (refactoring, API, architecture).
- Périodiquement, lors du health check.
- Quand une doc obsolète ou contradictoire est suspectée.

## Inputs

- code source et API publiques
- documentation existante (README, `.project/architecture/`, `project_state.md`, `roadmap.md`, `knowledge/`)
- historique Git (ce qui a changé récemment)

## Process

1. **Compare** — confronter chaque doc au code correspondant :

```
Code
 ↓
Architecture docs
 ↓
README
 ↓
Knowledge base
```

2. **Detect** — docs obsolètes, fichiers manquants, contradictions entre sources.
3. **Prioriser** — corrections par impact (doc publique/onboarding d'abord).
4. **Corriger** — mettre à jour les docs concernées (une source de vérité par sujet).
5. **Verify** — relire la doc corrigée contre le code (claims vérifiés).
6. **Document** — lignes de changelog, connaissance.

## Outputs

- Documentation alignée sur le code
- Liste des points d'écart résolus ou backlogués
- Lignes de changelog

## Validation

- Chaque affirmation de doc vérifiée contre le code.
- Aucune contradiction entre deux sources pour le même sujet.
- Les schémas API/architecture reflètent l'implémentation.

## Risks

- Dupliquer une vérité dans plusieurs fichiers → une seule source, les autres pointent dessus.
- Sur-documenter (docs qui vieillissent mal) → documenter ce qui est stable et utile.
- Corriger la doc « pour la forme » sans vérifier → toujours vérifier contre le code.