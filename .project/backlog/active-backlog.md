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

---

## 4. Fonctionnalités & Améliorations (entrée 2026-09-24, ordre de dev recommandé)

Règle plugin vs cœur (modèle `plugin-engine` tiers ui/application/privileged ; plugins existants = légers, optionnels, jamais sur chemin critique) :
- **CŒUR** = argent, identité, sécurité, gouvernance, invariants, RBAC, persistance per-app.
- **PLUGIN** = optionnel par boutique, sans état critique, event-driven, enrichit l'UI.

### 🔴 Urgent
- **FEAT-01 Mode maintenance** [CŒUR] (imperia + shell) : toggle admin, page maintenance pour les autres, bypass seuls rôles platform-admin/imperia, APIs en 503 sauf admin. Statut: pending.
- **FEAT-02 Inscription multi-étapes** [CŒUR] (citadelle + ui-runtime) : wizard step-by-step, progression, validation/sauvegarde par étape. Statut: pending.
- **FEAT-03 Ajout produit multi-étapes** [CŒUR] (portfolio + ui-runtime) : wizard vendable create, progression, draft persistant. Statut: pending.
- **FEAT-04 Enchères** [CŒUR + plugins périphériques] (commerce + portfolio + beam) : anglaise avec prix de réserve + extension anti-sniping + paiement via commerce ; moteur cœur `commerce.auction.*` (prix départ, offres, durée, clôture, historique opposable) ; badges/notifications/auto-bid en plugins `application`. Statut: pending.

### 🟠 Priorité élevée
- **FEAT-05 Comptes sociétés de livraison** [CŒUR] (citadelle + commerce + spaces) : inscription puis validation admin, assignation manuelle par le vendeur, profil entreprise, gestion livraisons, suivi statuts, dashboard dédié. Statut: pending.
- **FEAT-06 Rapports boutiques** [CŒUR + plugin rendu] (portfolio + commerce) : moteur données cœur (rares, bientôt en rupture, rupture, réappro) ; envoi hebdomadaire email + consultation dashboard ; formatage/envoi en plugin `application` (grants `portfolio:read`). Statut: pending.
- **FEAT-07 Intérêt produits en rupture** [CŒUR] (portfolio + telemetry) : comptage visites indisponibles, consultations malgré rupture, rapport demande. Statut: pending.
- **FEAT-08 Partage auto réseaux sociaux** [PLUGIN `application`] (solara + portfolio) : écoute `portfolio.vendable.published`, contenu auto-généré en brouillon, le vendeur choisit les réseaux et valide avant envoi, configurable par boutique. Statut: pending.

### 🟡 Moyenne
- **FEAT-09 Compteur de visites** [CŒUR + plugin affichage] (portfolio + telemetry) : session anonymisée RGPD sans IP brute, exclusion bots, uniques vs totales par période ; comptage fiable cœur ; widget stats boutique en plugin `ui`/`application`. Statut: pending.
- **FEAT-10 Registre de commerce** [CŒUR] (spaces + citadelle/imperia) : documents de vérification associés au **space** pro (pas à l'utilisateur), dépôt puis validation admin, statuts pending/verified/rejected, badge « vérifié » affiché sur la boutique, révocable, consultation/gestion admin. Statut: pending.
- **FEAT-11 Analyse catégories** [CŒUR] (imperia + spaces/portfolio) : catégories avec peu de boutiques, stats sous-représentation, dashboard admin. Statut: pending.
- **FEAT-12 Sidebar aide formulaires** [PLUGIN `ui`] (transversal ui-runtime) : contextuelle par étape, conseils, obligatoires/erreurs fréquentes. Statut: pending.

### 🟢 Complémentaire
- **FEAT-13 QR Codes** [PLUGIN `ui`] (transversal + portfolio/spaces) : QR statiques vers URL page/produit/boutique, téléchargement PNG/SVG, sans tracking. Statut: pending.

### Synthèse plugin vs cœur
- **Plugins idéaux** : FEAT-08, FEAT-12, FEAT-13 (+ volets affichage FEAT-09, rendu FEAT-06, périphérie FEAT-04).
- **Cœur obligatoire** : FEAT-01, 02, 03, 04 (moteur), 05, 06 (moteur), 07, 09 (comptage), 10, 11.
