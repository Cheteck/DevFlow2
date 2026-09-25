# BAC Imperia — Gouvernance, Contrôle & Supervision

## 1. Vue d'ensemble
Le BAC **Imperia** (`@apps/imperia`) est le centre de gouvernance, de supervision du Control Plane, de gestion des Dead Letter Queues (DLQ), des circuit breakers, de la gestion des plugins (style PrestaShop) et du moteur de migration de schémas de base de données.

## 2. Architecture & Services
- **`ImperiaGovernanceService`** : Supervision de la topologie du cluster MosaiX, calcul des scores de conformité des BACs.
- **`ControlPlaneSupervisor`** : Gestion des files DLQ et ré-envoi (`replay`), surveillance des disjoncteurs (`circuit breakers`).
- **`PluginManager`** : Installation, activation, désactivation et mise à jour dynamique des plugins.

## 3. Modèle de Données & Tables SQL
- `imperia_audit_logs` : `(id, tenant_id, action, actor, details JSONB, created_at)`
- `imperia_dlq` : `(id, event_type, payload JSONB, error_reason, attempts, status, created_at)`
- `imperia_circuit_breakers` : `(id, service_name, state, failure_count, updated_at)`
- `imperia_plugins` : `(id, name, version, status, config JSONB, installed_at)`

## 4. Capacités & API Endpoints
- `imperia.governance.topology` — Inspection de la topologie et de la santé des 10 BACs.
- `GET /imperia/dlq` — Consultation des messages en erreur (DLQ).
- `POST /imperia/dlq/replay` — Rejeu d'un événement DLQ.
- `GET /imperia/migrations/status` — Suivi des migrations SQL de la plateforme.

## 5. Contributions UI & Slots
- Console d'administration système, widgets de métriques et gestionnaire de plugins.
