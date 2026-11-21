# @mosaix/adapter-event-store-database

## Rôle

Implémentation de `EventStorePort` (`@mosaix/ports-event-store`) utilisant `DatabasePort` (`@mosaix/ports-database`).

- **Ce qu'il fait** : append/readStream d'événements dans une table `event_store` (SQL portable PostgreSQL/SQLite). Gère la concurrence optimiste via `expectedVersion`.
- **Ce qu'il ne fait pas** : ne gère pas la migration (côté app propriétaire), ne fait pas de projection, ne fait pas de snapshot.

## API publique

```ts
export class EventStoreDatabaseAdapter implements EventStorePort {
  constructor(db: DatabasePort)
  append(aggregateType, aggregateId, events, expectedVersion?)
  readStream(aggregateType, aggregateId)
}
```

## Dépendances

- `@mosaix/ports-database` (interface `DatabasePort`)
- `@mosaix/ports-event-store` (interface `EventStorePort`, type `StoreEvent`)

## Schéma DB requis

La migration correspondante doit être créée dans l'app propriétaire (ex: `apps/.../migrations/.../create_event_store.ts`) avec checksum vérifié par `migration-checksums --check`.

```sql
CREATE TABLE event_store (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  payload TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT
);
CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_type, aggregate_id);
CREATE INDEX idx_event_store_type ON event_store(type);
```

## Tests

Exécutés sur `node:sqlite` (`DatabaseSync`) en mémoire — même modèle que `@mosaix/adapter-otp-database`.

- 7 tests : append/read, séquences incrémentales, expectedVersion (concurrence), aggregate inconnu, metadata round-trip, métadonnées manquantes, persistance cross-instances (simule redémarrage).