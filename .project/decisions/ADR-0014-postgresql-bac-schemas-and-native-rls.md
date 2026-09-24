# ADR-0014: PostgreSQL Dedicated BAC Schemas & Native Row-Level Security (RLS)

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Software Architecture Council, Engineering Steward
- **Context:** MosaiX multi-tenant enterprise data partitioning and isolation

---

## 1. Contexte et Problématique
Historiquement, les Bounded Application Components (BACs) partageaient le schéma PostgreSQL `public` en préfixant leurs tables (par exemple `citadelle_users`, `commerce_orders`, `spaces_spaces`).
Cette approche présentait plusieurs limites :
1. **Pollution de l'espace de nommage** : plus de 50 tables plates dans le schéma `public`.
2. **Cloisonnement de sécurité imparfait** : impossibilité d'attribuer des privilèges `GRANT USAGE ON SCHEMA` distincts par composant ou par service.
3. **Multi-tenancy applicatif vs natif** : le filtrage par `tenant_id` dépendait exclusivement de clauses WHERE SQL sans filet de sécurité au niveau du moteur de stockage.

## 2. Décision Prise
1. **Schémas PostgreSQL canoniques par BAC** :
   Chaque BAC dispose désormais de son propre schéma PostgreSQL dédié :
   - `citadelle`
   - `commerce`
   - `portfolio`
   - `solara`
   - `booking`
   - `solidarity`
   - `beam`
   - `spaces`
   - `imperia`
   - `subscription`
2. **Transition zero-downtime** :
   Migration des tables existantes via `ALTER TABLE public.<bac>_<table_suffix> SET SCHEMA <bac>` puis renommage pour éliminer la redondance (`ALTER TABLE <bac>.<bac>_<table_suffix> RENAME TO <table_suffix>`).
3. **Multi-tenancy au niveau schéma & search_path** :
   Utilisation de `SET search_path TO <bac>, public` ou `SET search_path TO tenant_<tenant_id>, <bac>, public` pour l'isolation multi-tenant stricte.
4. **Row Level Security (RLS) natif** :
   - Activation par défaut : `ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY;`
   - Définition des politiques d'isolation par tenant :
     `CREATE POLICY tenant_isolation ON <table> FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));`
   - Positionnement de session : `SET LOCAL app.current_tenant_id = '<tenant_id>';` exécuté lors de chaque transaction.

## 3. Conséquences
- **Avantages** :
  - Isolation cryptographique et logique garantie par le moteur PostgreSQL.
  - Découplage clair des permissions RBAC et rôles d'accès base de données.
  - Aucune fuite de données inter-tenants même en cas de clause WHERE oiseuse dans le code applicatif.
- **Inconvénients / Vigilance** :
  - Nécessite d'initialiser `app.current_tenant_id` sur les connexions poolées au début de chaque transaction.
