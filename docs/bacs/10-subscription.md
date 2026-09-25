# BAC Subscription — Abonnements, Metering & Comptabilité

## 1. Vue d'ensemble
Le BAC **Subscription** (`@apps/subscription`) gère la facturation récurrente, les forfaits d'abonnement, le comptage à l'usage (*metering* via Redis Sorted Sets), la reconnaissance des revenus (norme ASC 606) et la gestion des impayés (*dunning schedule*).

## 2. Architecture & Services
- **`SubscriptionService`** : Gestion des plans, souscriptions actives, prorata et facturation.
- **`MeteringService`** : Suivi des consommations métriques en temps réel.

## 3. Modèle de Données & Tables SQL
- `subscription_plans` : `(id, name, price_in_cents, currency, billing_interval, features JSONB, created_at)`
- `subscription_accounts` : `(id, tenant_id, plan_id FK, status, current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ, created_at)`
- `subscription_metered_usage` : `(id, account_id FK, metric_key, quantity, timestamp TIMESTAMPTZ)`

## 4. Capacités & API Endpoints
- `subscription.plan.list` — Catalogue des plans d'abonnement.
- `POST /subscription/subscribe` — Souscription à un forfait.
- `POST /subscription/meter` — Enregistrement d'une unité d'utilisation métrique.

## 5. Contributions UI & Slots
- Tableau de bord de facturation, choix des forfaits et suivi de consommation.
