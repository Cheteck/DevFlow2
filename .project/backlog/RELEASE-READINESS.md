# MosaiX / IJIDeals — RELEASE-READINESS (conditions de mise en production)

- **Dernière mise à jour :** 2026-10-09 · Source : `BACKLOG.md` (P0) + ADR-0012/0014/0016/0017.
- **Règle :** tant qu'une ligne P0 est rouge, pas d'exposition publique (auth publique et MCP privilégié désactivés). Preuve exigée = test/commit/log, pas affirmation.

## P0 — Authentification réelle
- [ ] Session valide survit au restart PG ; révoquée rejetée après restart (AUTH-E2E).
- [ ] Aucun secret mémoire en démo-off/prod (guard `InMemorySecretsAdapter`).
- [ ] `POST /api/auth/login|logout` + `GET /api/auth/session` e2e vert (cookie `__Host-`, CSRF, rate-limit, logout idempotent).
- [ ] `mosaix_role` forgé = zéro droit ; aucun endpoint login public avant AUTH-06.

## P0 — Sécurité MCP
- [ ] Anonyme deny-by-default (`-32001`), sans `mcp:admin` (MCP-03c).
- [ ] Bearer vérifié cryptographiquement via `AuthManager` (fini la simulation `principal-resolver.ts:27`).
- [ ] Inputs validés contre `inputSchema` (`-32602`), 0 permission fantôme (grep MANIFESTs).
- [ ] Pas d'agent IA en prod via MCP avant ces trois cases.

## P0 — Persistance PostgreSQL + intégrité transactionnelle
- [ ] `db:setup` vert sur PG locale (migrate + seed, placeholders `$n`).
- [ ] Écritures critiques transactionnelles : `placeBid` `SELECT FOR UPDATE`, enchères restart sans perte, doubles sérialisés (AUCTION-PERSIST).
- [ ] Compteurs/invariants sous concurrence : `reservedCount`/`likeCount`/`followersCount` (triggers ou `SELECT FOR UPDATE` + `CHECK`, job purge `holdExpiresAt`) — DATA-07c.
- [ ] FK orphelins audités (`PRAGMA foreign_key_check` / PG équivalent vide après `DB-FK-HARDEN`).

## P0 — Frontières métier et paiements
- [ ] `portfolio_variants` sans `price/stock` (garde `FORBIDDEN_OPERATIONAL_KEYS` verte, `check:conformance` PIM sain).
- [ ] `refund` + webhooks hors Commerce, checkout (dont COD) vert via `PaymentPort` (BOUND-02).
- [ ] Offres/stocks à propriétaire unique ; aucun rôle métier émis par Citadelle sans ADR (BOUND-07).

## P1 — Validation release (preuve reproductible)
- [ ] E2E `/commerce` (offres→panier→commande), `/portfolio` (grille→fiche→search), `/spaces`, `/citadelle` verts sur config cible.
- [ ] Migrations reproductibles + réversibles (rollback↔migrate prouvé comme `BOUND-01b/c/d`).
- [ ] Observabilité : `/health`, `/metrics`, logs traçables (`decisionId` MCP/intelligence).
- [ ] Config prod : secrets persistants, flags démo-off, seeds CLI-only, CORS/rate-limit durcis.

## Gate de sortie
Checklist signée + commits/CI joints dans `.project/reports/session-YYYY-MM-DD.md`. Toute exception = ADR + tâche P0/P1 datée, jamais un contournement silencieux.
