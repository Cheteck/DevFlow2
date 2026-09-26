# Responsabilites — events

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/events` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Couche applicative d'evenements : dispatcher DX, DomainEventBus, EventStore journal tenant-isole, outbox transactionnelle (worker, daemon, DLQ), publisher messagerie.

## Responsabilites

- Couche applicative d'evenements : dispatcher DX, DomainEventBus, EventStore journal tenant-isole, outbox transactionnelle (worker, daemon, DLQ), publisher messagerie.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

ports event-store/message-bus/pubsub ; consomme par apps, core.

## Frontieres

- Ne choisit pas le broker (voir adapters kafka/rabbitmq/messagebus-mosaix).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
