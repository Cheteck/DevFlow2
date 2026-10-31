# Session 2026-10-10 — Import GSMArena via MCP + persistance PG

## Objectif
Ajouter le Xiaomi 18 Pro Max 5G (GSMArena) dans Portfolio **via MCP**, specs + variantes, dans le respect du schéma PIM.

## Travaux réalisés
1. **Câblage persistant MCP→PG** (sinon l'import mourait au restart) :
   - `apps/portfolio/src/index.ts` : export `PostgresVendableRepository`.
   - `packages/mcp/src/providers/portfolio.ts` : `PortfolioModuleLike.PostgresVendableRepository?`.
   - `src/server/routes/mcp-routes.ts` : `wirePortfolioClient(db?)` (PG si dialect postgres, InMemory sinon + warn), `getGateway(db?)` avec reconstruction si bascule, `handleMcpRoutes(..., db?)`.
   - `src/server/api-dispatcher.ts` : `ctx.db` transmis.
2. **DB locale** : `pnpm mosaix migrate` (solidarity v1.003 pending → boot débloqué).
3. **Import réel via HTTP MCP** (`POST /api/mcp`, Bearer dev) :
   - `portfolio_vendable_propose` → Draft `vend_e13f0d79…` / `XIAOMI-18-PRO-MAX-5G`.
   - Vérifié : `search` (count 1), `read` OK, négatif `price` rejeté (`OperationalKeyForbiddenError`).
   - Preuve PG directe : 1 media, 4 variantes (SKUs), 23 attributs, 15 groupes specs, complétude **90** (manque `translation_en/ar` uniquement).

## Décisions
- Prix « ~920 EUR » exclu de la fiche (offre Commerce ultérieure) — frontière PIM.
- Description FR réécrite (pas de copie GSMArena, ToS) ; image fdn2 en hotlink Draft à ré-héberger avant publication.
- 4 variantes mémoire/RAM ; coloris en attributs (pas d'explosion combinatoire).

## Validation
- `pnpm build:raw` vert (×2). ESLint propre. Tests MCP 15/15. Fichiers temporaires supprimés.

## Risques / suivis
- Traductions EN/AR manquantes (−10 complétude) ; media à ré-héberger ; workflow Draft→In Review→… à avancer ; offre Commerce à créer pour le prix.
- Prochains imports GSMArena : même outil, même payload type (référence unique `X-...`).

## Git State
- Branche : `backlog-tasks-completion-16894022842581055701`. Modifs non commitées (feature MCP propose des sessions précédentes + câblage PG + import).
- Rollback import : `DELETE FROM "portfolio"."vendables" WHERE reference='XIAOMI-18-PRO-MAX-5G'`.

## Suite ADR-0018 — bascule normalisée (même session)
- Tables dédiées = source de vérité ; 7 colonnes JSON droppées (v1.005 +
  correctif v1.006) ; `PostgresVendableRepository` réécrit (contrat document
  inchangé) ; `quality` calculée à la lecture ; `PostgresPoolManager` +
  transactions réelles (`checkout()` dédié — corrige `too many clients` et
  l'atomicité illusoire) ; round-trip Xiaomi prouvé identique ; `build:raw`
  vert ; suite 848 passés (restent 3 échecs CLI pré-existants + HTTP aligné
  sur le 503 honnête).

## Analyse in-memory repo-wide (sans implémentation — décision utilisateur)
- Inventaire : 21 classes `InMemory*` en 4 natures (doublures de test à
  garder, volatil by-design, fallbacks gardés, 3 chemins vivants non gardés
  dont SSR-auth aveugle aux sessions PG).
- Décisions actées : périmètre = analyse seulement pour l'instant ; fakes de
  test conservés ; à l'exécution future : exiger une DB partout (fail-fast,
  modèle Redis `{mock:true}`), règle lint `no-in-memory-in-src`.

## Couche 1 appliquée (GO utilisateur, tout le repo)
- Fail-fast : composition roots portfolio/commerce/citadelle (stores avec
  alternatives persistantes) ; legacy `createCommerceComposition` exige un
  repo ; tests passent des adapters explicites.
- Nouveau package `@mosaix/adapter-session-store-postgres` (déplacé depuis
  `packages/auth`, qui déclare ne pas connaître Postgres) : Citadelle sur PG
  n'a plus de fallback session.
- Classe morte supprimée : `InMemoryPortfolioSearchAdapter` (zéro usage).
- Règle eslint `no-restricted-syntax` anti-`new InMemory*` (tests/bench
  exemptés, exemptions inline justifiées : user/social/secrets/wizard
  Citadelle, platform-settings, observabilité, theme, MCP stdio/HTTP-repli,
  bootstrap sessions, mock Redis).
- Preuves : `build:raw` vert, `pnpm lint` vert (0 erreur), 834 tests verts
  (restent les 3 CLI pré-existants ; HTTP 14/14 quand Docker répond).

## Import massif GSMArena (50 URLs) — PAUSE rate-limit (2026-10-10)
- 34/50 fiches en base (toutes Draft, tables normalisées) via
  `scripts/import-gsmarena.ts` (idempotent, ~20 pages/min + jitter,
  Retry-After honoré, stop sur 403 / 429x3, skip-sans-fetch des doublons).
- Mur 429 après ~33 pages malgré 3s d'intervalle ; 2e tentative à 8-10s
  toujours en 429 persistant → arrêt demandé, ne pas marteler (cooldown
  côté GSMArena).
- 16 URLs restantes à reprendre plus tard (délai suggéré 30s+, ou autre
  session) : black_shark_pad_se-14777, poco_c81_pro-14635, poco_c81-14626,
  poco_c81x-14627, redmi_k90_max_5g-14618, redmi_k_pad_2-14625,
  redmi_pad_2_9_7-14636, redmi_a7_pro_5g-14616, redmi_a7-14623,
  poco_m8s_5g-14615, redmi_r70m_5g-14600, redmi_r70_5g-14598,
  redmi_note_15_special_edition_5g-14571, redmi_a7_pro-14463,
  redmi_15a_5g-14565, poco_x8_pro_max_5g-14507
  (préfixe https://www.gsmarena.com/ + suffixe .php).

## Gestion des options produit (ADR-0019, même session)
- Domaine `product-options.ts` : groupes typés + normalisation + validation
  (codes, doublons, clés commerciales, références) + `validateConfiguration`
  (requis + incompatibilités) + conversion bloc aller/retour.
- `PortfolioService.setProductOptions` (Draft/In Review/Validated, remplacement
  du bloc, invariants + complétude via `updateVendable`).
- Persistance : tout groupe d'options obtient un `variation_groups`
  (`purpose='variation'` axes SKU, `'option'` sinon) ; normalisation
  centralisée côté domaine (doublons casse/accents unifiés).
- Outil MCP `portfolio_vendable_options_set` (id ou référence).
- Preuves : 62 tests ciblés verts, `build:raw` vert, `pnpm lint` vert, exercice
  live sur la fiche Xiaomi (groupes color/storage_ram/weight vérifiés en base).
  Suivi v1 : liaison variante↔valeur, media par valeur, offres Commerce.

## Parcours vendeur + ADR-0020 (même session, validation avec réserves)
- Vision validée : vendeur ignore le mot proposal, modération gate unique,
  approbation = vendable + offre ; D1–D5 validés (formulaire Space, commercialTerms,
  port, Space vendeur, offre ACTIVE).
- Réserve D3 verrouillée en ADR-0020 : saga idempotente séquentielle (JAMAIS de
  `transaction()` imbriquée — piège vérifié), UNIQUE partiel proposalId,
  approvedTerms snapshot + auditTrail, fail explicite sans port, events par
  contrats (`vendable.published` sans commercial, nouveau `commerce.offer.activated`).
- Backlog : SELL-FLOW-01 (P1, critères précis) + SELL-FLOW-02 (P2) + PORT-UI-04
  recâblé. Registre : 8 P0 · 12 P1 · 18 P2.
