# BAC Subscription — Abonnements récurrents, Metering & Entitlements

## 1. Vue d'ensemble
Le BAC **Subscription** (`@apps/subscription`) est le bounded context des engagements récurrents : plans, souscriptions, périodes/renouvellements, prorata, metering et entitlements. Il **calcule les montants dus mais ne facture pas et n'encaisse pas** : Billing produit les documents financiers, Payments encaisse (cf. `apps/subscription/responsibilities.md`). MRR/ARR sont des projections analytics, pas un état transactionnel ; les coupons génériques appartiennent à Commerce.

## 2. Architecture & Services
- **`SubscriptionService`** : Gestion des plans, souscriptions actives, prorata et calcul des montants dus (inputs pour Billing).
- **`MeteringService`** : Suivi des consommations métriques en temps réel (idempotent).

## 3. Modèle de Données & Tables SQL (schéma isolé `subscription.*` depuis v1.002 ; `coupons`/`invoices`/`metering_buckets` transitoires, FK intactes vers `public.user_subscriptions`)
- `subscription_plans` : `(id, name, price_in_cents, currency, billing_interval, features JSONB, created_at)`
- `subscription_accounts` : `(id, tenant_id, plan_id FK, status, current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ, created_at)`
- `subscription_metered_usage` : `(id, account_id FK, metric_key, quantity, timestamp TIMESTAMPTZ)`

## 4. Capacités & API Endpoints
- `subscription.plan.list` — Catalogue des plans d'abonnement.
- `POST /subscription/subscribe` — Souscription à un forfait.
- `POST /subscription/meter` — Enregistrement d'une unité d'utilisation métrique.

## 5. Contributions UI & Slots
- Choix des forfaits, gestion de la souscription (plan, cycle, suspension) et suivi de consommation. Les décisions contractuelles (`past_due`, suspension) sont affichées ; les relances/notifications sont émises par Notifications, les factures par Billing.

## 6. Décisions de modélisation vérifiées (v1.003, base live)
- **PK présentes partout** (contrairement à la critique) ; syntaxe/ordre valides.
- **Coupons** : cohérence pourcent/montant/compteurs en CHECK (`maxRedemptions` NOT NULL DEFAULT 100 : 0 = aucune utilisation autorisée, plafond haut ≈ illimité) ; pas de table d'usage (aucun chemin de reversement n'écrit `redemptionsCount` — viendra avec le flux redeem).
- **Factures** : montants `>= 0`, devise ISO, FK subscription en `RESTRICT` (l'historique comptable survit à la suppression d'abonnement — archiver, pas supprimer) ; `id` uuid = numéro stable (pas de colonne numéro séparée).
- **Metering** : `UNIQUE(subscriptionId,metric,bucketTimestamp)` anti-double-compte + `units >= 0` ; agrégation par upsert, journal brut différé si besoin futur.
- **Non fait sciemment** : scoping multi-tenant (même décision que les autres BAC), ledger d'usage coupons, numérotation comptable externe.
