# Session 2026-10-08 — Backlog MCP section 15 (MCP-01..05 + INT-MCP-01) exécuté

## Objectif
Exécuter les tâches backlog MCP ↔ Portfolio + migration vers Intelligence.

## Travaux réalisés
- **MCP-01** : `packages/mcp/src/providers/portfolio.ts` — `portfolio_vendable_search/read` déterministes via `PortfolioBACClient` injecté (aucun import statique `packages→apps`) ; stub supprimé de `app.ts` ; stdio-server câble via import dynamique avec repli honnête (outils absents si BAC non résolvable) ; 3 tests.
- **MCP-02** : 8 permissions alignées sur les MANIFESTs (`imperia:governance:inspect`, `commerce:order:{create,read}`, `booking:slot:create`, `beam:message:send`, `spaces:space:read`, `citadelle:user:read:tenant`) + NOTEs où la capability BAC manque ; test anti-fantôme (`permission-alignment.test.ts`, allowlist manifests + scopes plateforme).
- **MCP-03** : anonyme deny-by-default (`mcp:read` seul, fini `mcp:admin`) ; `MCPPrincipalResolver` branché dans la gateway (`context.authHeader`) ; tests `-32001` anonyme + principal explicite + Bearer ; reste : vérification crypto via AuthManager.
- **MCP-04** : `security/input-validator.ts` (sous-ensemble JSON-Schema) appelé dans `tools/call` avant RBAC (`-32602`) ; test.
- **MCP-05** : resource `portfolio://vendables` (permission alignée, refus anonyme testé) + prompt `portfolio_listing_quality_brief` ; câblés dans stdio-server.
- **INT-MCP-01 suite** : 2 outils jugement (`spaces_content_moderate`, `commerce_product_classify`) ; seam `ReviewStore` (`configureStore`/`rehydrate`, persistance non bloquante) ; calibration `MockDecisionProvider.setConfidenceFor/resetCalibration` ; tests (6 intelligence, 5 bridge).
- Alias vitest ajoutés → `e2e-critical-flows.test.ts` pré-existant réparé.

## Validation effectuée
- `pnpm vitest run` : MCP (bridge 5, mcp 6, portfolio-tools 6, alignment 1) + intelligence (6) + core (4) + portfolio/inventory/backlog/e2e — **tout vert**.
- `pnpm eslint packages/mcp/src packages/intelligence/src` : propre.
- `tsc --build` : inchangé (échecs TS2835 pré-existants de `packages/*`, aucun dans le périmètre).

## Risques détectés
- Handlers stub restants hors portfolio (commerce/booking/beam/spaces/identity) : permissions alignées mais données toujours factices — prochaine vague MCP-01 par BAC ou suppression.
- `ReviewStore` durable (DatabasePort) non implémenté : file de revue toujours volatile en prod.
- Bearer simulé : tout token est admin — ne pas exposer le MCP en prod avant vérification réelle.
- stdio-server ne peut pas résoudre `@apps/portfolio` sans `pnpm install` (liens workspace absents) : outils portfolio absents au runtime local, présents après install.

## Git State
- Branche : `backlog-tasks-completion-16894022842581055701`.
- Fichiers ajoutés : `providers/portfolio.ts`, `providers/intelligence.ts`, `security/input-validator.ts`, 3 fichiers de test MCP, `permission-alignment.test.ts`.
- Fichiers modifiés : `app.ts`, `stdio-server.ts`, `index.ts`, `gateway.ts`, `principal-resolver` (non, inchangé), `mcp.test.ts`, `vitest.config.ts`, `mcp/package.json`+`tsconfig.json`, `intelligence/src/index.ts`+`index.test.ts`, backlog section 15.
- Aucun commit effectué (pas demandé).
