# Session 2026-10-12 — Auction PG wiring (fin du warning InMemory)

## Problème
Au boot : `InMemory fallback adapter "InMemoryAuctionRepository" is active — auction data will be volatile`.
Cause vérifiée : le singleton `auctionService` construisait l'InMemory à l'import, et rien ne lui injectait le repo PG existant (`PostgresAuctionRepository`, `SELECT FOR UPDATE`, déjà testé).

## Changements
- `auction.service.ts` : défaut paresseux (`store()` crée l'InMemory au premier usage, plus à la construction). Sémantique gardée : le guard `InMemoryGuard` se déclenche toujours si le path est réellement utilisé sans PG (et lève en prod/démo-off). Disable eslint documenté (convention du repo).
- `composition-root.ts` : `createCommerceWiredDescriptor(db)` injecte `PostgresAuctionRepository(db)` dans le singleton partagé avant toute opération → le fallback ne se déclenche plus au boot, données persistées.
- `auction-wiring.test.ts` (nouveau, 3 tests) : construction silencieuse, `setRepository` avant usage, wiring composition-root → requêtes PG (`"commerce"."auctions"` observé, zéro warning).

## Validation
- 17/17 (wiring + repo PG + vue commerce), 47/47 suite commerce, ESLint propre.
- Pré-existant, non régression (prouvé par stash) : `tests/backlog-features-2026-09-24.test.ts` FEAT-04 échoue déjà sur HEAD — le test appelle `createAuction`/`placeBid` sans `await` depuis le passage async (AUCTION-PERSIST). Doublon legacy de `postgres-auction-repository.test.ts` qui couvre correctement. À archiver ou réécrire, hors périmètre.

## Git State
- Modifiés : `auction.service.ts`, `composition-root.ts`. Nouveau : `auction-wiring.test.ts`.
- Rollback : `git checkout -- <2 fichiers>` + supprimer le test.
- Note : le boot `33 pending` vu en parallèle = base dev non migrée → `pnpm mosaix migrate` (indépendant de ce fix).
