# BAC Solidarity — Coordination Humanitaire & Logistique

## 1. Vue d'ensemble
Le BAC **Solidarity** (`@apps/solidarity`) gère la coordination de crise, la logistique humanitaire, le suivi des missions de terrain, la gestion des hubs d'approvisionnement et la répartition des allocations.

## 2. Architecture & Services
- **`SolidarityCoordinationService`** : Pilotage des incidents, missions d'intervention, inventaire des ressources et traçabilité Merkle audit trail.

## 3. Modèle de Données & Tables SQL
- `solidarity_incidents` : `(id, title, severity, location JSONB, status, created_at)`
- `solidarity_resources` : `(id, hub_id FK, name, quantity, category, created_at)`
- `solidarity_hubs` : `(id, name, coordinates, contact, created_at)`
- `solidarity_missions` : `(id, incident_id FK, status, assigned_team, created_at)`
- `solidarity_distributions` & `solidarity_allocations` : Suivi des livraisons d'aide.

## 4. Capacités & API Endpoints
- `solidarity.incident.report` — Déclaration d'un incident humanitaire.
- `GET /solidarity/hubs` — Cartographie et inventaire des hubs logistiques.

## 5. Contributions UI & Slots
- Tableaux de bord d'urgence et cartographie des opérations de terrain.
