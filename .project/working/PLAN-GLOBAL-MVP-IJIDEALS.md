# Plan global par phases — Finalisation MVP IJIDeals

**Date :** 8 novembre 2026  
**Dérivé de :** ETAT-DES-LIEUX-SYNTHETIQUE-IJIDEALS.md, MOSAIX-ROADMAP-EVOLUTION.md, IJIDEALS-ECOSYSTEM-ROADMAP.md, P0 audit, BACKLOG.md, validation ChatGPT (Martin Fowler)  
**Statut :** Validé par ChatGPT (GO conditionnel)  
**Règle de priorité :** MosaiX fondations d'abord, puis fondations métier (Citadelle → Spaces → Portfolio → Commerce), puis cœur marketplace (IJIDeals Étape 3).  
**Règle d'exécution :** P0 ne doit pas devenir un chantier MosaiX intégral — seules les fondations nécessaires au MVP sont bloquantes. Certaines tâches indépendantes peuvent avancer en parallèle.

---

## Vue d'ensemble des phases (7 phases, P0→P6)

| Phase | Objet | Durée estimée | Dépend de | Livrable clé |
|-------|-------|---------------|-----------|--------------|
| **P0** | Fondations MosaiX nécessaires au MVP (contrats, enforcement, E2E PG, booking.slots, backfill) | 2-3 semaines | — | MosaiX stabilisé pour le MVP, T1-T2 verts |
| **P1** | Fondations métier communes (Citadelle → Spaces → Portfolio → Commerce → Assets → Notifications) | 2-3 semaines | P0 | Domaines métier stables, tests PG par BAC |
| **P2** | Cœur marketplace IJIDeals (inscription, Space, offre, panier, commande) | 3-4 semaines | P1 | MVP utilisable : vendeur publie, acheteur commande |
| **P3** | Capacités commerciales avancées (plans, coupons, promotions, stock) | 2-3 semaines | P2 | Place marketplace viable |
| **P4** | Social Solara + Beam (conversations acheteur-vendeur) | 2-3 semaines | P2 | Intégration social + messagerie |
| **P5** | Capacités vendeurs avancées (plans abonnements, stats, badges) | 2-3 semaines | P2-P4 | Opérations vendeur quotidiennes |
| **P6** | Préparation production (charge, sécurité, monitoring, backup, Docker) | 2 semaines | P2-P5 | Prêt production |

> **Note :** Solara est exclu du MVP initial (phase P4). La composition cible MVP est : **Citadelle + Portfolio + Commerce** (+ Spaces comme acteur). Solara et Beam viennent en P4, après validation du cœur commercial.

---

## Phase P0 — Fondations MosaiX nécessaires au MVP (2-3 semaines)

**Objectif :** rendre MosaiX fiable pour porter le MVP IJIDeals. Uniquement les fondations nécessaires au MVP — pas une finalisation intégrale de MosaiX.

### Tâches priorisées

| ID | Tâche | Parallélisable | Preuve de sortie |
|----|-------|----------------|------------------|
| P0.1 | Corriger le bug migration `booking.slots` (collision v1.002/v1.003) | Non (bloque migrate) | `pnpm mosaix migrate` vert sur DB vierge |
| P0.2 | Clarifier la sémantique du backfill `tenant_id` sur les 37 vendables existants | Oui | Décision documentée, données historiques correctement attribuées |
| P0.3 | Valider l'enforcement des capacités (guards + policy engine) sur routes sensibles | Oui | Tests positifs + négatifs (isolation Spaces, contrôle accès) |
| P0.4 | Ajouter tests d'intégration PostgreSQL (au moins 1 par BAC fondamental : citadelle, spaces, commerce) | Oui | 1 test PG par BAC, isolation vérifiée |
| P0.5 | Implémenter/valider l'adapter de paiement Satim (paiement manuel traçable acceptable pour MVP) | Oui | Webhook HMAC fail-closed, paiement traçable |
| P0.6 | Créer les manifests BAC uniquement si le wiring statique ne suffit pas au MVP | Oui | `manifest.json` uniquement si requis par le runtime |
| P0.7 | Renforcer les tests Solara (reporté à P4 — Solara hors MVP) | Oui | Reporté à P4 |

### Statut actuel (déjà fait)
- ✅ T1 isolation inter-spaces : 3/3 verts sur PostgreSQL
- ✅ T2 isolation multi-tenant Portfolio : 3/3 verts sur PostgreSQL
- ✅ Migration tenant_id enregistrée + appliquée sur `mosaix_dev`
- ✅ P0 rapport corrigé (portfolio = PARTIEL)

### Critère de sortie P0
- `pnpm mosaix migrate` vert sur DB vierge (booking.slots corrigé)
- Backfill `tenant_id` clarifié et données historiques correctement attribuées
- Enforcement des capacités validé (tests d'isolation entre Spaces + contrôle d'accès)
- ≥1 test d'intégration PostgreSQL par BAC fondamental (citadelle, spaces, commerce)
- Adapter Satim fonctionnel (paiement manuel traçable)

---

## Phase P1 — Fondations métier communes (2-3 semaines)

**Objectif :** rendre fiables les domaines sur lesquels toutes les applications reposent. Ordre : Citadelle → Spaces → Portfolio → Commerce → Assets → Notifications.

### Tâches

| ID | Tâche | BAC | Preuve de sortie |
|----|-------|-----|------------------|
| P1.1 | Identité réelle : sessions, tokens, contexte d'identification persistant | Citadelle | Tests E2E login/logout/session |
| P1.2 | Spaces : création, membres, rôles, contexte actif | Spaces | E2E création Space → membres → rôles |
| P1.3 | Portfolio : objets vendables canoniques, multi-tenant réel | Portfolio | Tests PG multi-tenant (T2 déjà fait), backfill clarifié |
| P1.4 | Commerce : offres, panier réel, commandes, état de commande | Commerce | E2E offre → panier → commande → suivi |
| P1.5 | Assets : fichiers, médias, stockage | Assets | Tests upload/référence média |
| P1.6 | Notifications : in-app, événements transversaux | Notifications | Tests notification commande confirmée |

### Critère de sortie P1
- Frontières de données respectées (aucun BAC ne mutue les tables d'un autre)
- Parcours identité personnelle + action au nom d'un Space fonctionnel
- Paradigme `Product → Offer → Space` appliqué
- Contrats consommables depuis les clients web

---

## Phase P2 — Cœur marketplace IJIDeals (3-4 semaines)

**Objectif :** produire une expérience de vente utilisable et cohérente (IJIDeals Étape 3).

### Critères de validation MVP (explicites)

| Critère | Preuve attendue |
|---------|-----------------|
| Isolation entre Spaces | Test T1 : Space A ne voit pas les données de Space B |
| Contrôle des accès | Tests négatifs : utilisateur non autorisé rejeté (403) |
| Persistance PostgreSQL | Données survivent au restart, tests E2E PG verts |
| Cohérence des stocks | Stock décrémenté correctement à la commande |
| Traçabilité des commandes | Commande référence Product, Offer, Space, acheteur ; états traçables |

### Tâches

| ID | Tâche | Prérequis | Preuve de sortie |
|----|-------|-----------|------------------|
| P2.1 | Frontend : découverte offres, grille, fiche produit | P1 (Portfolio, Commerce) | 5 écrans vente (grille/fiche/search) |
| P2.2 | Frontend : panier et checkout | P1 (Commerce, panier réel) | Parcours panier → checkout fonctionnel |
| P2.3 | Backoffice vendeur : création offre, gestion stock | P1 (Spaces, Portfolio, Commerce) | Vendeur peut publier une offre |
| P2.4 | Authentification et inscription | P1 (Citadelle) | Inscription, authentification, session |
| P2.5 | Création et configuration d'un Space vendeur | P1 (Spaces) | Space vendeur créé, profil public |
| P2.6 | Création et suivi de commande | P1 (Commerce) | Commande référence Product, Offer, Space, acheteur |
| P2.7 | Notifications essentielles (commande confirmée, expédiée) | P1 (Notifications) | Notifications envoyées aux événements clés |
| P2.8 | Gestion initiale du stock et de la livraison | P1 (Commerce, Inventory) | Stock cohérent, politique de livraison |

### Critère de sortie P2 (MVP)
- Un vendeur peut publier une offre
- Un acheteur peut découvrir une offre et passer commande
- La commande référence correctement le Product, l'Offer, le Space et l'acheteur
- Les états transactionnels sont traçables
- Les parcours essentiels sont utilisables sur mobile
- **Tous les critères de validation MVP ci-dessus sont vert**

---

## Phase P3 — Capacités commerciales avancées (2-3 semaines)

**Objectif :** rendre IJIDeals viable pour les vendeurs et les opérations quotidiennes (IJIDeals Étape 4).

### Tâches

| ID | Tâche | Preuve de sortie |
|----|-------|------------------|
| P3.1 | Plans vendeurs et abonnement (gratuit/payant) | Plans et capacités appliqués côté backend |
| P3.2 | Période d'essai et plan gratuit | Événements d'abonnement et de facturation traçables |
| P3.3 | Commissions et limites fonctionnelles | Vendeurs comprennent leurs limites et avantages |
| P3.4 | Promotions et coupons | Moteur de promotions fonctionnel |
| P3.5 | Livraison personnalisée | Modes de livraison configurables |
| P3.6 | Gestion des retours | Processus retour/remboursement défini |
| P3.7 | Employés et permissions de l'équipe | Rôles espace appliqués |
| P3.8 | Statistiques et analyses de ventes | Tableau de bord vendeur |
| P3.9 | Ventes croisées, popularité, réputation | Badges, score confiance |
| P3.10 | Vérification documentaire et badges | Processus vérification documents |

### Critère de sortie P3
- Les plans et capacités sont appliqués côté backend
- Les événements d'abonnement et de facturation sont traçables
- Les opérations de vente, retour et stock sont cohérentes

---

## Phase P4 — Social Solara + Beam (2-3 semaines)

**Objectif :** intégrer la découverte sociale et la messagerie (après validation du cœur commercial).

### Tâches Solara

| ID | Tâche | Preuve de sortie |
|----|-------|------------------|
| P4.1 | Profils personnels et pages de Spaces | Utilisateurs peuvent interagir socialement |
| P4.2 | Publications, commentaires, réactions | Solara renforcé (≥5 tests) |
| P4.3 | Abonnements / followers | Flux d'actualité fonctionnel |
| P4.4 | Publications au nom d'un Space | Permissions vérifiées côté serveur |
| P4.5 | Activités commerciales dans le flux | Événements Commerce présentés sans transfert de propriété |
| P4.6 | Modération et signalement | Processus de modération clair |

### Tâches Beam

| ID | Tâche | Preuve de sortie |
|----|-------|------------------|
| P4.7 | Conversations 1:1 et groupes | Contexte d'acteur préservé |
| P4.8 | Conversations utilisateur ↔ Space | Accès vérifié côté serveur |
| P4.9 | Partage d'offres, produits et commandes | Objets détenus par leur domaine source |
| P4.10 | Notifications temps réel | Notifications Beam fonctionnelles |

### Critère de sortie P4
- Les utilisateurs peuvent interagir socialement
- Les Spaces peuvent publier avec des permissions vérifiées
- Les conversations acheteur-vendeur fonctionnent avec contexte d'acteur préservé

---

## Phase P5 — Capacités vendeurs avancées (2-3 semaines)

**Objectif :** opérations vendeur quotidiennes avancées.

### Tâches

| ID | Tâche | Preuve de sortie |
|----|-------|------------------|
| P5.1 | Plans et abonnements vendeurs | Grille tarifaire appliquée côté backend |
| P5.2 | Statistiques et analyses de ventes | Tableau de bord vendeur |
| P3.9/P5.3 | Ventes croisées, popularité, réputation | Badges, score confiance |
| P5.4 | Vérification documentaire | Processus vérification documents |

---

## Phase P6 — Préparation production (2 semaines)

**Objectif :** rendre l'application prête pour la production.

### Tâches

| ID | Tâche | Preuve de sortie |
|----|-------|------------------|
| P6.1 | Tests de charge | Performance acceptable sous charge |
| P6.2 | Sécurité (audit, rate limiting, secrets) | Aucun secret exposé, rate limiting actif |
| P6.3 | Monitoring (logs, métriques, alertes) | `/metrics` exposé, logs structurés |
| P6.4 | Documentation opérationnelle | Runbook déploiement, backup, recovery |
| P6.5 | Backup & recovery | Procédure de restauration testée |
| P6.6 | Docker / déploiement reproductible | `docker-compose.yml` ou équivalent |

### Critère de sortie P6
- Application déployable en production
- Monitoring et alertes opérationnels
- Procédure de backup/restauration validée

---

## Dépendances critiques et ordre d'exécution

```
P0 (MosaiX fondations MVP) 
  → P1 (fondations métier: Citadelle→Spaces→Portfolio→Commerce)
    → P2 (cœur marketplace: inscription, Space, offre, panier, commande)
      → P3 (capacités commerciales avancées)
      → P4 (social Solara + Beam messagerie)
      → P5 (capacités vendeurs avancées)
        → P6 (préparation production)
```

**Règle d'exécution :** aucune phase ne commence avant que la phase précédente n'atteigne son critère de sortie. Certaines tâches indépendantes au sein d'une phase peuvent avancer en parallèle.

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Surestimation du statut (ex: portfolio marqué LIVRE alors PARTIEL) | Élevé | Toujours vérifier par la preuve (code, tests, CI) avant de déclarer terminé |
| Backfill `tenant_id = id` sémantiquement incorrect | Élevé | Clarifier avant de considérer le multi-tenant comme livré (P0.2) |
| Bug `booking.slots` bloque `mosaix migrate` sur DB vierge | Moyen | Corriger la double déclaration de ressource (P0.1, sans contourner les contrôles de collision) |
| Paiement Satim non disponible en contexte algérien | Élevé | Paiement manuel traçable acceptable pour MVP (Satim live post-MVP) |
| Construire trop d'applications simultanément | Élevé | Prioriser les parcours marketplace et les fondations communes |
| Confondre Space et Shop | Moyen | Space = acteur vendeur, capacités commerciales (pas d'entité Shop distincte) |
| Manifests comme prérequis artificiel | Moyen | Créer les manifests uniquement si le wiring statique ne suffit pas au MVP (P0.6) |
| Solara inclus dans le MVP par erreur | Faible | Solara exclu du MVP, déplacé en P4 (clarifié dans ce document) |

---

## Prochaines actions immédiates

1. **P0.1** : Corriger le bug `booking.slots` pour débloquer `mosaix migrate` sur DB vierge
2. **P0.2** : Clarifier la sémantique du backfill `tenant_id` sur les 37 vendables
3. **P0.3-P0.5** : Valider enforcement capacités, tests PG par BAC, adapter Satim
4. **P0.6** : Décider si les manifests BAC sont requis pour le MVP
5. **P1.1-P1.6** : Démarrer les fondations métier une fois P0 terminé

---

**Document vivant — à mettre à jour après chaque validation de phase.**