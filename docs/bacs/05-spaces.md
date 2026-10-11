# BAC Spaces — Espaces Organisationnels & Domaines

## 1. Vue d'ensemble
Le BAC **Spaces** (`@apps/spaces`) gère la création et la configuration des espaces de travail cloisonnés (organisations, boutiques, équipes), les rôles des membres au sein d'un espace (`SpaceRolePolicyEngine`), et la liaison des domaines personnalisés avec SSL / HSTS.

## 2. Architecture & Services
- **`SpacesService`** : Cycle de vie des spaces, équipes et rôles locaux (`SpaceRolePolicyEngine`), demandes d'adhésion, capabilities activées, contexte acting-as-space + audit, business-registry (vérification d'entité uniquement). Les abonnements sont gérés par Subscription (le Space n'est que souscripteur/bénéficiaire par référence), les offres par Commerce, les réservations par Booking.

## 3. Modèle de Données & Tables SQL (schéma isolé `spaces.*` depuis v1.002 ; `spaces.spaces`, tables IAM conservées)
- `spaces` : `(id, name, slug UNIQUE, owner_id, metadata JSONB, custom_domain, status, created_at)`
- `space_members` : `(space_id FK, user_id FK, role, permissions JSONB, created_at)`

## 4. Capacités & API Endpoints
- `spaces.space.create` — Création d'un nouvel espace organisationnel.
- `GET /spaces/:spaceId` — Récupération des détails et des membres d'un space.
- `POST /spaces/:spaceId/members` — Ajout d'un membre avec attribution de rôle (`owner`, `admin`, `editor`, `moderator`).

## 5. Contributions UI & Slots
- Sélecteur d'espace actif dans la barre latérale et paramètres de l'espace.

## 6. Décisions de modélisation vérifiées (v1.003, base live)
- **Syntaxe/ordre valides** : les remarques d'exécutabilité portaient sur un export, pas sur nos migrations compilées.
- **Overrides NULL-safe** : l'UNIQUE classique est aveugle aux NULL — remplacée par 2 uniques partielles (scope global / scope espace) ; `effect` en CHECK (`ALLOW|DENY`), résolution des conflits (refus explicite gagne) dans la couche d'autorisation.
- **Rôles** : cohérence scope (`GLOBAL` sans `scopeId`, `SPACE` avec), auto-référence `inheritsFrom`, unicité clé-par-portée ; `rank` = plus haut = plus puissant (convention documentée, cycles indirects = validation applicative future).
- **Spaces** : `slug` unique global (URLs plateforme), `customDomain` unique NULL-admis, `followersCount >= 0` ; `tenantId`/`ownerId` sans FK (références par ID, règle de frontière) ; règle auto-adhésion du owner = question ouverte (aucun code).
- **Audit immuable** : triggers append-only sur les 2 tables d'audit (zéro writer UPDATE/DELETE vérifié) ; nettoyage = `DISABLE TRIGGER` tracé uniquement.
- **Non fait sciemment** : tables IAM sans writers (déclaratif en avance sur le code), évaluation des permissions centralisée à brancher (DENY gagne, inconnu refusé).
