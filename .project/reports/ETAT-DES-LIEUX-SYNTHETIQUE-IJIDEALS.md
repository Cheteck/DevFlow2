# État des lieux synthétique — IJIDeals MVP

**Date :** 8 novembre 2026  
**Sources :** MOSAIX-ROADMAP-EVOLUTION.md, IJIDEALS-ECOSYSTEM-ROADMAP.md, P0 audit technique, tests T1/T2 (PostgreSQL), BACKLOG.md  
**Statut :** Document de travail — à valider par ChatGPT

---

## 1. Contexte et dépendance MosaiX → IJIDeals

| Élément | Responsabilité |
|---------|---------------|
| **MosaiX** | Framework, contrats, SDK, runtime, BAC, plugins, infrastructure, outils développeur |
| **IJIDeals Échos** | Écosystème produit et expérience intégrée de référence |
| **Applications IJIDeals** | Interfaces spécialisées (commerce, social, messagerie, gestion…) |

**Règle de dépendance (roadmap IJIDeals §17) :** la roadmap IJIDeals dépend de MosaiX pour les fondations techniques. Lorsqu'une évolution touche le runtime, le SDK, les BAC, les capacités ou le système de plugins, il faut vérifier si la roadmap MosaiX doit également être mise à jour.

**Priorité stratégique (IJIDeals §1 / §11 Étape 1) :** consolider les fondations MosaiX et réduire les écarts architecturaux **avant** de construire le Composer complet ou de multiplier les applications.

---

## 2. Composition cible MVP

**Formule de référence (IJIDeals §1 / §12) :**

```
Citadelle + Solara + Portfolio + Commerce = IJIDeals
```

**Capacités transversales associées :** Spaces, Beam, Payments, Media, Notifications, Trust.

**Ordre de fondation métier (IJIDeals Étape 2) :**
1. Citadelle / identité
2. Spaces / acteurs, membres, rôles, contexte actif
3. Portfolio / objets vendables
4. Commerce / offres et commandes
5. Assets / médias
6. Notifications et événements transversaux

---

## 3. État réel par domaine MVP (synthèse P0 + roadmaps + preuves session)

| Domaine | Statut routeur | Statut réel (preuves) | Écart roadmap |
|---------|---------------|----------------------|---------------|
| **Citadelle (identité)** | ✅ Existant | 24 .ts, 3 tests, migrations, in-memory actif | Persistance PostgreSQL réelle à confirmer |
| **Spaces (acteurs)** | ✅ Existant | 20 .ts, 3 tests, Postgres repo, 3 migrations | Tests E2E manquants |
| **Portfolio (PIM)** | ⚠️ PARTIEL | 32 .ts, 9 tests, migration tenant_id appliquée, 0 test PG multi-tenant | Backfill `tenant_id = id` à clarifier sémantiquement |
| **Commerce (offres + commandes)** | ✅ Le plus avancé | 25 .ts, **10 tests**, checkout workflow présent | Checkout E2E non testé, panier réel absent |
| **Checkout** | ⚠️ Partiel | Workflow `checkout-order.workflow.ts` présent | Tests E2E absents |
| **Paiement Satim** | ⚠️ Partiel | Port `satim-payment-port.ts` défini, adapter à vérifier | Webhook HMAC fail-closed (V3.1) — reste canonisation SATIM |
| **Solara (social)** | ⚠️ Partiel | 16 .ts, **1 seul test** — couverture insuffisante | Renforcement tests (min 5) |
| **Beam (messagerie)** | ✅ Existant | 14 .ts, 3 tests, crypto E2E | Intégration conversations acheteur-vendeur à faire |
| **Multi-tenant** | ⚠️ PARTIEL | Migration appliquée (37 vendables backfillés), T1/T2 verts | Sémantique backfill à clarifier |
| **Enforcement capacités** | ❓ Non vérifié | Guards présents (`auth-guard.ts`, `space-resolution.ts`) | Validation runtime non prouvée |
| **Manifests BAC** | ❌ Absent | Aucun `manifest.json` dans `apps/*/` | Critique MosaiX Étape 1 |
| **Composition dynamique** | ❓ Non vérifié | `composition-loader.ts` présent — non audité | À auditer |
| **Tests E2E PostgreSQL** | ✅ En cours | T1 (3/3) + T2 (3/3) passés sur PostgreSQL | À étendre aux autres BAC |
| **CI** | ✅ Présente | `.github/workflows/ci.yml`, scripts `test`, `check` | — |
| **Docker** | ❌ Absent | Pas de `docker-compose.yml` | — |

**Tests :** ~41 tests au total (commerce 10, portfolio 9, solidarity 7, citadelle 3, spaces 3, beam 3, solara 1, booking 1, imperia 1, inventory 1, subscription 2, otp 0).

---

## 4. Gaps critiques pour le MVP (P0 §9)

### Bloquants (doivent être résolus avant le MVP)

| # | Gap | Preuve / Impact |
|---|-----|-----------------|
| 1 | **Manifests BAC absents** | Le runtime ne peut pas valider/activer les BAC de façon déclarative (MosaiX Étape 1) |
| 2 | **Tests E2E PostgreSQL** | Uniquement des tests in-memory (portfolio 49/49 sur InMemory) — pas de preuve d'isolation réelle en production-like |
| 3 | **Enforcement runtime des capacités** | Guards présents mais non validés en conditions réelles (MosaiX Étape 3) |
| 4 | **Paiement Satim** | Port défini, adapter manquant ou non testé — blocant le checkout réel |
| 5 | **Solara sous-testé** | 1 test pour 16 .ts — risque de régression sur le social (partie du MVP) |

### Non bloquants (post-MVP)

- Composition dynamique (Composer) — MosaiX Étape 2
- AI Runtime / Intelligence Core — MosaiX Étape 9
- Clients desktop (Forge) — IJIDeals Étape 8
- Solidarity — hors MVP marketplace
- Booking — vertical secondaire

---

## 5. Alignement roadmap MosaiX vs roadmap IJIDeals

| Étape MosaiX | Objet | Pertinence IJIDeals MVP |
|-------------|-------|------------------------|
| Étape 0 | Assainir et stabiliser les fondations | **Critique** — prérequis à tout le reste |
| Étape 1 | Application Contract Runtime | **Critique** — manifests BAC, contrat d'application |
| Étape 2 | BAC composables au runtime | Post-MVP (Composer) |
| Étape 3 | Enforcement capacités et politiques | **Critique** — guards + policy engine runtime |
| Étape 4-9 | Plugin, BAC installables, profiles, SDK, Control Plane, écosystème | Post-MVP |

| Étape IJIDeals | Objet | Pertinence MosaiX |
|---------------|-------|-------------------|
| Étape 0 | Clarifier périmètre produit | Fait (roadmap créée) — à consolider |
| Étape 1 | Consolider fondations MosaiX | **Critique** — dépend de MosaiX Étape 0 |
| Étape 2 | Stabiliser fondations métier communes | **Critique** — Citadelle → Spaces → Portfolio → Commerce |
| Étape 3 | Cœur marketplace IJIDeals | **Objectif MVP** — inscription, Space, offre, panier, commande |
| Étape 4-10 | Capacités avancées, social, Beam, extensions, desktop, IA, composition | Post-MVP |

**Convergence :** les deux roadmaps s'accordent sur l'ordre : **fondations MosaiX d'abord**, puis fondations métier (Citadelle → Spaces → Portfolio → Commerce), puis cœur marketplace.

---

## 6. Risque principal identifié

Le P0 signale que **portfolio est marqué "LIVRÉ" dans certaines parties du dépôt alors que la réalité est "PARTIEL"** (migration jamais appliquée avant la session, 0 test PostgreSQL multi-tenant, backfill sémantique à clarifier). Cette surestimation du statut doit être corrigée dans tout rapport ou roadmap présentant le multi-tenant comme terminé.

---

## 7. Questions ouvertes (à trancher)

1. Quelle est la sémantique métier du backfill `tenant_id = id` sur les 37 vendables existants ?
2. Quel est le périmètre exact du MVP (quelles fonctionnalités de Commerce sont indispensables) ?
3. Quels moyens de paiement sont disponibles dans le contexte algérien (Satim, autres) ?
4. Quelle est la première grille tarifaire vendeurs (gratuit/payant) ?
5. Le panier est-il global ou détenu par Commerce ?
6. Comment gérer les commandes multi-vendeurs ?

---

**Prochaine étape :** produire le plan global par phases (`.project/working/PLAN-GLOBAL-MVP-IJIDEALS.md`) dérivé de cet état des lieux et des deux roadmaps.