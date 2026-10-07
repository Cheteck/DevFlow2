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
