# Rapport d'Analyse des Écarts (Gap Analysis) — Plateforme MosaiX / IJIDeals
**Date :** 2026-09-22  
**Auteur :** Autonomous Engineering Steward  
**Statut :** Validé — Baseline Architecture & Production Readiness  

---

## Synthèse Exécutive

Cette analyse exhaustive évalue l'état actuel de la plateforme **MosaiX / IJIDeals** par rapport aux spécifications cibles, aux exigences de production et aux standards de robustesse logicielle.

### Matrice d'Évaluation Globale

| Catégorie de Gap | Niveau de Sévérité | Statut Global | Priorité d'Action |
|---|---|---|---|
| **1. Functional Gap** | 🟡 Modéré | 85% Conforme | P1 — Finalisation Outbox Broker & Facturation récurrente |
| **2. Technical Gap** | 🟡 Modéré | 80% Conforme | P1 — Découplage du Shell `start.ts` & Typage strict du bus |
| **3. Performance Gap** | 🟢 Faible | 88% Conforme | P2 — Keyset pagination & Cache SSR |
| **4. Security Gap** | 🟡 Modéré | 90% Conforme | P1 — Sandboxing des plugins tiers & Enforce secret prod |
| **5. Data Gap** | 🟡 Modéré | 82% Conforme | P1 — Unification des migrations et isolation multi-tenant |
| **6. UX/UI Gap** | 🟢 Faible | 92% Conforme | P2 — Vue mobile responsive & Squelettes de chargement |
| **7. Compatibility Gap** | 🟡 Modéré | 85% Conforme | P2 — Node SQLite expérimental & Polyfills CSS |
| **8. Compliance Gap** | 🔴 Élevé | 70% Conforme | P0/P1 — RGPD (Droit à l'oubli) & Accessibilité WCAG 2.1 |
| **9. Scalability Gap** | 🔴 Élevé | 75% Conforme | P0 — Dépendance SQLite single-node & Bus distributed pub/sub |

---

## 1. Functional Gap (Écarts Fonctionnels)

*Fonctionnalités documentées ou prévues dans la roadmap mais absentes ou partiellement implémentées.*

### 1.1. Streaming Réel Outbox vers Broker Distribué (Phase 21)
- **Constat :** Les contrats et classes du pattern *Transactional Outbox* (`OutboxWorker`, `OutboxMessagingPublisher`) sont implémentés avec support in-memory et stubs Kafka/RabbitMQ.
- **Écart :** En environnement distribué, il manque le pilotage live avec gestion des accusés de réception (ACK/NACK), les mécanismes de dead-lettering automatique au niveau réseau et les tests d'intégration avec un cluster réel.
- **Impact :** Risque de perte d'événements inter-domaines en cas de redémarrage brutal de nœud sans broker persistant externe.

### 1.2. Moteur de Souscriptions & Facturation Récurrente (`apps:subscription` - Phase 23)
- **Constat :** La gouvernance commerciale gère les commandes unitaires (`apps/commerce`), les catalogues (`apps/portfolio`) et les réservations (`apps/booking`).
- **Écart :** Absence du bounded context dédié aux abonnements récurrents, périodes d'essai, facturation à l'usage (metered billing) et coupure automatique d'accès par capability-gating.
- **Impact :** Nécessité de gérer manuellement les droits d'accès prolongés aux services premium.

### 1.3. Passerelle de Paiement & Webhooks Transactionnels
- **Constat :** Le flux de checkout démo simule l'autorisation et le débit avec une mise à jour d'état immédiate.
- **Écart :** Absence d'intégration d'une passerelle PSP réelle (Stripe, Adyen, SEPA) avec validation asynchrone des signatures de webhooks et gestion des paiements 3D Secure / refus bancaires.

---

## 2. Technical Gap (Écarts Techniques & Architecturaux)

*Limitations ou manques structurels au niveau de l'architecture, du code ou de l'orchestration.*

### 2.1. Monolithe de Démarrage (`src/start.ts`)
- **Constat :** `src/start.ts` concentre plus de 1900 lignes de code, mixant serveur HTTP Node.js, agrégation de routes, rendu de templates HTML côté serveur (SSR), gestion de session et injection de dépendances.
- **Écart :** Violation du principe de responsabilité unique (SRP). Le runtime Shell doit être scindé en modules autonomes : `HttpGateway`, `ShellSsrEngine`, `DevSessionController`, `CompositionSupervisor`.
- **Impact :** Complexité de maintenance élevée, risque de régression sur le boot et difficulté de tester les couches de présentation isolément.

### 2.2. Dualité Mémoire vs Persistance dans les Services Applicatifs
- **Constat :** Plusieurs services de domaine (ex: `SolaraSocialService`, `BeamMessagingService`) initialisent des collections `Map<string, ...>` par défaut et ne basculent sur leur repository PostgreSQL que si celui-ci est explicitement injecté.
- **Écart :** Risque d'incohérence si l'application démarre sans repository configuré : les données sont conservées en mémoire vive et perdues au redémarrage sans lever d'alerte explicite en mode production.
- **Impact :** Comportement split-brain en cas de déploiement multi-instances sans backend persistant partagé.

### 2.3. Typage et Validation des Enveloppes d'Événements
- **Constat :** Certains payloads d'événements transitent sous forme de `Record<string, unknown>`.
- **Écart :** Absence de validation systématique à la réception via des schémas Zod stricts pour tous les événements inter-BACs.

---

## 3. Performance Gap (Écarts de Performance & Temps de Réponse)

*Performances réelles ou théoriques inférieures aux objectifs de production.*

### 3.1. Concaténation de Chaînes SSR sans Cache de Rendu
- **Constat :** Le rendu HTML complet de l'interface shell et des vues BACs est recalculé par interpolation de chaînes lors de chaque requête sur `/`.
- **Écart :** Absence de mise en cache intermédiaire des fragments de widgets statiques (app cards, navigation, sélecteur de thème) et absence de streaming HTTP (chunked transfer).
- **Impact :** Latence TTFB (Time To First Byte) dégradée sous forte charge concurrente.

### 3.2. Absence de Keyset Pagination sur le Fil d'Actualité (`shell_feed`)
- **Constat :** `initFeedStore` et les routes de lecture chargent l'intégralité des publications en mémoire sans clause `LIMIT / OFFSET` ou curseur d'horodatage.
- **Écart :** Consommation mémoire linéaire avec le volume de publications créées.

### 3.3. Mutualisation des Connexions Base de Données
- **Constat :** Chaque adaptateur gère ses requêtes individuellement sans pool de connexions dynamique partagé entre les BACs.
- **Écart :** Risque d'épuisement des sockets PostgreSQL (`max_connections`) lors d'un pic de charge multi-BACs.

---

## 4. Security Gap (Écarts de Sécurité & Vulnérabilités)

*Exigences de sécurité, gestion des secrets et contrôle d'accès.*

### 4.1. Isolation et Sandboxing des Plugins Dynamiques
- **Constat :** `DynamicBacRegistry` charge et exécute les modules BACs dans le même contexte d'exécution Node.js (trusted isolation).
- **Écart :** Si des plugins tiers non vérifiés sont autorisés, ils disposent d'un accès direct aux variables d'environnement, aux fichiers locaux et aux instances de base de données.
- **Recommandation :** Encapsuler les extensions non certifiées dans un environnement isolé (Worker Threads / V8 Isolate sandbox).

### 4.2. Fail-Fast sur les Secrets Cryptographiques
- **Constat :** En mode développement, des clés secrètes par défaut sont tolérées pour faciliter l'onboarding.
- **Écart :** Nécessité d'interdire tout démarrage (`throw new FatalSecurityException`) en environnement `NODE_ENV=production` si `MOSAIX_AUTH_JWT_SECRET` ou les clés de chiffrement de stockage ont une entropie inférieure à 256 bits.

### 4.3. Modération Active et File de Quarantaine de Contenu
- **Constat :** Le feature flag `solara.moderation.ai_filter` active le plugin de modération, mais les contenus suspects ne sont pas isolés dans une file de quarantaine avant publication.

---

## 5. Data Gap (Écarts de Données & Modélisation)

*Cohérence, intégrité, migrations et structuration des schémas.*

### 5.1. Unification du Moteur de Migrations (`@mosaix/migrations`)
- **Constat :** Certaines tables (ex: `shell_feed`, tables d'identité SQLite) sont créées via des instructions DDL brutes `CREATE TABLE IF NOT EXISTS` dispersées dans le code de démarrage.
- **Écart :** Écart par rapport à la spécification canonique où toutes les mutations de schéma doivent être des fichiers de migration versionnés (`001_initial.sql`, `002_add_indexes.sql`) avec table de suivi `mosaix_schema_migrations`.

### 5.2. Isolation Cloisonnée des Données Multi-Tenant
- **Constat :** Le modèle d'isolation multi-tenant par schéma (`schema-per-tenant`) est implémenté pour PostgreSQL mais non appliqué sur la persistance locale SQLite de développement (fichier unique global).
- **Écart :** Absence de test local d'étanchéité stricte entre deux tenants distincts en mode SQLite.

### 5.3. Traçabilité Complète d'Audit (Imperia Audit Log)
- **Constat :** Les événements de domaine critiques sont journalisés, mais les requêtes d'administration HTTP directes (changement de thème, switch de rôle utilisateur) ne génèrent pas systématiquement une entrée immuable dans l'audit log d'Imperia.

---

## 6. UX/UI Gap (Écarts d'Expérience Utilisateur)

*Adéquation entre l'interface utilisateur actuelle et les standards ergonomiques modernes.*

### 6.1. Adaptation Responsive sur Écrans Mobiles (<640px)
- **Constat :** L'agencement tri-zone (Barre latérale BACs + Zone principale + Colonne d'activité) est optimisé pour les affichages Desktop et Tablettes larges.
- **Écart :** Sur smartphone, le volet d'activité latéral et les widgets de gouvernance peuvent compresser l'espace utile sans tiroir rétractable dédié (*drawer bottom-sheet*).

### 6.2. États de Chargement Optimistes et Squelettes (Skeleton UI)
- **Constat :** Les actions interactives (changement de composition, switch d'espace, publication de post) rechargent les données ou attendent la réponse réseau.
- **Écart :** Absence de skeleton screens lors des transitions et absence de mise à jour optimiste de l'UI pendant les appels API.

---

## 7. Compatibility Gap (Écarts de Compatibilité & Environnements)

*Compatibilité avec les runtimes, navigateurs et plateformes d'exécution.*

### 7.1. Dépendance au Module Expérimental SQLite de Node 22
- **Constat :** `@mosaix/adapter-database-sqlite` exploite `node:sqlite`.
- **Écart :** Node.js émet un avertissement d'API expérimentale (`ExperimentalWarning: SQLite is an experimental feature`). L'application n'est pas rétrocompatible avec Node.js 20 LTS sans la dépendance `better-sqlite3`.
- **Recommandation :** Fournir un fallback automatique vers `better-sqlite3` si `node:sqlite` n'est pas disponible dans le runtime hôte.

### 7.2. Contraintes de Bundling ESM Strict
- **Constat :** L'ensemble du monorepo utilise le format ECMAScript Modules (`"type": "module"`).
- **Écart :** Nécessite des extensions `.js` explicites dans tous les imports relatifs TypeScript compilés.

---

## 8. Compliance Gap (Écarts de Conformité & Réglementation)

*Exigences légales, protection de la vie privée et accessibilité.*

### 8.1. Conformité RGPD / GDPR (Droit à l'Oubli et Portabilité)
- **Constat :** Les profils utilisateurs sont persistés dans `citadelle` et associés à des commandes, messages et publications.
- **Écart :** Absence d'un workflow automatisé orchestrant la suppression en cascade et l'anonymisation irréversible des données personnelles à travers les 9 bases de données des BACs lors d'une demande de suppression de compte.

### 8.2. Bannière de Consentement des Cookies et Télémétrie
- **Constat :** Les métriques OTLP et le traçage des sessions sont actifs.
- **Écart :** Absence d'interface utilisateur permettant à l'utilisateur d'activer/désactiver sélectivement la télémétrie non essentielle et les cookies analytiques.

### 8.3. Accessibilité Numérique (WCAG 2.1 Niveau AA)
- **Constat :** Les thèmes respectent une palette contrastée.
- **Écart :** Les graphiques de topologie interactive et les panneaux de disjoncteurs dans `Imperia` ne disposent pas d'alternatives textuelles complètes ou de navigation intégrale au clavier (ARIA landmarks et focus traps).

---

## 9. Scalability Gap (Écarts de Scalabilité & Haute Disponibilité)

*Capacité du système à absorber l'échelle (utilisateurs, données, débit).*

### 9.1. Limite de Concurrence Écriture de SQLite en Local
- **Constat :** En environnement local/embarqué, SQLite utilise un verrouillage au niveau fichier.
- **Écart :** Impossibilité d'exécuter des tests de charge simultanés simulant des milliers de transactions concurrentes sur l'instance SQLite sans activer le mode WAL (Write-Ahead Logging) optimisé.

### 9.2. Mise à l'Échelle Horizontale du Bus d'Événements et du SSE
- **Constat :** Le transport temps réel SSE et le bus d'événements `MosaixMessageBus` fonctionnent en mémoire locale au processus Node.js.
- **Écart :** Si 5 instances de l'application sont déployées derrière un Load Balancer, un message publié sur l'instance A n'est pas reçu par l'utilisateur connecté en SSE sur l'instance B sans un backplane Redis PubSub ou NATS.

---

## Plan d'Action Recommandé (Feuille de Route de Remédiation)

```
                       PLAN DE REMÉDIATION PRIORISÉ
                                    
  [ P0 — CRITIQUE ] ───────────────────────────────────────────────┐
  • Déploiement d'un broker persistant externe (Kafka/RabbitMQ)    │
  • Enforce strict des secrets en production                       │
  • Workflow de conformité RGPD (Droit à l'oubli multi-BACs)       │
                                                                   │
  [ P1 — STRUCTUREL ] ─────────────────────────────────────────────┤
  • Découpage modulaire du fichier start.ts (Gateway / SSR / Hub)  │
  • Unification des schémas et DDL via @mosaix/migrations          │
  • Intégration du module Subscription / Billing (Phase 23)        │
                                                                   │
  [ P2 — EXPÉRIENCE & OPTIMISATION ] ──────────────────────────────┘
  • Mise en cache et streaming des rendus SSR
  • Keyset pagination sur l'ensemble des flux temps réel
  • Audit d'accessibilité WCAG 2.1 AA et mode responsive mobile
```

### Prochaines Étapes Opérationnelles
1. **Création des tickets backlog** correspondant à chaque gap P0 et P1 identifié.
2. **Refactoring progressif de `src/start.ts`** en créant des sous-modules dédiés dans `src/shell/`.
3. **Mise à jour de la documentation d'architecture** pour refléter les exigences de scalabilité multi-nœuds.
