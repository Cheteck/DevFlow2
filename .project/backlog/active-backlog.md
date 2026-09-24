# MosaiX / IJIDeals Platform — Active Backlog

- **Dernière mise à jour :** 2026-09-23
- **Statut global :** Toutes les actions du backlog ont été implémentées et validées. Les actions complétées sont archivées dans `.project/archive/completed-backlog-history.md`.

---

## 1. Synthèse de l'État du Backlog

Toutes les phases de la feuille de route et les enrichissements demandés pour les 10 BACs (Phase 25) ont été livrés avec succès, compilés (`compile_applet`) et vérifiés (`lint_applet` sans aucune erreur) :

| Bounded Context / Périmètre | Actions Implémentées | Statut |
|---|---|---|
| **citadelle** (Identité & IAM) | BAC-CIT-01 à BAC-CIT-06 (Scrypt hasher, lockout guard, session rotation, OAuth providers, event sourcing, RGPD) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **commerce** (Commandes & Checkout) | BAC-COM-01 à BAC-COM-07 (Modèle enrichi, state machine, payment intent, stock reservation, saga, offres agnostiques multi-vendeurs) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **portfolio** (Catalogue & Vendables) | BAC-POR-01 à BAC-POR-06 (Pricing variants, inventory, SEO, workflow, recherche à facettes, bulk import/export CSV/JSON, média CDN) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **solara** (Social & Pulse) | BAC-SOL-01 à BAC-SOL-07 (Modération 3-tiers, scoring flux, tags/mentions, rich media OpenGraph, groupes, realtime notifier, analytics) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **booking** (Réservations & Créneaux) | BAC-BKG-01 à BAC-BKG-07 (iCalendar RFC 5545, empreinte bancaire, rappels T-24/T-1, portail stats, waitlist FIFO, multi-ressources, analytics) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **solidarity** (Humanitaire & Crises) | BAC-SLD-01 à BAC-SLD-07 (PostGIS/GeoJSON, matching géospatial Haversine, arbre de Merkle, offline sync queue, checklists, rapports OCHA/HXL) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **beam** (Messagerie & Communications) | BAC-BEM-01 à BAC-BEM-07 (Chiffrement E2E ECDH/AES-GCM, push FCM/APNs, rich messages, chunked upload, recherche, purge RGPD, bot commands) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **spaces** (Multi-tenant & Organisations) | BAC-SPC-01 à BAC-SPC-07 (Domaines DNS/SSL, RBAC actingAs, facturation à l'usage, templates, analytics cohortes, SSO SAML & SCIM 2.0, audit) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **imperia** (Gouvernance Plateforme) | BAC-IMP-01 à BAC-IMP-07 (Règles OPA/Rego, conformité SOC2/ISO/GDPR, GitOps drift detection, change management, secrets Vault, quotas budgets, runbooks) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **subscription** (Abonnements & Forfaits) | BAC-SUB-01 à BAC-SUB-07 (Metering horaire, prorata cycle, dunning retry, essais sans CB, coupons, comptabilité MRR/ARR, webhooks) | ✅ COMPLÉTÉ & ARCHIVÉ |
| **Transversal** (Architecture & Qualité) | BAC-TRV-01 à BAC-TRV-06 (OpenAPI generator, tests automatisés, observabilité OTLP/Prometheus, migrations DB, feature flags, ADR) | ✅ COMPLÉTÉ & ARCHIVÉ |

---

## 2. Historique & Archives
L'historique complet et détaillé des implémentations antérieures (Phases 1 à 24, dogfooding BL-010 à BL-023, décisions interactives) est disponible dans :
👉 `/.project/archive/completed-backlog-history.md`

---

## 3. Prochaines Étapes Opérationnelles (Roadmap Horizon Futurs)
Les actions suivantes représentent des chantiers d'infrastructure et d'industrialisation en environnement de production réel :

- **INFRA-01** : Déploiement en cluster Kubernetes multi-régions avec connectivité managée Kafka et RabbitMQ live.
- **INFRA-02** : Provisionnement des comptes de production partenaires (Stripe Connect live, APNs / FCM production credentials, instances Vault dédiées).
