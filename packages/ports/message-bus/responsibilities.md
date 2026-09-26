# Responsabilites — port message-bus

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/ports-message-bus` |
| Version | `1.0.0` |
| Couche | Port hexagonal (Layer 2) |

## Raison d'etre

Bus de messages in-process/inter-apps (publish/subscribe).

## Responsabilites

- Definir l'interface TypeScript canonique dans `src/index.ts` (+ `query-builder.ts`/`catalog.ts` le cas echeant).
- Documenter les contrats, erreurs et semantiques (idempotence, TTL, pagination).
- Rester sans dependance externe (types TS uniquement).

## Interactions

Importable par fondations (Layer 1), adapters (Layer 3), primitifs (Layer 4) et apps (Layer 7). Implemente par un ou plusieurs adapters (voir PACKAGES.md).

## Frontieres

- Aucune implementation, aucun import d'adapter.
- Aucune dependance workspace hors fondation.

## Non-responsabilites

- Ne choisit pas de technologie.
- N'effectue aucun IO.

## Criteres de sante

- [ ] API stable ; tout changement = version majeure + ADR.
- [ ] Couverture par tests de contrat consommes par chaque adapter.
