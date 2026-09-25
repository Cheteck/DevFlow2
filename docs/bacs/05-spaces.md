# BAC Spaces — Espaces Organisationnels & Domaines

## 1. Vue d'ensemble
Le BAC **Spaces** (`@apps/spaces`) gère la création et la configuration des espaces de travail cloisonnés (organisations, boutiques, équipes), les rôles des membres au sein d'un espace (`SpaceRolePolicyEngine`), et la liaison des domaines personnalisés avec SSL / HSTS.

## 2. Architecture & Services
- **`SpacesService`** : Gestion du cycle de vie des spaces, des abonnements aux services et des politiques d'accès.

## 3. Modèle de Données & Tables SQL
- `spaces` : `(id, name, slug UNIQUE, owner_id, metadata JSONB, custom_domain, status, created_at)`
- `space_members` : `(space_id FK, user_id FK, role, permissions JSONB, created_at)`

## 4. Capacités & API Endpoints
- `spaces.space.create` — Création d'un nouvel espace organisationnel.
- `GET /spaces/:spaceId` — Récupération des détails et des membres d'un space.
- `POST /spaces/:spaceId/members` — Ajout d'un membre avec attribution de rôle (`owner`, `admin`, `editor`, `moderator`).

## 5. Contributions UI & Slots
- Sélecteur d'espace actif dans la barre latérale et paramètres de l'espace.
