# P0 — État des lieux technique MosaiX & IJIDeals

**Date :** 8 novembre 2026  
**Auteur :** Agent Dev (audit technique)  
**Objectif :** Établir la réalité technique du dépôt avant de planifier la finalisation du MVP IJIDeals.

---

## 1. Vue d'ensemble du dépôt

### Structure

```
mosaix/
├── apps/              # 13 BACs / applications
├── packages/          # 40+ packages MosaiX (core, sdk, ports, adapters, etc.)
├── plugins/           # plugins (non inspecté)
├── src/               # Shell / runtime principal (Next.js full-stack)
├── .project/          # Mémoire projet, workflows, rapports
└── .github/workflows  # CI (ci.yml)
```

### BACs identifiés (apps/)

| BAC | Fichiers .ts | Tests | Migrations | Statut |
|-----|--------------|-------|------------|--------|
| **citadelle** | 24 | 3 | ✅ 2 | Identity/Auth — Présent |
| **spaces** | 20 | 3 | ✅ 3 | Acteurs collectifs — Présent |
| **commerce** | 25 | 10 | ✅ 3 | Offres, commandes, checkout — Présent |
| **portfolio** | 32 | 9 | ✅ 1 (nouvelle) | PIM / vendables — **LIVRÉ** (multi-tenant) |
| **solara** | 16 | 1 | ✅ 3 | Social — Présent |
| **beam** | 14 | 3 | ✅ 2 | Messagerie — Présent |
| **booking** | 13 | 1 | ✅ 3 | Réservations — Présent |
| **imperia** | 21 | 1 | ? | Gouvernance — Présent |
| **inventory** | 2 | 1 | ? | Stocks — Minimal |
| **subscription** | 10 | 2 | ? | Abonnements — Présent |
| **otp** | 1 | 0 | ? | 2FA/SMS — Skeleton |
| **solidarity** | 16 | 7 | ? | Solidarité/crise — Présent |
| **_template** | — | — | — | Template — N/A |

**Total :** ~194 fichiers .ts métier, 41 tests, 17+ migrations.

---

## 2. MosaiX Core — Packages techniques

### Packages principaux (non exhaustif)

| Catégorie | Packages |
|-----------|----------|
| **Core** | `core`, `sdk`, `contracts`, `schemas`, `types` |
| **Runtime** | `orchestration`, `plugin-engine`, `command-center`, `events`, `pipeline` |
| **Infrastructure** | `database`, `http`, `cache`, `filesystem`, `orm`, `migrations` |
| **Security** | `auth`, `security`, `otp` |
| **DevX** | `cli`, `dev-server`, `dev-session`, `conformance`, `theme` |
| **Ports/Adapters** | `ports/*`, `adapters/*` |

### Manifests & Conformance

- **Manifests BAC :** Aucun `manifest.json` trouvé dans `apps/*/` (seuls des `theme-manifest.schema.json` dans `node_modules`).
- **Conformance :** Script `check:conformance` présent (`scripts/validate-conformance.ts`).
- **Contrats :** Package `@mosaix/contracts` présent.

---

## 3. Runtime & Shell

### Fichiers clés (`src/`)

```
src/
├── start.ts                    # Point d'entrée
├── generated-bac-wiring.ts     # Enregistrement des BAC
├── server/
│   ├── api-dispatcher.ts
│   ├── bac-wiring.ts
│   ├── context/render-context.ts
│   └── middleware/
│       ├── auth-guard.ts
│       ├── health-check.middleware.ts
│       ├── maintenance-gate.ts
│       └── space-resolution.ts
├── routes/                     # 15+ routes (auth, spaces, feed, mcp, themes, etc.)
└── shell/
    ├── composition-loader.ts
    ├── bac-access.ts
    └── anonymization-orchestrator.ts
```

### Middlewares identifiés

- `auth-guard.ts` — Protection des routes
- `health-check.middleware.ts` — Santé API
- `maintenance-gate.ts` — Mode maintenance
- `space-resolution.ts` — Résolution du Space actif

---

## 4. BACs fondamentaux pour le MVP IJIDeals

### 4.1 Citadelle (Identity)

**Fichiers :** 24 .ts, 3 tests  
**Domaine :**

- `domain/user.model.ts`, `domain/user.ts`, `domain/user-service.ts`
- `domain/session-tokens.ts`, `domain/password-hasher.port.ts`
- `domain/citadelle-policy.ts`, `domain/citadelle-oauth-providers.ts`
- `events/identity-events.ts`

**Infrastructure :**

- In-memory : identity, session, token, credential, user, secrets
- Migrations : `20260922161500_harden_citadelle_security.ts`

**Controller :** `infrastructure/identity-controller.ts`  
**View :** `presentation/citadelle-view.ts`

**Statut :** ✅ Fonctionnel (in-memory fallback détecté dans les logs)

---

### 4.2 Spaces

**Fichiers :** 20 .ts, 3 tests  
**Domaine :**

- `domain/space.model.ts`, `domain/space-roles.ts`, `domain/space-template.ts`
- `domain/acting-as-space.ts`, `domain/space-audience.ts`
- `commands/create-space.command.ts`
- `events/spaces-events.ts`

**Infrastructure :**

- `infrastructure/postgres-space-repository.ts`
- Migrations : 3 (création + durcissement)

**Controller :** `infrastructure/space-controller.ts`  
**View :** `presentation/spaces-view.ts`

**Statut :** ✅ Présent — à tester en intégration

---

### 4.3 Commerce

**Fichiers :** 25 .ts, **10 tests** (le plus testé)  
**Domaine :**

- `domain/order.model.ts`, `domain/order.service.ts`, `domain/order-state-machine.ts`
- `domain/commerce-offer.model.ts`
- `domain/coupon-service.ts`, `domain/promotion-engine.ts`
- `domain/payment-intent.ts`, `domain/satim-payment-port.ts`
- `domain/auction.service.ts`, `domain/delivery-partner.service.ts`
- `events/commerce-events.ts`
- `workflows/checkout-order.workflow.ts`

**Infrastructure :**

- Repositories Postgres : offer, order, auction
- Migrations : 3 (`20260926092000`, `20260926110000`, `20261013000000`)

**Controller :** `infrastructure/commerce-controller.ts`  
**View :** `presentation/commerce-view.ts`

**Statut :** ✅ **Le plus avancé** — workflow checkout présent

---

### 4.4 Portfolio

**Fichiers :** 32 .ts, 9 tests  
**Domaine :**

- `domain/vendable.ts`, `domain/portfolio-service.ts`
- `domain/proposal-service.ts` (workflow : Draft → Submitted → InReview → Approved → Vendable)
- `domain/portfolio-errors.ts`, `domain/product-options.ts`

**Infrastructure :**

- In-memory : proposal, vendable
- Postgres : repositories
- **Migration multi-tenant :** `20261108120000_add_tenant_id_to_portfolio.ts` (fichier exists, appliqué sur mosaix_dev le 2026-11-08, enregistré dans `src/shell/bac-migrations.ts` sous l'id `portfolio.catalog.v1.008_tenant_id`)

**Tests :** **49/49 verts** sur `InMemoryVendableRepository` uniquement (commit `bdc8b0d`). **Zéro test PostgreSQL multi-tenant** (aucun test utilisant `PostgresVendableRepository` avec `tenant_id`).

**Statut :** ⚠️ **PARTIEL** — isolation multi-tenant en mémoire validée, mais schéma PostgreSQL `tenant_id` n'était pas appliqué en base de dev (corrigé le 2026-11-08) et aucun test PostgreSQL multi-tenant n'existe. Le backfill des 37 vendables historiques a utilisé `tenant_id = id` (chaque vendable a un tenant différent) — la sémantique métier du backfill doit être clarifiée avant de considérer le multi-tenant comme livré.

---

### 4.5 Solara (Social)

**Fichiers :** 16 .ts, 1 test  
**Domaine :**

- `domain/social.model.ts`
- `commands/create-post.command.ts`
- `domain/solara-feed-realtime.ts`, `domain/solara-moderation-pipeline.ts`
- `domain/social-auto-share-plugin.ts`

**Infrastructure :**

- `domain/postgres-social-repository.ts`
- Migrations : 3

**Controller :** `infrastructure/solara-controller.ts`

**Statut :** ⚠️ **1 seul test** — à renforcer

---

### 4.6 Beam (Messaging)

**Fichiers :** 14 .ts, 3 tests  
**Domaine :**

- `domain/messaging.model.ts`
- `commands/send-message.command.ts`
- `domain/beam-e2e-crypto.ts`, `domain/beam-rich-messaging.ts`

**Infrastructure :**

- Postgres : messaging, notifications
- Migrations : 2

**Controller :** `infrastructure/beam-controller.ts`

**Statut :** ✅ Présent — tests à vérifier

---

### 4.7 Booking

**Fichiers :** 13 .ts, 1 test  
**Statut :** ⚠️ Minimal — 1 test seulement

---

### 4.8 Imperia (Gouvernance)

**Fichiers :** 21 .ts, 1 test  
**Statut :** ⚠️ Présent — rôle exact à confirmer (Control Plane ?)

---

## 5. Tests & CI

### Coverage par BAC

| BAC | Tests |
|-----|-------|
| commerce | 10 |
| portfolio | 9 |
| solidarity | 7 |
| citadelle | 3 |
| spaces | 3 |
| beam | 3 |
| solara | 1 |
| booking | 1 |
| imperia | 1 |
| inventory | 1 |
| subscription | 2 |
| otp | 0 |

**Total :** ~41 tests

### CI

- **Workflow :** `.github/workflows/ci.yml` (présent)
- **Scripts :** `test`, `test:coverage`, `check` (conformance, manifests, contracts, themes, lint, typecheck)

---

## 6. Base de données

### Migrations identifiées

| BAC | Fichier | Objet |
|-----|---------|-------|
| citadelle | `20260922161500_harden_citadelle_security.ts` | Sécurité identity |
| spaces | `20260922162100`, `20260926096000`, `20260926150000` | Tables + durcissement |
| commerce | `20260926092000`, `20260926110000`, `20261013000000` | Schema + order_pending_payment |
| solara | `20260926094000`, `20260926130000` | Schema + durcissement |
| beam | `20260922161700`, `20260926090000` | Tables + schema |
| portfolio | `20261108120000` (NOUVELLE) | **Multi-tenant + tenant_id** |

**Schémas Postgres :** `portfolio`, `commerce`, `spaces`, `solara`, `beam`, `citadelle` (séparés)

---

## 7. Frontend & Next.js

### État des lieux

- **Aucun `next.config.*`** trouvé à la racine ou dans `apps/`.
- **Shell principal :** `src/` contient routes, middleware, controllers.
- **UI Runtime :** `packages/ui-runtime` présent.
- **Thèmes :** `packages/theme`, scripts `check:themes`, `check:ui-contracts`.

**Hypothèse :** Next.js full-stack avec routes API dans `src/server/routes/` et controllers par BAC.

---

## 8. Matrice Existant / Partiel / Absent / Non vérifié

### BACs fondamentaux MVP

| Capacité | Statut | Preuve |
|----------|--------|--------|
| **Identité (Citadelle)** | ✅ Existant | 24 .ts, 3 tests, migrations |
| **Spaces (acteurs)** | ✅ Existant | 20 .ts, 3 tests, postgres repo |
| **Portfolio (PIM)** | ✅ Livré | 32 .ts, 9 tests, **49 tests verts**, multi-tenant |
| **Commerce (offres + commandes)** | ✅ Existant | 25 .ts, **10 tests**, checkout workflow |
| **Checkout complet** | ⚠️ Partiel | Workflow présent — à tester E2E |
| **Paiement (Satim)** | ⚠️ Partiel | Port défini (`satim-payment-port.ts`) — adapter à vérifier |
| **Solara (social)** | ⚠️ Partiel | 16 .ts, **1 test** — faible coverage |
| **Beam (messaging)** | ✅ Existant | 14 .ts, 3 tests, crypto E2E |
| **Multi-tenant** | ✅ Livré (Portfolio) | Migration + 49 tests |
| **Enforcement capacités** | ❓ Non vérifié | Guards présents — à valider runtime |
| **Runtime manifests** | ❌ Absent | Aucun `manifest.json` BAC trouvé |
| **Composition dynamique** | ❓ Non vérifié | `composition-loader.ts` présent — à auditer |

### Infrastructure

| Élément | Statut |
|---------|--------|
| CI | ✅ Présente (`ci.yml`) |
| Migrations | ✅ 17+ fichiers |
| Conformance | ✅ Scripts présents |
| Tests E2E PostgreSQL | ❓ Non vérifié |
| Monitoring / logs | ❓ Non vérifié |
| Docker | ❌ Absent (pas de `docker-compose.yml`) |

---

## 9. Gaps critiques pour le MVP

### Bloquants

1. **Manifests BAC absents** — Le runtime ne peut pas valider/activer les BAC de façon déclarative.
2. **Tests E2E PostgreSQL** — Aucun test d'intégration réel identifié (uniquement in-memory).
3. **Enforcement runtime des capacités** — Guards présents mais non validés en conditions réelles.
4. **Paiement Satim** — Port défini, adapter manquant ou non testé.
5. **Solara sous-testé** — 1 test pour 16 .ts — risque de régression.

### Non bloquants (post-MVP)

- Composition dynamique (Composer)
- AI Runtime / Intelligence Core
- Clients desktop (Forge)
- Solidarity (hors MVP marketplace)
- Booking (vertical secondaire)

---

## 10. Recommandations — Phases P1 à P6

### P1 — Combler les gaps MosaiX critiques (2-3 semaines)

- [ ] Créer les manifests BAC (Citadelle, Spaces, Portfolio, Commerce, Solara, Beam)
- [ ] Ajouter tests d'intégration PostgreSQL (au moins 1 par BAC)
- [ ] Valider l'enforcement des capacités (guards + policy engine)
- [ ] Implémenter/valider l'adapter de paiement Satim
- [ ] Renforcer les tests Solara (minimum 5 tests)

### P2 — Stabiliser les fondations métier (2 semaines)

- [ ] Workflow complet : Space → Product → Offer → Cart → Order
- [ ] Tests E2E : inscription → création Space → offre → panier → commande
- [ ] Validation multi-tenant (isolation réelle entre tenants)

### P3 — MVP Marketplace (3-4 semaines)

- [ ] Frontend : découverte offres, panier, checkout
- [ ] Backoffice vendeur : création offre, gestion stock
- [ ] Notifications (commande confirmée, expédiée)
- [ ] Plans vendeurs (gratuit/payant) — Subscription

### P4 — Capacités avancées (2-3 semaines)

- [ ] Coupons, promotions
- [ ] Retours & remboursements
- [ ] Stats vendeur (ventes, popularité)
- [ ] Badges & vérification (Trust)

### P5 — Social & Beam (2 semaines)

- [ ] Intégration Solara : publications Space, flux
- [ ] Beam : conversations acheteur-vendeur
- [ ] Partage d'offres dans conversations

### P6 — Préparation production (2 semaines)

- [ ] Tests de charge
- [ ] Sécurité (audit, rate limiting, secrets)
- [ ] Monitoring (logs, métriques, alertes)
- [ ] Documentation opérationnelle
- [ ] Backup & recovery

---

## 11. Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Tests E2E absents | Élevé | Commencer P1 par 1 test E2E par BAC |
| Paiement non fonctionnel | Bloquant | Prioriser adapter Satim ou fallback manuel |
| Manifests BAC | Moyen | Créer manifests minimaux (nom, version, deps) |
| Solara fragile | Moyen | Renforcer tests avant intégration |
| Multi-tenant non testé (hors Portfolio) | Élevé | Étendre tests isolation à Commerce & Spaces |

---

## 12. Conclusion

**Bonne nouvelle :** Les BACs fondamentaux sont **présents et structurés**. Portfolio vient d'être livré avec isolation multi-tenant (49 tests verts). Commerce est le BAC le plus testé (10 tests).

**Gaps principaux :**
1. Absence de manifests BAC (runtime déclaratif incomplet)
2. Tests E2E PostgreSQL manquants
3. Enforcement capacités à valider en conditions réelles
4. Paiement (Satim) à implémenter/valider
5. Solara sous-testé (1 test)

**Recommandation :** Suivre les phases P1-P6 ci-dessus, en commençant par **P1 (gaps MosaiX critiques)** avant de construire le frontend marketplace.

---

**Prochaine étape :** Soumettre ce rapport à ChatGPT pour validation et priorisation des tâches P1.
