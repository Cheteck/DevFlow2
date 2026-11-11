# Données : synchronisation et transfert de propriété

## Sommaire
1. CDC ou outbox ?
2. Réconciliation
3. Séquence de transfert de propriété
4. Cas difficiles
5. Modes de défaillance

## 1. CDC ou outbox ?

| Critère | CDC (lecture du log : Debezium, logical replication) | Outbox transactionnelle |
|---|---|---|
| Modification du code legacy | Aucune | Oui (écrire l'événement dans la même transaction) |
| Couplage au schéma interne | Fort (les événements reflètent les tables) | Faible (événements métier explicites) |
| Garantie d'atomicité | Via le log de la base | Via la transaction locale |
| Quand privilégier | Legacy intouchable, premier remplissage, tranches de lecture | Quand on peut toucher le legacy et qu'on veut des contrats d'événements stables |
| Piège | Fuite du modèle interne vers le consommateur | Relais (poller) à exploiter, ordre et doublons |

Recommandation par défaut : **CDC pour démarrer vite sur du legacy fermé**, avec une couche de traduction (anti-corruption) côté consommateur ; **outbox** pour les flux appelés à durer.

Dans les deux cas : consommateurs **idempotents**, gestion de l'ordre par clé de partition (identifiant d'agrégat), file des messages en échec (DLQ), surveillance du lag, rejouabilité depuis une position.

Ne jamais utiliser la double écriture applicative (écrire dans les deux bases depuis le code) : sans transaction distribuée, un échec partiel crée une divergence silencieuse.

## 2. Réconciliation

Trois niveaux, à automatiser :

1. **Compteurs** : `COUNT(*)` par table et par fenêtre de temps, comparés.
2. **Agrégats** : sommes, min/max de dates, checksum par tranche d'identifiants.
3. **Échantillon profond** : N lignes aléatoires comparées champ par champ après normalisation (arrondis, fuseaux, casse, espaces).

Exemple de checksum par tranche (PostgreSQL) :

```sql
SELECT id / 10000 AS bucket,
       count(*) AS n,
       md5(string_agg(md5(row(id, updated_at, price, status)::text), '' ORDER BY id)) AS h
FROM products GROUP BY 1 ORDER BY 1;
```

Exécuter des deux côtés, comparer les buckets, puis descendre dans les buckets divergents. Les divergences doivent être **classées** : retard de sync (transitoire), différence de format (acceptable, documentée), vraie corruption (bloquant).

## 3. Séquence de transfert de propriété

Le transfert est une **porte à sens unique** tant que la sync inverse n'est pas validée.

1. Pré-conditions : lag de sync stable sous le seuil, zéro divergence critique sur N jours, sauvegarde et point de restauration testés, sync inverse prête (et testée en pré-production).
2. Annoncer la fenêtre, définir le responsable de la décision et le chronomètre d'abandon.
3. **Geler les écritures** sur le périmètre (mode lecture seule côté legacy, ou fencing par jeton/époque si le gel est impossible).
4. **Drainer** : attendre que le lag tombe à zéro, vérifier le dernier identifiant de position traité.
5. Exécuter la réconciliation complète. Si écart critique : annuler, dégeler, retour à l'étape 1.
6. **Basculer les écritures** vers le nouveau service (gateway ou flag).
7. **Fermer l'ancien chemin d'écriture** : permissions de base retirées ou trigger de rejet, pour empêcher toute écriture accidentelle.
8. Activer la **sync inverse** service → monolithe, pour que les modules legacy qui lisent encore ces données restent corrects.
9. Surveiller intensivement pendant la période convenue ; décision explicite rollback vs fix-forward.
10. Après stabilisation : couper la sync inverse, supprimer les anciennes tables.

Le fencing évite qu'un ancien processus lent écrive après la bascule : chaque écriture porte une époque, et la source de vérité rejette les époques périmées.

## 4. Cas difficiles

**Jointures cross-domaines.** Options, par ordre de préférence : (a) projection locale en lecture seule des champs nécessaires, alimentée par événements ; (b) appel d'API avec cache ; (c) si la jointure est omniprésente, reconnaître que la frontière est mal placée et redéfinir la tranche.

**Transactions multi-domaines.** Une transaction ACID qui couvre deux domaines ne survit pas à la séparation. Options : saga orchestrée ou chorégraphiée avec compensation, ou fusion des deux domaines dans le même service. Si l'invariant métier exige l'atomicité stricte, c'est un veto de découpage.

**Identifiants.** Séquences auto-incrémentées = collisions et fuite d'ordre. Préférer UUIDv7 ou ULID pour le nouveau service ; conserver une table de correspondance legacy ↔ nouvel ID pendant la transition.

**Reporting et BI.** Prévoir un flux vers l'entrepôt depuis la nouvelle source ; ne pas laisser les rapports lire une base en voie d'abandon.

**Suppression et conformité.** Un effacement doit se propager à la projection, aux caches, aux sauvegardes selon la politique. Documenter qui est responsable de la suppression pendant la sync.

**Types et fuseaux.** Décimaux monétaires, précision des timestamps, collation, normalisation Unicode : sources classiques de faux écarts. Les normaliser avant comparaison et décider du format canonique.

**Données de très gros volume.** Backfill par lots, fenêtres hors pic, reprise après interruption, plafonnement de la charge sur la base source.

## 5. Modes de défaillance à anticiper

| Défaillance | Détection | Parade |
|---|---|---|
| Lag qui s'accumule | métrique de lag + alerte | scaling du consommateur, backpressure, plan de reprise |
| Événement perdu | réconciliation périodique | rejeu depuis la position, backfill ciblé |
| Événement en double | clé d'idempotence | upsert, déduplication |
| Ordre inversé | numéro de version par agrégat | ignorer les versions plus anciennes |
| Changement de schéma legacy | tests de contrat de schéma | versionner les événements, tolérance aux champs inconnus |
| Divergence silencieuse | réconciliation en continu | alerte et blocage du palier |
