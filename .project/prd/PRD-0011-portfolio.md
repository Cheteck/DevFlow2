# PRD-0011 — Portfolio (Catalogue Vendable) — BAC complet

**Statut** : Proposition — v1.0 (2026-09-24) — remplace la vision partielle `PRD-0010` (proposals seul)
**Priorité** : Haute (dépendance `DATA-01`/`DATA-09` CS-Cart Features, `ROLE P1` authz, `THEME`)
**Couche** : Bounded Context `portfolio` **autonome** — décrit *ce qui est vendable*, pas *comment c'est vendu*. Commerce consomme `Published`, jamais l'inverse.
**Package principal** : `@apps/portfolio` (`Vendable` `vendable.ts:112` + `PortfolioService` `portfolio-service.ts:58` + `VendableWorkflow` + `InMemory/PostgresVendableRepository`)
**Accès** : **Admin plateforme uniquement** (`portfolio:vendable:manage:platform`), sauf `proposals` soumis par `Space` via `portfolio:proposal:create:space` (`PRD-0010` v1.3)

**Packages associés**
* `@apps/spaces` — `Space` propose via `portfolio_proposals`
* `@apps/commerce` — `CommerceOffer` lit `Published`
* `@apps/beam`/`@apps/solara` — `portfolio.vendable.published` → notifications
* `@mosaix/core` — `EffectivePermissionResolver` `DENY>ALLOW`, `PermissionRegistry`
* `@mosaix/schemas` — `GsmArenaSpecSchema`, `FeatureSchema` (CS-Cart inspiré)

> **Invariant** : Portfolio ne connaît **aucun Space** en dehors de `proposal.space_id` (boundary). Une page Portfolio ne demande jamais « dans quel Space ce Vendable est-il ? ». `Vendable` = `identity + content + classification + characteristics + media + variants + relations + quality` — agnostique ventes, prix, stock transactionnel (`FORBIDDEN_OPERATIONAL_KEYS` `portfolio-service.ts:61` `price/pricing/stock/...`).

---

## 1. Vision

Portfolio est le **registre canonique** des objets vendables de la plateforme (Product, Service, DigitalProduct, Experience) — `type` `vendable.ts:1`. Il répond à :

* **Quoi** vendre ? (définition, contenu multilingue `LocalizedContent` `vendable.ts:51`, SEO `VendableSeo:46`)
* **Comment le décrire** ? (features CS-Cart `DATA-09`, caractéristiques libres vs contrôlées)
* **Comment le décliner** ? (variants `VariantItem:80` + variation groups réutilisables)
* **Où le ranger** ? (catégories arborescentes, tags, collections `VendableClassification:64`)
* **Avec quoi** ? (médias `MediaItem:71`, relations `RelationItem:99` compatible/complement/alternative)
* **Est-il prêt** ? (qualité `InformationQuality:107` `completeness/missingFields`, traductions `fr/en/ar` `portfolio-service.ts:472`)

Le **commerce** ne fait que *offrir* un Vendable `Published` (`commerce-offer.model.ts:13` `seller: Space|tenant|user`, `priceInCents`, `commissionRateBps`).

---

## 2. Acteurs & Permissions

| Acteur | Permission `authorization.can` | Capacité |
|--------|-------------------------------|----------|
| **Platform Admin** (`superadmin`/`admin` global) | `portfolio:vendable:manage:platform`, `portfolio:proposal:review:platform`, `portfolio:feature:manage:platform`, `portfolio:category:manage:platform` | tout le PRD |
| **Space Admin** | `portfolio:proposal:create:space` (`spaceId`) + `read:space` | **uniquement** proposals `POST /spaces/:spaceId/portfolio/proposals` + suivi (`PRD-0010`) |
| **Acheteur** | — | `portfolio.vendable.search` sur `Published` seul |

`MANIFEST` `apps/portfolio/src/index.ts:37` `permissions: ["portfolio:vendable:create:tenant"...]` → migrer `tenant→platform` (admin-only). Proposals gardent `space` scope.

---

## 3. Modèle de domaine (agrégats → pages)

```
Vendable (agrégat racine)
├── Identity {reference UNIQUE, type 4, status 8}  → §3.1
├── Content {Record<lang, LocalizedContent>}        → §3.2
├── Characteristics {attributes, specifications}     → §3.3 + Features CS-Cart
├── Classification {categories, tags, collections}  → §3.4
├── Media {MediaItem[]}                             → §3.5
├── Variants {VariantItem[] + Variation Group}      → §3.6
├── Relations {RelationItem 5 types}                → §3.7
├── Translations (projection Content)               → §3.8
└── Quality {completeness, missingFields}           → §3.9

Proposal (boundary Space→Portfolio, PRD-0010 v1.3, 1 table mutable)
├── portfolio_proposals {suggestedReference, type, status Draft..Approved, content..translations JSONB courant, platform_feedback, vendable_id NULL→V987}
└── vendable_id → portfolio_vendables Published (transaction atomique)

Catalogue (configuration)
├── Categories (arbre)                              → §3.10
├── Features (+ Feature Groups, DATA-09)            → §3.11
└── Variation Groups (réutilisables)                → §3.12
```

`PortfolioService` est la **seule** porte d'écriture (`createVendable` `portfolio-service.ts:172` vérifie `DuplicateVendableReference`, `SelfRelation`, `DuplicateVariantReference`, `OperationalKeyForbidden`, calcule `quality`). `mountPortfolioRoutes` `composition-root.ts:30` doit déléguer au service, pas construire `Vendable` partiel `attributes:{}` directement.

Persistance actuelle `DATA-01` `20260922162000:7` `portfolio_vendables(13 cols JSONB)` + `portfolio_categories/variants` ; à étendre `DATA-09` `portfolio_feature_groups/features/feature_variants/vendable_features/variation_groups` (Xiaomi 18 Pro Max).

---

## 4. Parcours & Pages (19 routes — menu compact validé)

### 4.0 Menu

```
Portfolio
├── Dashboard
├── Vendables → All / New
├── Categories
├── Features → Features / Groups
├── Variation Models
├── Search
├── Proposals (PRD-0010)
├── Import
└── Export
Vendable/:id → Overview | Content | Features | Variants | Media | Relations | Translations | Quality
```

Toutes les routes vérifient `authorization.authorize("portfolio:vendable:manage:platform", {organizationId:"platform"}, userId)` — **pas de `spaceId`**.

### 4.1 `/portfolio` — Dashboard (opérationnel, pas analytique commerciale)

* KPI : total vendables, par `type` (4), par `status` (8), par catégorie top 5, derniers créés/modifiés (`portfolio-service.ts:277` `listVendables` + `search`).
* Alertes `quality` : incomplets (`completeness <80`), traductions manquantes `translation_fr`, variantes sans `pricing/inventory` complet, `media` vide, `features` manquantes (`duration` pour `Service` `portfolio-service.ts:450`).
* Entrées : `New Vendable`, `Proposals en attente` (compte `Submitted`).

### 4.2 `/portfolio/vendables` — Catalogue (page principale)

Table `Nom | Reference | Type | Status | Catégories | Variantes | Langues | Modifié | Qualité` avec recherche `SearchCriteria` `portfolio-service.ts:17` (`name/description/category/tag/collection/language/attribute/limit/offset`), filtres `Type/Status/Category/Feature/Language/Quality/Has variants/Created`, tri, pagination, bulk `publish/archive/duplicate/delete` (`updateWorkflowStatus` `portfolio-service.ts:284` `Draft→In Review→Validated→Published→Archived`).

### 4.3 `/portfolio/vendables/new` — Création wizard 8 étapes

1. **Identité** `Reference (UNIQUE), Type, Status=Draft`
2. **Contenu principal** `Name, Short description, Description` (`LocalizedContent`)
3. **Classification** `Categories, Collections, Tags`
4. **Caractéristiques** `Features CS-Cart` (sélect `Brand Nike` vs libre `Weight 450g`) — `DATA-09`
5. **Médias** `images/videos/documents`
6. **Variantes** si `type` le supporte : choix `Variation Group` (`Color+Size`) → génération `VariantItem` `reference` unique
7. **Traductions** `FR/EN/AR` matrice `✓/⚠`
8. **Vérification** checklist `quality.missingFields` `portfolio-service.ts:392` → `Save Draft / Submit In Review`

Chaque étape appelle `PortfolioService.createVendable` partiel + `calculateCompleteness`.

### 4.4 `/portfolio/vendables/:id` — Fiche Vendable (fiche à onglets)

En-tête `Name | Reference | Status badge | Type` + nav `[Overview][Content][Features][Variants][Media][Relations][Translations][Quality]` + actions `Edit / Duplicate / Publish via VendableWorkflow / Archive`.

### 4.5 `.../content` — Contenu éditorial

`Name, Short description, Description (rich), Classification, SEO slug` — indépendant de Commerce.

### 4.6 `.../features` — Caractéristiques (CS-Cart)

Table `Feature | Value` éditable (`Brand Nike`, `Material Cotton`, `Weight 450g`). Features contrôlées `variant: Red/Blue` (`portfolio_feature_variants`), libres `Text/Number/Date` `feature_type` `S/E/T/N/D`. `+ Add feature / Edit / Remove` via `portfolio_vendable_features`.

### 4.7 `.../variants` — Variantes (si supportées)

`Variation Group: Color+Size` → tableau `SKU | Color | Size` (`VariantItem` `pricing/inventory` si Portfolio agnostique : **pas de prix/stock** ici — laissé à Commerce). Génération combinaisons `POST /product_variations/generate` CS-Cart style.

### 4.8 `.../media` — Médias

Upload drag&drop, ordre, principale, `alt text`, `metadata` `checkKey` `portfolio-service.ts:135` (refuse `price/stock`).

### 4.9 `.../relations` — Relations typées

`Related, Compatible with, Replacement, Accessory, Alternative, Bundle component` (`RelationType:92`) — `targetId` contrôlé (pas texte libre).

### 4.10 `.../translations` — Traductions

Matrice `FR | EN | AR` `Name/Description/Short` `Complete/Incomplete/Missing/Outdated` (`translation_fr` `portfolio-service.ts:472`).

### 4.11 `.../quality` — Qualité explicable (évite CRUD)

`Quality score` `completeness %` + checklist `Identity ✓, Content ✓/⚠, Classification ✓, Media ⚠ No primary image, Translations ⚠ Arabic missing` — l'utilisateur sait *pourquoi* incomplet (pas un simple %).

### 4.12 `/portfolio/categories` — Arbre catégories

`Products→Electronics→Phones` + `Fashion→Shoes` (`portfolio_categories` `parentId` `DATA-01`), `create/rename/move/merge/archive`, traductions, compteur Vendables.

### 4.13 `/portfolio/features` — Catalogue caractéristiques (configuration modèle)

Liste `Feature | Type | Group | Purpose | Filterable | Variants | Usage` (ex `Color Enum Appearance Filterable`, `Brand Enum Brand Filterable`, `Weight Number Technical Filterable`).

### 4.14 `/portfolio/features/:id` — Définition Feature

`Name, Code, Group, Type S/E/T/N/D, Purpose filter/variation_separate/variation_one/brand/additional, Filterable` + `Variants` (Red/Blue, ordonner/désactiver) — `DATA-09`.

### 4.15 `/portfolio/feature-groups` — Groupes

`Physical{Weight,Height}, Appearance{Color,Material}, Commercial{Brand,Collection}` — utile quand Features >20.

### 4.16 `/portfolio/variation-groups` — Modèles réutilisables

`Clothing: Color+Size`, `Shoe: Color+Size+Width` → `Vendable → Variation Group → génération`. Si exclusif au Vendable, garder inline `variants` (§4.7) — page globale seulement si réutilisable.

### 4.17 `/portfolio/search` — Recherche globale

`Search Portfolio...` dans `reference, name, description, sku, categories, features, relations` → résultats groupés `Vendables | Categories | Features` (`portfolio-service.ts:322` `search` étendu `GIN` `DATA-09`).

### 4.18 `/portfolio/import` — Import

`Upload CSV/JSON → Mapping → Validation (mêmes services métier, `isSafeAttributeKey` `csv-parser.ts`) → Preview 1200 rows 1178 valid/22 errors → Import → Report` — `importCsv` `portfolio-service.ts:516` + `csv-parser.ts`.

### 4.19 `/portfolio/exports` — Export

`CSV/JSON/JSON-LD` filtré `Categories/Types/Status/Languages` → `exportCsv` `portfolio-service.ts:489`.

---

## 5. Proposals (Space → Portfolio) — résumé PRD-0010 v1.3

* **1 table** `portfolio_proposals(suggestedReference, type, status Draft/Submitted/InReview/ChangesRequested/Approved/Rejected/Withdrawn/Archived, content..translations JSONB courant écrasé, platform_feedback, vendable_id NULL→V987)` — pas de `proposal_revisions`, audit via `role_audit_events`.
* **Workflow** `Draft --submit--> Submitted --claim InReview--> {ChangesRequested→Draft (PATCH écrase), Rejected, Approved (transaction atomique `FOR UPDATE` + `INSERT vendable Published` + `UPDATE proposal`) }` — `Approved` crée Vendable, `vendable_id` traçabilité `P123→V987`.
* **API** `POST /spaces/:spaceId/portfolio/proposals → Draft`, `PATCH → écrase`, `POST .../submit → Submitted`, `POST /portfolio/proposals/:id/approve` (platform only, `quality>=80`).
* **UI** `Space → Proposer` (wizard) + `Space → Mes propositions` ; `Portfolio → /proposals` file d'attente + `/proposals/:id` instruction.

---

## 6. Événements & Intégrations

```ts
"portfolio.vendable.created"   {vendableId, reference, type}
"portfolio.vendable.published" {vendableId, reference} // Commerce s'abonne, crée CommerceOffer
"portfolio.workflow.updated"   {vendableId, status}
"portfolio.proposal.submitted/approved/rejected" {proposalId, vendableId?} // PRD-0010
```

Commerce ignore Proposals, lit `Published` seul.

---

## 7. Persistance (migrations)

* `DATA-01` `portfolio_vendables(13 cols) + portfolio_categories/variants` ✅ livré `20260922162000`
* `DATA-09` `portfolio_feature_groups/features/feature_variants/vendable_features/variation_groups` — pour Xiaomi 18 Pro Max `gsmarena.com/14958` (8500mAh, 30 bands 5G, Snapdragon 8 Elite Extreme Gen6) en 3 SKU `variation_group_id` commun
* `PRD-0010` `portfolio_proposals` (1 table)
* `reference UNIQUE` globale, `quality` `GIN characteristics`, `themeContract: "mosaix-default@^1.0.0"` sur 10 BACs

---

## 8. Critères d'acceptation (extrait)

1. Admin plateforme voit `Dashboard` counts par `type/status` + alertes `translation_ar` manquante.
2. `GET /portfolio/vendables?category=smartphones&feature.brand=Apple&limit=20` filtre facetté `DATA-09`.
3. Wizard 8 étapes crée `Draft` → `Publish` passe `Archived` via `Validated` (state machine `portfolio-service.ts:75`).
4. Space propose `POST /spaces/caj-jijel/portfolio/proposals` → `Draft`, `submit` → `Submitted`, `approve` → `Published` Vendable atomique.
5. `Rejected/Withdrawn` jamais dans `GET /portfolio/vendables` (12k vrais Vendables, pas 100k drafts).

---

## 9. Roadmap

| Phase | Livrable |
|-------|----------|
| **P1** | `Dashboard` + `Vendables All/New` + `Features/Groups` (CS-Cart) + `Proposals` table |
| **P2** | Fiche `Overview→Quality` 8 onglets + `Categories` arbre + `Variation Models` |
| **P3** | `Search` globale + `Import/Export` (même service métier) + `theme` tokens `mosaix-default` sur fiches |
| **P4** | `Proposals` branché `DATA-09` + `CommerceOffer` lecture `Published` |

*Lié à `PRD-0010` v1.3 (proposals), `active-backlog.md` DATA-09, §5 ROLE P1-P4.*

---

## 10. Inspiration `G:\MeshJS-by-Jules\apps\catalog` (v4.4.0, score 7.5/10 `AUDIT.md:9`)

**Réf** : `ARCHITECTURE.md:17` Engine-driven `CatalogEngine` (12 repos) + `Product` agrégat `draft→active→archived` `src/domain/aggregates/Product.ts:31` `create()/publish()/fromDTO()/toSnapshot()` + `CategoryEngine` cache bi-niveau + `StickerEngine` 4 conditions + `PRD.md:9` `suggestedBy+pending` + `manifest.json:12` 5 MCP tools + 16 events `ARCHITECTURE.md:66`.

| Idée MeshJS | Transposition Portfolio | Priorité |
|---|---|---|
| **PortfolioEngine** orchestrateur `CatalogEngine` `ARCHITECTURE.md:42` (12 repos) vs `PortfolioService` seul `portfolio-service.ts:58` full-scan `O(n)` `search:322` | Créer `PortfolioEngine` qui orchestre `VendableRepository + CategoryRepository + SpecAttributeRepository + ProductSpecRepository` (DATA-09) — `Dashboard` `listVendables` devient paginé serveur (PostgREST `tsvector` comme MeshJS `useProductSearch`) | **P1** |
| **CategoryEngine.getParentChain / getBindings(scope)** `src/engine/CategoryEngine.ts:48` héritage PIM par chaîne parentale + `bindingCache` + `isDescendantOf` | Xiaomi `Phones→Electronics→Products` hérite `feature:brand` ; `scope product|variant` `CategoryEngine:81` → `portfolio_category_feature_bindings(category_id, feature_id, scope, required)` — filtre `getRequiredBindings` `CategoryEngine:89` pour `Quality` | **P1** |
| **StickerEngine** `evaluate(new_product/price_range/stock_low/featured)` `src/engine/StickerEngine.ts:47` — visuels administrables `Sticker{label,color,icon}` `AUDIT.md:31` | Remplacer `quality.missingFields` illisible `portfolio-service.ts:392` par **stickers** `Nouveau (<7j)`, `Promo`, `Rupture imminente`, `Incomplet` stockés `portfolio_stickers` + `product_stickers` — `Dashboard` les affiche (évite 100% `completeness` opaque) | **P2** |
| **Dual PIM SpecTemplate → SpecAttribute Clean** `ARCHITECTURE.md:16` `ADR-003` | `DATA-08` `Record<string,unknown>` → `DATA-09` CS-Cart Clean : garder `characteristics.attributes` legacy en `SpecTemplate` migrable vers `portfolio_features` Clean via `CategoryAttributeBinding` progressif (comme MeshJS) | **P2** |
| **Factory DDD `Product.create(name≥2, price≥0, sellerId)`** `Product.ts:70` `DomainError` + `assertCanPublish` `Product.ts:140` | Portfolio n'a pas de factory typée — `ProductWizard` `product-wizard.service.ts` appelle `createVendable` partiel ; ajouter `Vendable.create({reference, type, name})` avec invariants (2 chars, `reference` format, `price` via `Money` `DATA-06`) | **P1** |
| **Sellable adapter** `ListingProjectionService` `ARCHITECTURE.md:88` `catalog.products → Listing (Sellable)` — commerce projette, catalog ne connaît pas commerce | Extraire `PortfolioListingProjectionService` : `portfolio.vendable.published` → `CommerceOffer` (actuellement `commerce-offer.model.ts:13` lit directement `Published` sans service) — **BC isolation** `catalog.*` seul propriétaire `AUDIT.md:133` | **P2** |
| **MCP tools + events canoniques** `catalog:product:created/published/archived/approved` `ARCHITECTURE.md:66` + 5 tools `manifest.json:12` `create_product/list_products/get_product/create_variant/list_categories` | Portfolio n'a que 4 capabilities `index.ts:31` + 3 events — ajouter `list_categories`, `create_variant` MCP + `catalog:product:published` canonique pour Commerce (au lieu de `portfolio.vendable.published` alias) | **P2** |
| **Anti-patterns à éviter** `AUDIT.md:40` `P0-1 engine.isAdmin toujours false` `CatalogEngine.ts:159`, `P0-2 window.__IGIL_KERNEL`, `P1-1 AdminCatalogPage 1504L monolithe`, cache sans TTL | Découper `PRD-0011` 19 routes en 5 panels dès P1 (évite `AdminCatalogPage` monolithe), remplacer `canWrite()` par `authorization.can` `P1-02`, TTL sur `CategoryEngine.bindingCache` `AUDIT.md:31` | **P0** |

**Leçons audit `AUDIT.md:17` 6.7kL, 1 test 209L (<5% coverage)** : ajouter `StickerEngine`, `CategoryEngine`, repositories, hooks tests dès P1 (évite rupture silencieuse PostgREST `P1-2`).
