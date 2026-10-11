# Responsabilités — adapter session-store-postgres

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/adapter-session-store-postgres` |
| Version | `0.1.0` |
| Couche | Adapter concret (Layer 3) |

## Raison d'être

Implémenter `ports-session-store` : Sessions sur PostgreSQL.

## Responsabilités

- Implémenter fidèlement l'interface du port, sans l'étendre.
- Gérer le cycle de vie de la connexion/client sous-jacent.
- Mapper les erreurs natives vers les erreurs du port.
- Fournir des tests (`index.test.ts`) avec doubles ou conteneurs.

## Interactions

Dépend de `ports-session-store` (+ SDK externe). Sélectionné via composition
(`config/compositions/`, DatabaseModule/resolver), sans fallback in-memory :
exiger un `DatabasePort` (fail-fast).

## Frontières

- N'importe jamais un autre adapter ni une app.
- Ne contient aucune logique métier.

## Non-responsabilités

- Ne définit pas de contrat (voir ports).
- Ne choisit pas pour qui il est monté (voir compositions).

## Critères de santé

- [ ] Tests verts avec et sans service externe (skip documenté).
- [ ] Pas de secret en dur ; config injectée.
