# Découverte et cartographie

## Sommaire
1. Artefacts à demander
2. Trouver les coutures
3. Cartographie des données
4. Détecter les consommateurs cachés
5. Lecture des signaux

## 1. Artefacts à demander (du plus au moins rentable)

| Artefact | Ce qu'il révèle |
|---|---|
| Dump du schéma (DDL) + FK, triggers, vues, procédures | Couplages de données réels |
| Liste des routes + volumétrie par route (logs d'accès, APM) | Candidats, trafic, criticité |
| `git log --since=12.months --name-only` agrégé par dossier | Zones de churn, couplage de changement |
| Graphe d'imports / dépendances (madge, dependency-cruiser, jdeps, go mod graph) | Dépendances de code |
| Requêtes lentes et top requêtes (pg_stat_statements, slow log) | Hot paths de données |
| Liste des jobs, crons, webhooks, exports | Consommateurs cachés |
| Incidents des 6 derniers mois | Zones de douleur réelles |

Si l'utilisateur ne peut pas les fournir, donne-lui la commande exacte adaptée à sa stack.

## 2. Trouver les coutures

Une couture est un point où le comportement peut être modifié sans éditer le code environnant. Par ordre de préférence :

1. **Bord HTTP** : un préfixe de route stable (`/api/catalog/*`) → interception gateway.
2. **Interface existante** : un service interne déjà abstrait → branch by abstraction.
3. **File ou événement existant** : un bus, des jobs asynchrones → consommateur parallèle.
4. **Frontière de module** : un package avec peu d'imports entrants → extraction après inversion de dépendances.
5. **Aucune couture** : créer d'abord une façade (interface) à l'intérieur du monolithe, livrer, puis extraire. C'est une tranche à part entière.

**Couplage de changement** : deux fichiers qui changent toujours ensemble appartiennent probablement au même domaine, même s'ils sont éloignés dans l'arborescence. Un candidat dont les fichiers changent avec 10 autres domaines est mal borné.

## 3. Cartographie des données

Pour chaque table du candidat, remplir :

| Table | Écrite par | Lue par | Jointures cross-domaines | Volume | Sensibilité |
|---|---|---|---|---|---|

Signaux d'alerte :
- table écrite par plus d'un domaine : il n'y a pas de propriétaire, en désigner un avant d'extraire ;
- jointure entre le candidat et une table d'un autre domaine dans plus de 20 % des requêtes ;
- transaction qui touche le candidat et un autre domaine ;
- colonnes "fourre-tout" (JSON libre, statut multi-usage) ;
- triggers ou procédures stockées portant de la logique métier.

## 4. Détecter les consommateurs cachés

Cherche explicitement : rapports BI et vues matérialisées, exports CSV planifiés, scripts d'administration, ETL vers un entrepôt, outils internes qui se connectent directement à la base, intégrations tierces par webhook, anciens clients mobiles qui appellent des routes dépréciées. Méthode : activer temporairement le log des requêtes par compte de base de données ou par `application_name`, pendant au moins un cycle métier complet (mois si clôture comptable).

## 5. Lecture des signaux

| Signal | Interprétation |
|---|---|
| Domaine très modifié, peu couplé | Excellent candidat : le bénéfice est là, le risque est bas |
| Domaine très couplé, peu modifié | À laisser en place |
| Domaine très couplé et très modifié | Douleur forte, tranche complexe : préparer par façade interne |
| Latence dominée par une seule route | Candidat de scalabilité ciblée, peut-être un simple cache suffit |
