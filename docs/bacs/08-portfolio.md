# BAC Portfolio — PIM, Catalogue, Caractéristiques CS-Cart & Propositions

## 1. Vue d'ensemble
Le BAC **Portfolio** (`@apps/portfolio`) est le système PIM (Product Information Management) de la plateforme. Il gère le catalogue canonique des vendables (`Vendable`), les caractéristiques techniques extensibles inspirées de **CS-Cart** (groupes, types de caractéristiques `S/E/T/N/D/C`, filtrage à facettes), la matrice de variantes, et le **workflow de proposition par les Spaces (PRD-0010)**.

## 2. Architecture & Services
- **`PortfolioService`** : Gestion du PIM, recherche multicritères, validation des règles d'invariants et score de complétude (`quality.completeness`).
- **`ProposalService`** : Gestion du cycle de vie des propositions de produits par les Spaces (`Draft → Submitted → InReview → Approved/ChangesRequested/Rejected`), avec création atomique du `Vendable` canonique lors de l'approbation.

## 3. Modèle de Données & Tables SQL (schéma isolé `portfolio`, v1.003, noms débruités)
- `portfolio.vendables` : `(id, reference UNIQUE, type, status, content JSONB, classification JSONB, quality JSONB, created_at, updated_at)`
- `portfolio.categories`, `portfolio.vendable_categories`, `portfolio.variants`, `portfolio.translations`, `portfolio.relations`, `portfolio.media_assets`
- **Tables CS-Cart Features** : `portfolio.feature_groups`, `portfolio.features`, `portfolio.feature_variants`, `portfolio.vendable_features`, `portfolio.variant_features`, `portfolio.variation_groups`, `portfolio.variation_group_features`
- **Table Propositions (PRD-0010)** : `portfolio.proposals` : `(id, space_id, proposer_user_id, suggested_reference, type, status, content JSONB, characteristics JSONB, features JSONB, variants JSONB, media JSONB, translations JSONB, platform_feedback, vendable_id FK, created_at, updated_at)`
- Catalogue PIM partagé plateforme (aucun `tenant_id`, aucune RLS sur portfolio : les vendables sont vendus par plusieurs Spaces via les offres Commerce).

## 4. Capacités & API Endpoints
- `portfolio.vendable.create` / `read` / `publish` / `search` — Gestion du catalogue canonique.
- `POST /spaces/:spaceId/portfolio/proposals` — Soumission d'une proposition par un Space.
- `POST /portfolio/proposals/:id/approve` — Approbation plateforme et création atomique du produit publié.

## 5. Contributions UI & Slots
- Catalogue PIM administrateur, assistant de création de produits, et interface de suivi des propositions pour les Spaces.

## 6. Décisions de modélisation vérifiées (v1.003/v1.004, base live)
- **Schéma isolé** : les 15 tables vivent sous `portfolio.*` (noms débruités), créées parents-avant-enfants avec FK présentes — les remarques d'ordre/index invalide portaient sur un export, pas sur nos migrations compilées (vérifié : 12 index valides, 20 FK).
- **Sources de vérité** : les colonnes JSONB de `vendables` font autorité pour la fiche PIM (les repos les lisent/écrivent) ; la couche relationnelle CS-Cart est la projection structurée (recherche à facettes, contraintes) — pas de double écriture applicative à ce jour (synchronisation = chantier futur, pas de duplication silencieuse).
- **`proposals` = instantané de travail** : JSONB écrasé jusqu'au `submit` (PRD-0010 v1.3, pas de révisions en v1) ; `vendable_id NULL→V987` à l'`approve` atomique ; suppression produit → `SET NULL` (historique de modération conservé).
- **Transitions** : vocabulaires en `CHECK` DB, transitions (`Draft→…→Published`) en logique applicative (`ALLOWED_WORKFLOW_TRANSITIONS`).
- **Conventions conservées (choix explicites)** : camelCase quoté (cohérence TS↔SQL, pas de migration), ids `VARCHAR(255)` (chaînes générées par l'app ; `UUID` natif rejeté : coût sans bénéfice), `sku` unique global (catalogue partagé plateforme), codes langue courts ISO (`fr`/`en`/`ar`), `featureType ∈ {S,E,T,N,D,C}` = Single/Enum/Text/Number/Date/Checkbox (CHECK + commentaire migration), `purpose` libre documenté (`filter|variation_separate|variation_one|brand|additional`), table `feature_variants` = valeurs autorisées (nom conservé pour stabilité, distinct des variantes produit).
- **Limites documentées** : `UNIQUE(vendableId,featureId)` = une valeur par caractéristique (multivalué = extension future) ; noms de groupes/features non traduits (table `translations` scopée vendable) ; cycles indirects de catégories = validation applicative future ; pas de RLS (catalogue partagé, vente multi-Space via Commerce).
- **Robustesse** : `createdAt/updatedAt DEFAULT now()`, trigger `set_updated_at` sur `vendables/variants/proposals`, textes longs en `TEXT`, index redondants supprimés (`UNIQUE` leftmost), `relations(targetVendableId)` indexé.
