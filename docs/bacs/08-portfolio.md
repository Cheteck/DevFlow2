# BAC Portfolio — PIM, Catalogue, Caractéristiques CS-Cart & Propositions

## 1. Vue d'ensemble
Le BAC **Portfolio** (`@apps/portfolio`) est le système PIM (Product Information Management) de la plateforme. Il gère le catalogue canonique des vendables (`Vendable`), les caractéristiques techniques extensibles inspirées de **CS-Cart** (groupes, types de caractéristiques `S/E/T/N/D/C`, filtrage à facettes), la matrice de variantes, et le **workflow de proposition par les Spaces (PRD-0010)**.

## 2. Architecture & Services
- **`PortfolioService`** : Gestion du PIM, recherche multicritères, validation des règles d'invariants et score de complétude (`quality.completeness`).
- **`ProposalService`** : Gestion du cycle de vie des propositions de produits par les Spaces (`Draft → Submitted → InReview → Approved/ChangesRequested/Rejected`), avec création atomique du `Vendable` canonique lors de l'approbation.

## 3. Modèle de Données & Tables SQL
- `portfolio_vendables` : `(id, reference UNIQUE, type, status, content JSONB, classification JSONB, quality JSONB, created_at, updated_at)`
- `portfolio_categories`, `portfolio_vendable_categories`, `portfolio_variants`, `portfolio_translations`, `portfolio_relations`, `portfolio_media_assets`
- **Tables CS-Cart Features** : `portfolio_feature_groups`, `portfolio_features`, `portfolio_feature_variants`, `portfolio_vendable_features`, `portfolio_variant_features`, `portfolio_variation_groups`, `portfolio_variation_group_features`
- **Table Propositions (PRD-0010)** : `portfolio_proposals` : `(id, space_id, proposer_user_id, suggested_reference, type, status, content JSONB, characteristics JSONB, features JSONB, variants JSONB, media JSONB, translations JSONB, platform_feedback, vendable_id FK, created_at, updated_at)`

## 4. Capacités & API Endpoints
- `portfolio.vendable.create` / `read` / `publish` / `search` — Gestion du catalogue canonique.
- `POST /spaces/:spaceId/portfolio/proposals` — Soumission d'une proposition par un Space.
- `POST /portfolio/proposals/:id/approve` — Approbation plateforme et création atomique du produit publié.

## 5. Contributions UI & Slots
- Catalogue PIM administrateur, assistant de création de produits, et interface de suivi des propositions pour les Spaces.
