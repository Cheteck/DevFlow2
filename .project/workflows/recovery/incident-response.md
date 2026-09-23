# Workflow — Incident Response

- **Catégorie :** `recovery`
- **Commande :** `/workflow recovery incident-response`
- **Niveau de risque par défaut :** `critical`
- **Chemin :** `.project/workflows/recovery/incident-response.md`

## Purpose

Traiter un incident (dégradation, bug bloquant, vulnérabilité exploitée)
de façon structurée : contenir d'abord, comprendre ensuite, et empêcher la
récidive.

## Trigger

- Incident signalé (dégradation, donnée corrompue, faille de sécurité, CI bloquant critique).
- Alerte d'audit sécurité (Critical) non couverte par un correctif.

## Inputs

- description de l'incident
- impact estimé (fonctionnel, données, sécurité)
- environnement concerné
- preuves disponibles (logs, messages, stack traces)

## Process

```
Detect
  ↓
Contain
  ↓
Analyze
  ↓
Fix
  ↓
Validate
  ↓
Document
  ↓
Prevent recurrence
```

1. **Detect** — constater, décrire, estimer l'impact, ouvrir un ticket incident.
2. **Contain** — limiter l'impact immédiat (arrêt d'exposition, feature flag, rollback). La sécurité prime.
3. **Analyze** — déterminer la cause racine (scientifique, pas de supposition).
4. **Fix** — appliquer la correction minimale nécessaire (voir `maintenance/fix`).
5. **Validate** — reproduire, vérifier le fix, relancer la suite.
6. **Document** — rapport d'incident dans `.project/reports/incidents/` (chronologie, cause, correction).
7. **Prevent recurrence** — ajouter test de régression, alerte, ou procédure ; backloguer les améliorations.

## Outputs

- `.project/reports/incidents/incident-YYYY-MM-DD-<id>.md` avec chronologie complète
- Correction + test de régression
- Mesures de prévention (tâches, alertes, procédures)
- Validation humaine obligatoire si action Critical/irréversible

## Validation

- La cause racine est confirmée par reproduction (pas de fix non expliqué).
- Le rapport documente la chronologie (détection → confinement → résolution).
- Les mesures de prévention sont tracées (tâche ou procédure).

## Risks

- Traiter le symptôme et pas la cause → analyse racine obligatoire.
- Confinement qui aggrave (rollback incomplet, feature flag désactivé au mauvais endroit) → vérifier l'impact du confinement.
- Perte de preuves → capturer logs/état avant toute modification.