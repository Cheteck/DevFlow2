# MosaiX Portfolio Bounded Application Context (`@apps/portfolio`)

The `@apps/portfolio` application serves as the core reference domain for decoupled 'vendables' (products, services, digital goods, and experiences) in MosaiX.

## Responsibilities
- CRUD operations for Vendables (PIM-only metadata: identity, translations, EAV features, relations, media).
- Completeness and information quality scoring.
- Saga Workflow transitions (`Draft` -> `In Review` -> `Validated` -> `Published` -> `Archived`).
- Semantic relations and descriptive variants.
- Multi-lingual localization support (fr, en, ar).
- Bulk CSV and JSON import and export for PIM metadata.
- **Strictly decoupled from commercial and operational properties (zero price, stock, or inventory management — owned exclusively by `@apps/commerce` offers).**

## Architecture
- **Domain:** Pure domain interfaces, invariants, and `PortfolioService` in `src/domain/`.
- **Infrastructure:** Repositories and ORM models in `src/infrastructure/`.
- **Composition Root:** Wiring in `src/composition-root.ts` re-exported in `src/index.ts`.
