# Session 2026-10-09 — Tools MCP commerce + seeding vitrine via gateway

## Objectif
Créer des offres pour des Spaces dans `commerce` en base, en passant par le MCP (pas d'écritures directes), avec les tools nécessaires.

## Nouveaux tools (`packages/mcp/src/providers/commerce.ts`)
- `commerce_offer_list` (read) : vitrine globale, par vendeur ou par vendable, limite bornée.
- `commerce_offer_create` (publish) : validation shape stricte (seller/vendable/title requis, cents entiers positifs, devise ISO — DZD par défaut, commission 0..10000, `ACTIVE|DRAFT` uniquement à la création), délégation à `CommerceOfferService.createOffer` (invariants BAC).
- Ressource `commerce://offers` + prompt `commerce_offer_publish_brief`.
- Permissions `commerce:offer:publish:tenant` / `commerce:offer:read:tenant` ajoutées aux deux manifestes (mosaix.json + MANIFEST index.ts) + couvre MCP-02 (alignment test étendu — zéro permission fantôme).
- Wiring stdio (in-memory honnête) + HTTP (Postgres quand dispo, pattern spaces). Export `PostgresCommerceOfferRepository` depuis l'index commerce.

## Seeding (`scripts/seed-commerce-offers.ts`, via `tools/call` réel)
Chaîne complète par la gateway (validation MCP-04 + RBAC MCP-03 avec principal `mcp:admin` de seeding + rate-limit), idempotente (dedup slugs, références, paires vendeur/vendable) :
- `spaces_space_bulk_import` → 3 Spaces (TechStore Jijel, Artisanat Kabyle, Librairie Numidia, tenant jijel-dz).
- `portfolio_vendable_propose` → 3 fiches Draft FR.
- `commerce_offer_create` → 3 offres ACTIVE en DZD (Xiaomi 289000 DZD, poterie 6500 DZD, livre 1800 DZD).
- Vérification : relecture `listActiveOffers` (titres jointés depuis `portfolio.translations` OK).

## Validation
- 37/37 MCP + 33/33 commerce, ESLint propre.
- Vitrine `/commerce` : à vérifier visuellement après restart (dev server tourne sur l'autre checkout).

## Git State
- Nouveaux : `providers/commerce.ts`, `commerce-tools.test.ts`, `scripts/seed-commerce-offers.ts`, ce rapport.
- Modifiés : index MCP, stdio-server, mcp-routes, index commerce (+repo export, permissions/capabilities `commerce.offer.*`), mosaix.json commerce, permission-alignment.test.
- Rollback : revert + `DELETE FROM commerce.offers WHERE "sellerId" IN (…)` si besoin (lignes seedées identifiables par `seed-marketplace` owner… via spaces) — ou re-run (idempotent, 0 créé).
