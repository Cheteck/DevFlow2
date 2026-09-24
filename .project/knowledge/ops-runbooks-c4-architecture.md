# MosaiX Ops Runbooks & Architecture C4

Date : 2026-09-23  
Statut : Documenté & Approuvé

---

## 1. Diagrammes d'Architecture C4 (Mermaid)

### Niveau 1 : Contexte Système (System Context)

```mermaid
C4Context
    title Contexte Système — Plateforme MosaiX / IJIDeals

    Person(user, "Utilisateur / Client", "Accède aux applications et services unifiés via le Shell SSR")
    Person(admin, "Administrateur Tenant", "Gère la gouvernance, les espaces et les forfaits via Imperia")

    System(mosaix, "MosaiX Platform Core", "Orchestration, passerelle HTTP Gateway, bus d'événements et 10 BACs")

    System_Ext(stripe, "PSP / Stripe", "Traitement des paiements et webhooks")
    System_Ext(oauth, "Fournisseurs OAuth", "Google, GitHub, Microsoft OIDC")
    System_Ext(db, "PostgreSQL Cluster", "Bases multi-schémas avec RLS natif")

    Rel(user, mosaix, "Navigue, réserve, commande, échange", "HTTPS / WSS")
    Rel(admin, mosaix, "Supervise, configure les politiques", "HTTPS / API")
    Rel(mosaix, stripe, "Crée des PaymentIntents", "REST / TLS")
    Rel(mosaix, oauth, "Échange de codes d'autorisation", "OAuth 2.0")
    Rel(mosaix, db, "Lecture / écriture partitionnée par schéma & RLS", "TCP / TLS 1.3")
```

### Niveau 2 : Conteneurs Applicatifs (Container Diagram)

```mermaid
C4Container
    title Conteneurs Applicatifs — MosaiX Platform

    Container(gateway, "Gateway & Pipeline", "Node.js / TypeScript", "Routing, CORS, Token Bucket Rate Limiting, JWT Auth Middleware, OTLP Tracing")
    Container(shell, "Shell SSR & UI Runtime", "Server-Side Rendering", "Rendu dynamique des fragments HTML, gestion du thème UniTheme")
    Container(outbox, "Outbox Worker Daemon", "Background Process", "Dépilage et publication fiable des événements domaine vers Kafka / RabbitMQ")
    Container(citadelle, "BAC Citadelle", "Module IAM", "Authentification, gestion de sessions, Argon2/Bcrypt/Scrypt, OAuth, RGPD")
    Container(commerce, "BAC Commerce", "E-Commerce", "Saga checkout, réservations de stock, remboursements partiels, offres agnostiques")
    Container(booking, "BAC Booking", "Réservations", "Moteur de créneaux, RFC 5545 iCalendar, waitlist, allocation multi-ressources")
    Container(spaces, "BAC Spaces", "Multi-tenant", "Domaines DNS/SSL, isolation de tenants, SSO SAML, SCIM 2.0")
    Container(imperia, "BAC Imperia", "Gouvernance", "Évaluateur de règles Rego/OPA, conformité SOC 2 / HIPAA, GitOps drift detection")
    ContainerDb(postgres, "PostgreSQL Multi-Schema", "PostgreSQL 16+", "Schémas citadelle, commerce, etc., avec RLS natif")

    Rel(gateway, shell, "Délègue les requêtes HTML", "In-Process")
    Rel(gateway, citadelle, "Authentifie", "In-Process DI")
    Rel(gateway, commerce, "Exécute checkout", "In-Process DI")
    Rel(commerce, outbox, "Émet order.created via Outbox", "SQL Table")
    Rel(citadelle, postgres, "Schéma citadelle + RLS", "SQL")
    Rel(commerce, postgres, "Schéma commerce + RLS", "SQL")
```

---

## 2. Runbooks Opérationnels (Incident Response & Procedures)

### RUNBOOK-01 : Migration Zero-Downtime Schéma PostgreSQL
1. **Étape 1 — Création des schémas cibles** :
   Exécuter `CREATE SCHEMA IF NOT EXISTS "<bac>";` pour chacun des BACs sans impact sur le trafic.
2. **Étape 2 — Bascule des tables (Atomic move)** :
   Exécuter `ALTER TABLE "public"."<bac>_<table_name>" SET SCHEMA "<bac>";` suivi de `ALTER TABLE "<bac>"."<bac>_<table_name>" RENAME TO "<table_name>";`.
3. **Étape 3 — Rétro-compatibilité via Vues (Synonymes)** :
   Créer une vue temporaire dans `public` si des clients historiques requièrent l'ancien nom :
   `CREATE VIEW "public"."<bac>_<table_name>" AS SELECT * FROM "<bac>"."<table_name>";`.
4. **Étape 4 — Validation et rollback** :
   En cas d'anomalie, ré-exécuter `ALTER TABLE "<bac>"."<table_name>" SET SCHEMA "public";`.

### RUNBOOK-02 : Incident Sécurité SEV1 — Brute-Force ou Fuite de Session
1. **Étape 1 — Verrouillage du compte** :
   Invoquer `AccountLockoutGuard.recordFailure(userId)` pour geler les accès pendant 15 minutes.
2. **Étape 2 — Révocation de la famille de jetons de rafraîchissement** :
   Appeler `SessionTokenManager.revokeFamily(familyId)` pour invalider instantanément tous les refresh tokens associés.
3. **Étape 3 — Invalidation du cache de session Redis** :
   Exécuter `DEL session:token:<hash>` sur l'instance Redis active.
4. **Étape 4 — Audit des logs** :
   Consulter les traces OTLP pour extraire l'adresse IP et les requêtes associées.
