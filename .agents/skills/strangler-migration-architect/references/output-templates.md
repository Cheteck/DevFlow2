# Modèles de sortie

## Sommaire
1. Plan complet (14 sections)
2. Réponse ciblée
3. ADR
4. Registre de migration
5. Runbook de bascule
6. Gate review

## 1. Plan complet

À utiliser pour une demande de plan, d'audit ou de design de tranche. Supprimer les sections sans objet, ne pas les remplir par principe. Commencer par la décision, pas par l'introduction.

1. **Résumé exécutif** : verdict (GO / GO conditionnel / NO-GO), première tranche, durée estimée, 3 risques majeurs.
2. **Hypothèses et questions bloquantes** : H1…Hn avec niveau de confiance ; au plus 5 questions.
3. **Cartographie** : modules, dépendances, couplages de données, consommateurs cachés.
4. **Candidats scorés** : tableau, vetos, sensibilité.
5. **Tranche recommandée** : pourquoi elle, ce qu'elle enseigne, ce qui la ferait changer.
6. **Contrat du service** : endpoints, erreurs, idempotence, timeouts, versionnage.
7. **Données et synchronisation** : base, snapshot, CDC/outbox, lag cible, réconciliation, date de transfert.
8. **Routage progressif** : shadow, cohortes, paliers, soak, seuils de rollback automatique.
9. **Dépendances et adapters** : consommateurs, résilience, mode dégradé.
10. **Tests et observabilité** : contrats, caractérisation, charge, métriques, alertes.
11. **Critères Go/No-Go** : par palier, avec valeurs cibles.
12. **Rollback** : tableau par étape, point de non-retour, fix-forward.
13. **Critères de retrait** : preuves de non-usage, nettoyage.
14. **Risques et trade-offs** : probabilité, impact, mitigation, signal d'alerte précoce.

Terminer par **"Prochaines actions"** : 3 à 5 actions concrètes, ordonnées, avec un responsable type (équipe, rôle).

## 2. Réponse ciblée

Pour une question ponctuelle : recommandation en une phrase, justification courte, un trade-off, une condition de révision, et si utile un extrait concret (config, SQL, schéma). Pas de structure en 14 sections.

## 3. ADR (Architecture Decision Record)

```markdown
# ADR-NNN : <titre de la décision>
Statut : proposé | accepté | remplacé
Date : AAAA-MM-JJ
## Contexte
<contraintes, forces en présence, faits>
## Décision
<ce qu'on fait, en une phrase claire>
## Alternatives écartées
- <option> : pourquoi pas
## Conséquences
Positives : ...
Négatives / dette acceptée : ...
## Conditions de révision
<ce qui ferait rouvrir la décision>
```

## 4. Registre de migration

| # | Tranche | Statut | Palier trafic | Propriétaire données | Lag p95 | Divergence | Rollback testé | Retrait prévu |
|---|---|---|---|---|---|---|---|---|

Statuts : cartographiée → conçue → sync active → shadow → canary → propriété transférée → stabilisée → ancien code retiré.

## 5. Runbook de bascule

```markdown
# Bascule : <tranche> — <date/heure> — responsable décision : <rôle>
## T-7 j  : réconciliation verte N jours, sauvegarde testée, sync inverse validée
## T-1 j  : annonce, astreinte confirmée, tableau de bord ouvert, flags prêts
## T-0    : gel des écritures [h:mm] → drainage lag=0 → réconciliation → bascule → fermeture ancien chemin → sync inverse
## Abandon : si écart critique ou dépassement de <X> min → dégel, retour gateway, post-mortem
## T+1 h / T+24 h / T+7 j : points de contrôle (erreurs, p99, lag, divergence)
## Décision rollback vs fix-forward : seuil <...>, décideur <...>
```

## 6. Gate review

Présenter ainsi :

| Critère | Seuil | Mesuré | Verdict |
|---|---|---|---|
| Erreurs 5xx | ≤ legacy | 0,12 % vs 0,10 % | OK avec réserve |
| p99 | ≤ 400 ms | 380 ms | OK |
| Divergence données | 0 critique | 3 mineures classées | OK |
| Lag sync | < 5 s | pic 22 s | KO |
| Rollback testé | oui | non | KO |

**Décision : NO-GO.** Action corrective la plus rentable : ... Prochain point de contrôle : ...
