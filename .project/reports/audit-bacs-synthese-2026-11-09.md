# Rapport d'audit technique — BACs MosaiX (Synthèse consolidée)

**Date :** 9 novembre 2026
**Méthode :** Exploration en lecture seule des 11 BACs de `apps/`, un rapport individuel par BAC soumis à validation architecturale (ChatGPT, persona Martin Fowler — conversation `3a9fb240-e7ad-4518-a026-528a850b3684`), puis synthèse comparative.
**Périmètre :** `apps/{citadelle, spaces, portfolio, commerce, solara, solidarity, booking, imperia, subscription, beam, inventory}`. Hors périmètre : `apps/otp` (package infrastructure uniquement — pas de manifest/domain), `apps/_template` (scaffold).
**Règle de fond :** une affirmation n'est retenue ici que si elle est (a) vérifiée par lecture de code / listing de fichiers dans cette session, ou (b) explicitement marquée [non vérifié] quand elle est héritée d'un rapport antérieur.

---

## 1. Inventaire corrigé des 11 BACs

Compte des fichiers de test **vérifié par listing de fichiers** (glob `**/*.test.ts`) le 2026-11-09 :

| # | BAC | Fichiers de test (vérifié) | Migrations | Isolation tenant | Verdict ChatGPT |
|---|-----|---------------------------|------------|------------------|-----------------|
| 1 | **Citadelle** | 6 | MFA secrets (`20261108130000`) + identité | ✅ Démontrée (`identities-pg-isolation.test.ts`) | **RC1 certifié** (41 cas de test) — module gelé |
| 2 | **Spaces** | 4 (dont `space-isolation.test.ts`) | 3 | ⚠️ Non démontrée au niveau *tenant* | Infrastructure présente, maturité à démontrer |
| 3 | **Portfolio** | **10** (dont `tenant-intrusion`, `tenant-intrusion-http`, `portfolio-multi-tenant`) | présentes | ⚠️ À démontrer (tests d'intrusion existants) | Infrastructure présente, maturité à démontrer |
| 4 | **Commerce** | **11** (dont `offers-pg-isolation`) | 3 (`move_to_commerce_schema`, `order_pending_payment`, `harden_commerce`) | ⚠️ À démontrer (test `offers-pg-isolation` présent) | Infrastructure présente, maturité à démontrer |
| 5 | **Solara** | **1** (`solara.test.ts`) | présentes | ⚠️ À démontrer | P2 — à compléter |
| 6 | **Solidarity** | **7** (tests/ : sync-reconcile, operational-rules, merkle-audit, controller, allocation-persistence) | présentes | ⚠️ À démontrer | P2 — à compléter |
| 7 | **Booking** | 1 (`booking.test.ts`) | 2 (`move_to_booking_schema`, `harden_booking`) | ⚠️ À démontrer | P1 — périmètre MFA/paiement à clarifier |
| 8 | **Imperia** | 1 (`imperia.test.ts`) | présentes | ⚠️ À démontrer | **P0 — sécurité du Control Plane, sandboxing non prouvé** |
| 9 | **Subscription** | **2** (`subscription-view`, `coupon-repository`) | 2 (`move_to_subscription_schema`, `harden_subscription`) + provider `subscription.v1.001` (coupons, invoices, metering_buckets) | ⚠️ À démontrer | P1 — table `user_subscriptions` shell-owned (Phase-0) |
| 10 | **Beam** | 3 (`beam`, `beam-completeness`, `beam-view`) | 2 (`create_beam_messaging_tables`, `move_to_beam_schema`) | ❌ Aucune preuve — aucun `tenantId` dans le repository | **P0 — défauts structurels critiques** |
| 11 | **Inventory** | 1 (`inventory-report.test.ts`) | **aucune** | ⚠️ Non applicable (en mémoire) | P2 — squelette non persistant |

**Total : 47 fichiers de test.**

---

## 2. Findings par BAC

### 2.1 Citadelle (identité) — RC1 certifié, gelé
- **Fait vérifié :** 6 fichiers de test dont `identities-pg-isolation.test.ts` (isolation tenant démontrée), `mfa-service.test.ts`, `mfa-integration-real.test.ts`, `citadelle-policy.test.ts`.
- **Fait (mission antérieure, non re-vérifié cette session) :** 41 cas de test, typecheck propre, ADR-0024 `citadelle-dynamic-mfa` écrit, module déclaré gelé.
- **Findings :** aucun open — seul BAC certifié production. Le MFA est l'autorité unique d'authentification forte de la plateforme.
- **Attention :** les changements MFA (6 fichiers modifiés + 5 nouveaux + ADR-0024) sont **encore non commités** sur la branche `audit-technique-mosaix-8397822254578305712`. La certification porte sur un état non versionné.

### 2.2 Spaces (acteurs, membres, rôles)
- **Fait vérifié :** 4 fichiers de test dont `space-isolation.test.ts`.
- **Finding :** le test d'isolation existant couvre l'isolation de *Space* (concept métier), pas l'isolation *tenant* (frontière entre locataires). La nuance est importante : « un test d'isolation existe » ne signifie pas « l'isolation tenant est prouvée ».

### 2.3 Portfolio (PIM / objets vendables)
- **Fait vérifié :** 10 fichiers de test, dont 3 dédiés à la multi-tenance : `tenant-intrusion.test.ts`, `tenant-intrusion-http.test.ts`, `portfolio-multi-tenant.test.ts`. C'est le BAC le mieux couvert sur l'isolation tenant après Citadelle.
- **Correction :** le rapport individuel initial annonçait 7 ou 8 fichiers — le compte exact est **10**.
- **Findings (hérités, non re-vérifiés) :** complexité du schéma, orphelins de données possibles.

### 2.4 Commerce (offres, commandes, ventes)
- **Fait vérifié :** 11 fichiers de test (le plus grand contingent après Portfolio), dont `offers-pg-isolation.test.ts`. Migrations propres : `move_to_commerce_schema`, `order_pending_payment`, `harden_commerce`.
- **Correction importante :** la synthèse initiale affirmait que `move_to_booking_schema` et `harden_booking` apparaissaient **dans les deux** BACs Commerce et Booking, avec un « ownership à clarifier ». **C'est faux.** Les listings de dossiers montrent que chaque BAC possède uniquement ses propres migrations (Commerce : `move_to_commerce_schema`/`harden_commerce` ; Booking : `move_to_booking_schema`/`harden_booking`). **Aucune migration partagée ou dupliquée n'existe.** Ce risque transversal est retiré.
- **Findings (hérités) :** confusion Offres/TOTP à clarifier.

### 2.5 Solara (fil d'actualité social)
- **Correction :** le rapport individuel affirmait « pas de tests dédiés ». **C'est faux :** `solara.test.ts` existe (1 fichier, couverture mince).
- **Findings :** isolation tenant à démontrer, couverture de tests insuffisante pour la critique.

### 2.6 Solidarity
- **Fait vérifié :** 7 fichiers de test (structure `tests/` à part, pas `src/` — incohérence de layout mineure à normaliser) : sync-reconcile, operational-rules, merkle-audit, controller, allocation-persistence.
- **Findings :** isolation tenant à démontrer.

### 2.7 Booking
- **Fait vérifié :** 1 fichier de test (`booking.test.ts`), 2 migrations propres au BAC.
- **Findings (hérités) :** périmètre MFA/paiement confondu ; couverture de tests faible (1 fichier) par rapport au rôle de pont Spaces ↔ Commerce.

### 2.8 Imperia (control plane) — P0
- **Fait vérifié :** 1 seul fichier de test (`imperia.test.ts`).
- **Findings (hérités, validés par ChatGPT) :** sandboxing non prouvé, sécurité du Control Plane à auditer avant toute production. C'est le BAC qui gouverne les autres — sa défaillance est systémique.

### 2.9 Subscription
- **Correction du rapport initial (qui affirmait « aucun repository, aucun test ») :**
  - **Fait vérifié :** 2 fichiers de test (`subscription-view.test.ts`, `coupon-repository.test.ts`).
  - **Fait vérifié (lecture de `migrations.ts`) :** le BAC **possède** 3 tables via `subscription.v1.001_create_subscription_tables` : `coupons`, `invoices`, `metering_buckets`, avec un adapter Postgres dédié (`coupon-repository.ts`).
  - **Fait vérifié :** la table `user_subscriptions` est **shell-owned** (Phase-0 `shell.core.v1.002` dans `src/shell/database/core-migration.ts`), **exclue à double titre** des migrations du BAC (par construction dans `SubscriptionPostgresMigrationProvider`, puis par filtre du wrapper `SubscriptionPhase0Provider` dans `src/shell/bac-migrations.ts`). La divergence de schéma est documentée : `cancel_at_period_end` BOOLEAN côté BAC contre INTEGER côté shell.
  - **Fait vérifié (lecture de `subscription.service.ts`) :** `SubscriptionService` lit/écrit `user_subscriptions` en **SQL brut via `DatabasePort`** (`SELECT * FROM user_subscriptions`), avec un `Map` en mémoire chargé au boot. Il n'y a pas de repository dédié pour les abonnements.
  - **Finding corrigé :** le problème n'est pas « aucune infrastructure » mais (a) une dette d'ownership de table assumée et documentée (transfert de `user_subscriptions` au BAC = backlog), (b) l'absence de repository typé pour les abonnements (SQL brut dans le service), (c) le défaut de support `bigint` dans `PostgresGrammar` (dates/epoch en `integer`/`timestamp` par contrainte).

### 2.10 Beam (messagerie) — P0
- **Fait vérifié (lecture du code) :**
  - Domaine : `messaging.model.ts`, `beam-e2e-crypto.ts` (ECDH **secp256k1** + AES-256-GCM), `beam-rich-messaging.ts` (bot router), `beam-push-storage-search.ts` (push dispatcher **en mémoire**, chunked uploader, recherche, antivirus EICAR, rétention GDPR).
  - Infrastructure : `postgres-messaging-repository.ts` (12 colonnes canoniques), `postgres-beam-notifications-repository.ts`, `beam-controller.ts`, `beam-service-provider.ts` (routes `/api/beam` + `/beam`).
  - 2 migrations, 3 fichiers de test.
  - **Correction :** le rapport initial listait `inventory-report.test.ts` comme 4e test de Beam. **C'est faux :** ce fichier appartient à `apps/inventory/src/`, pas à `apps/beam/`. Beam a exactement 3 fichiers de test.
- **Findings critiques (confirmés par ChatGPT) :**
  1. **Filtrage des participants en mémoire après LIMIT SQL** — `listConversationsAsync` applique le filtre `participantId` côté mémoire après la pagination SQL : résultats incorrects et fuite potentielle de conversations. Backlog : `BEAM-SQL-PARTICIPANT-FILTER`.
  2. **Aucune preuve d'isolation tenant** — le repository filtre par `conversationId`/`senderId`, aucun `tenantId` visible dans les requêtes.
  3. **E2E crypto non audité** — le moteur ECDH/AES-GCM est présent mais le cycle de vie des clés (stockage, rotation, nonces, MITM) n'est prouvé par aucun test.
  4. **Pont push manquant** — `BeamPushDispatcher` (Map en mémoire) et `PostgresBeamNotificationRepository` (Postgres) ne sont pas connectés. Backlog : `BEAM-PUSH-BRIDGE`.
- **Verdict ChatGPT :** « Stable à Production **non justifié** ».

### 2.11 Inventory (stock)
- **Fait vérifié (listing + lecture) :** `src/` ne contient que `domain/inventory-report.service.ts`, `index.ts`, `inventory-report.test.ts`. **Pas de dossier `infrastructure/`, pas de repository, pas de contrôleur, pas de migration.**
- **Fait vérifié :** le service est 100 % en mémoire (`Map`/`Array`) : positions de stock (`StockLevel` via port `StockSource`), visites en rupture, souscriptions d'alerte réappro. Manifest avec 2 capabilities et 2 événements.
- **Finding :** BAC squelette non persistant — tout est perdu au redémarrage. Extrait de Portfolio pour la pureté PIM (quantités sans prix). Le modèle de domaine est lui-même incomplet par rapport au périmètre déclaré dans `responsibilities.md` : pas de notion de `reserved`/`available`/`incoming`, pas de journal de mouvements.
- **Verdict ChatGPT :** « Squelette fonctionnel — non certifiable ».

---

## 3. Risques transversaux

1. **Isolation tenant non démontrée sur 10/11 BACs.** Seule Citadelle la prouve par test dédié (`identities-pg-isolation.test.ts`). Portfolio a des tests d'intrusion tenant (3 fichiers) qui constituent une base — c'est le modèle à répliquer. **Correction de cadrage (ChatGPT) :** « 10 BACs sans preuve » ≠ « 10 BACs vulnérables » — c'est une *sécurité non démontrée*, pas une *vulnérabilité avérée*. De même, la recommandation initiale « imposer tenantId dans toutes les requêtes » est trop simpliste : les modèles d'isolation varient (tenant-scoped / global / hybride — Imperia peut être global). Il faut standardiser la **garantie d'autorisation**, pas la structure SQL.
2. **Défauts critiques localisés chez Beam** (filtrage post-LIMIT, E2E non audité, push non ponté) — le BAC le plus exposé en confidentialité.
3. **Imperia sous-testé** (1 fichier) malgré son rôle de gouvernance systémique.
4. **Certification Citadelle non versionnée** : l'état RC1 certifié (41 tests, ADR-0024) n'est pas commité. Le gel n'est pas réversible par Git.
5. **Dette d'ownership de tables** : `user_subscriptions` shell-owned par le BAC Subscription (Phase-0 documentée, transfert en backlog) — pattern à surveiller car potentiellement récurrent d'autres BACs.
6. **Migrations partagées : RISQUE RETIRÉ** (voir correction §2.4). Chaque BAC possède ses propres migrations.

---

## 4. Verdict final de la validation architecturale

> « MosaiX doit passer d'une logique de développement par BAC à une logique de validation de plateforme. »

- **« Infrastructure complète » ≠ « opérationnel ».** Le « 8 BACs opérationnels » de la synthèse initiale est invalidé : la présence d'infrastructure n'est pas une preuve de parcours métier validé.
- **« Présence d'un fichier de test » ≠ « couverture ».** D'où le décompte par fichiers (ce rapport) et la nécessité de compter les scénarios réellement testés.
- **Le principal angle mort est inter-BAC, pas intra-BAC** : les audits individuels ne prouvent rien sur les contrats entre BACs (identité/tenant propagée depuis Citadelle, dépendances réelles, ownership de données).

### Reclassification des priorités (valide le rapport)

| Priorité | BACs | Raison |
|----------|------|--------|
| **P0** | **Imperia**, **Beam** | Sécurité systémique (Control Plane, sandboxing) / défauts structurels critiques (filtrage SQL, E2E, push) |
| **P1** | **Citadelle** (versionner le RC1), **Spaces**, **Portfolio**, **Commerce**, **Booking**, **Subscription** | Parcours métier à valider, isolation tenant à démontrer, dette d'ownership |
| **P2** | **Solara**, **Solidarity**, **Inventory** | Complétude (tests, persistance) |

### Feuille de route en 4 phases

1. **Sécurité / autorité** — certifier la propagation de l'identité et de l'autorisation depuis Citadelle (P0 Beam + Imperia).
2. **Contrats inter-BAC** — cartographier les dépendances réelles, l'ownership de données, la propagation tenant (voir §6).
3. **Complétude métier** — valider un parcours end-to-end par BAC P1.
4. **Certification** — tests d'isolation + parcours métier avant tout label « production ».

---

## 5. Corrections apportées par ce rapport (tableau de traçabilité)

| # | Affirmation antérieure | Statut | Preuve |
|---|------------------------|--------|--------|
| 1 | Portfolio : 7 ou 8 fichiers de test | **Faux — 10** | glob `apps/portfolio/**/*.test.ts` |
| 2 | Beam : 3 tests + `inventory-report.test.ts` hérité | **Faux — 3** | `inventory-report.test.ts` est dans `apps/inventory/src/` (glob confirmé) |
| 3 | Migrations `move_to_booking_schema`/`harden_booking` présentes dans Commerce **et** Booking | **Faux — uniquement dans Booking** | listing des dossiers `migrations/` des deux BACs |
| 4 | Solara : « pas de tests dédiés » | **Faux — 1 fichier** (`solara.test.ts`) | glob `apps/solara/**/*.test.ts` |
| 5 | Subscription : « aucun repository, aucun test » | **Partiellement faux —** 2 tests, 3 tables BAC-owned (`coupons`, `invoices`, `metering_buckets`), `coupon-repository.ts` Postgres. Seul `user_subscriptions` est shell-owned et le service des abonnements écrit du SQL brut sans repository | lecture de `migrations.ts` et `subscription.service.ts` |
| 6 | « 10 BACs sans preuve d'isolation tenant = 10 BACs vulnérables » | **Recadré** — sécurité non démontrée, pas vulnérabilité avérée | verdict ChatGPT |
| 7 | « Imposer tenantId dans toutes les requêtes » | **Recadré** — standardiser la garantie d'autorisation (modèles tenant-scoped / global / hybride) | verdict ChatGPT |

---

## 6. Prochaine mission recommandée

**Audit transversal des contrats inter-BAC (lecture seule)** — produit attendus :
- carte des dépendances réelles (imports, contrats, ports, événements émis/consommés),
- matrice d'ownership des données (qui crée quelle table, qui lit quoi),
- traçabilité de la propagation identité/tenant depuis Citadelle,
- graphes Mermaid des flux,
- conclusion **fondée sur l'évidence du code**, pas déduite des descriptions.

---

## 7. État Git au moment du rapport

- **Branche :** `audit-technique-mosaix-8397822254578305712`
- **Tête :** `06125f9`
- **Non commité (mission MFA Citadelle, gelée) :** modifiés — 6 fichiers Citadelle MFA, `packages/auth/src/auth-manager.ts`, `packages/core/src/event-bus.ts` (+ test), `src/shell/bac-migrations.ts` ; non suivis — `ADR-0024-citadelle-dynamic-mfa.md`, `postgres-mfa-repository.ts`, `mfa-repository-port.ts`, migration `20261108130000_create_mfa_secrets.ts`, 2 tests d'intégration, scripts `mfa_*.sql`/`mfa_*.cjs` à la racine.
- **Risque opérationnel :** le RC1 certifié n'est pas versionné ; un `git reset --hard` le détruirait. **Action minimale requise :** commiter l'état RC1 avant toute autre mission.

---

*Document produit le 9 novembre 2026. Les affirmations marquées [non vérifié] héritent de rapports de sessions antérieures et n'ont pas été re-contrôlées par lecture de code dans cette session.*
