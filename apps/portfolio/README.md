# MosaiX Portfolio Bounded Application Context (`@apps/portfolio`)

The `@apps/portfolio` application serves as the core reference domain for decoupled 'vendables' (products, services, digital goods, and experiences) in MosaiX.

## Responsibilities
- CRUD operations for Vendables.
- Completeness and information quality scoring.
- Saga Workflow transitions (`Draft` -> `In Review` -> `Validated` -> `Published` -> `Archived`).
- Semantic relations and variants.
- Multi-lingual localization support (fr, en, ar).
- CSV import and export.
- Strictly decoupled from commercial/operational properties (such as price or stock).

## Architecture
- **Domain:** Pure domain interfaces, invariants, and `PortfolioService` in `src/domain/`.
- **Infrastructure:** Repositories and ORM models in `src/infrastructure/`.
- **Composition Root:** Wiring in `src/composition-root.ts` re-exported in `src/index.ts`.
