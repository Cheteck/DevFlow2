# Responsabilites — adapter email-ses

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/adapter-email-ses` |
| Version | `1.0.0` |
| Couche | Adapter concret (Layer 3) |

## Raison d'etre

Implementer `ports-email` : Envoi via AWS SES.

## Responsabilites

- Implementer fidelement l'interface du port, sans l'etendre.
- Gerer le cycle de vie de la connexion/client sous-jacent.
- Mapper les erreurs natives vers les erreurs du port.
- Fournir des tests (`index.test.ts`) avec doubles ou conteneurs.

## Interactions

Depends de `ports-email` (+ SDK externe). Selectionne via composition (`config/compositions/`, DatabaseModule/resolver) avec fallback in-memory conditionnel.

## Frontieres

- N'importe jamais un autre adapter ni une app.
- Ne contient aucune logique metier.

## Non-responsabilites

- Ne definit pas de contrat (voir ports).
- Ne choisit pas pour qui il est monte (voir compositions).

## Criteres de sante

- [ ] Tests verts avec et sans service externe (skip documente).
- [ ] Pas de secret en dur ; config injectee.
