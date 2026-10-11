# Session 2026-10-08 — Portfolio PIM purity (lots A–D) + inventory/analytics extraction

## Objectif
Rendre `apps/portfolio/` cohérent avec `apps/portfolio/responsibilities.md` (PIM pur) + structure canonique, selon plan lots A–E validé.

## Travaux réalisés
- **Lot A (modèle)** : `domain/vendable.ts` purgé (`VendablePricing`, `VendableInventory`, `VendableDiscount`, champs `pricing?/inventory?` racine + variantes) ; garde `validateNoOperationalKeys` étendue au top-level + passage en matching par tokens (`stockage` FR descriptif autorisé, `stock` bloqué ; ajout `reorder`) ; nouveau `infrastructure/strip-commercial-fields.ts` (dry-run défaut, archive `portfolio_commercial_archive`, transaction atomique, no-op si table absente) + 4 tests ; `hydrate()` Postgres dépouille les clés commerciales résiduelles des JSON.
- **Lot B (wizard/bulk/search)** : étape 2 wizard → `ProductStep2Variants` descriptives (validation sku/nom, plus de prix/stock) ; bulk `toCsv` sans `price/currency`, `fromCsv/fromJson` ignorent + rapportent les colonnes commerciales, `PortfolioMediaManager` exige options explicites (fini `process.env` + fallback dev) ; search sans `minPrice/maxPrice/priceRanges` (facette `statuses`) ; tests de rejet `OperationalKeyForbiddenError` top-level + variantes.
- **Lot C (extractions)** : nouveau BAC minimal `@apps/inventory` (manifest, provider, `StockSource` port, service quantités-uniquement, fiche, test) ; nouveau package `@mosaix/analytics` (`TrafficAnalyticsService`, fix `new URL` sans try/catch) ; `shop-inventory-report.service.ts` + `shop-analytics.service.ts` supprimés de portfolio (exports retirés) ; vue sans `price/stock` ; tests BAC + backlog transverse mis à jour ; alias vitest `@apps/inventory`, `@mosaix/analytics`.
- **Lot D (canonique)** : `src/application/portfolio-application.ts` (capabilities + 3 schémas d'événements, `registerPortfolioApplication` appelé au boot, publish `created/published`) ; `frontend/src/index.ts` (slots) ; `infrastructure/portfolio-controller.ts` (`Guard.authorize`, mapping 401/403/404/409, préfixe uniforme `/portfolio/...`, `createVendable` via service, uuid, 404 si publish inconnu) ; `composition-root` recâblé dessus ; `createPortfolioDescriptor` (répare `bac-orchestrator.ts:61`) ; tenant résolu du container (fini `default` dur) ; permissions `mosaix.json` alignées `:tenant` + appCard PIM ; `generatePortfolioOpenApi` ; `tsconfig.database.json` orphelin supprimé (migrations sous `src/infrastructure`).
- Docs vivantes : `active-backlog.md` (FEAT-06, BOUND-01), dashboard/roadmap/PRD-0010/PRD-0011 déjà alignés en session précédente.

## Validation effectuée
- `pnpm vitest run` (5 fichiers) : **30/30 verts** (portfolio 9, proposal 2, strip 4, inventory 3, backlog 12).
- `pnpm eslint` sur tout le périmètre : propre.
- `tsc --build` : **0 erreur** dans `apps/portfolio`, `apps/inventory`, `packages/analytics` ; échec restant dû aux TS2835 pré-existants de `packages/*` (contracts, migrations, orm…) non touchés.
- Reste (Lot E, hors session) : brancher/supprimer les 13 tables relationnelles mortes, pagination SQL, `approve()` transactionnel, ids uuid partout, E2E proposition→publication.

## Risques détectés
- A3 destructif : backup via table archive + dry-run défaut ; exécution prod à planifier avec rollback.
- `@apps/inventory` minimal (pas de persistance propre, service en mémoire) ; `sku` conservé comme identité descriptive (tout besoin tarifaire → ADR).
- `e2e-critical-flows.test.ts` échoue à l'import (`@mosaix/intelligence` non lié dans `node_modules`) — pré-existant, hors périmètre.

## Git State
- Branche : `backlog-tasks-completion-16894022842581055701` (behind 1 du remote au début de session).
- Fichiers ajoutés : `apps/inventory/*`, `packages/analytics/*`, `strip-commercial-fields(.test).ts`, `src/application/*`, `frontend/src/index.ts`, `portfolio-controller.ts`.
- Fichiers supprimés : `shop-inventory-report.service.ts`, `shop-analytics.service.ts`, `tsconfig.database.json`.
- Aucun commit effectué (pas demandé).
