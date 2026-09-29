# BAC Solara — Réseau Social Décentralisé & Flux

## 1. Vue d'ensemble
Le BAC **Solara** (`@apps/solara`) fournit le moteur de réseau social de la plateforme MosaiX : publications polymorphes (Articles, Sondages, Vitrines produits), commentaires, relations d'abonnements inter-acteurs (`followers`), et pipeline de modération de contenu.

## 2. Architecture & Services
- **`SolaraSocialService`** : Gestion des posts, types de publications extensibles via `PublicationTypeRegistry`, et modération.
- **`SolaraContentModeratorPlugin`** : Hook de modération de contenu (détection de mots proscrit, spam).

## 3. Modèle de Données & Tables SQL
- `solara_posts` : `(id, actor_type, actor_id, publication_type, target_type, target_id, content, metadata JSONB GIN, likes_count, comments_count, created_at)`
- `solara_comments` : `(id, post_id FK, author_id, content, created_at)`
- `solara_followers` : `(follower_actor_type, follower_actor_id, target_actor_type, target_actor_id, created_at)`
- `solara_categories` & `solara_translations` : Internationalisation et catégorisation.

## 4. Capacités & API Endpoints
- `solara.post.create` — Création de publication polymorphe avec validation Zod des métadonnées.
- `GET /solara/feed` — Récupération du fil d'actualités avec pagination par curseur.
- `POST /solara/followers` — Suivi d'un acteur (User ou Space).

## 5. Contributions UI & Slots
- Flux social global (`/`) et widgets de modération communautaire.

## 6. Moteur de Ranking & Recommandation N1 (Multi-source + MMR + Telemetry)
Solara s'appuie sur `@mosaix/feed-engine` pour fournir un classement personnalisé sans Machine Learning :
- **Multi-source** (`listFeedMultiSource`) : Fusionne 3 sources de données (`followed`, `trending`, `recent`) dédupliquées par leur ID.
- **Diversité MMR** (`DiversityReranker`) : Algorithme Maximal Marginal Relevance (λ=0.7) calculant la similarité cosinus sur les tags et pénalisant les publications d'un même auteur.
- **Contraintes Dures** :
  - `max_par_auteur: 2` (maximum 2 posts du même auteur dans une fenêtre de rendu).
  - `max_par_categorie: 4` (maximum 4 posts de la même catégorie/tag).
  - `min_categories: 3` (force la présence d'au moins 3 catégories distinctes).
- **Télémétrie & Métriques Prometheus** (`/metrics`) :
  - `mosaix_feed_interaction_rate` : Ratio d'interactions (likes + commentaires / impressions).
  - `mosaix_feed_skip_mute_rate` : Ratio de skips + mutes.
  - `mosaix_feed_category_entropy` : Entropie de Shannon des catégories dans le flux servi.
