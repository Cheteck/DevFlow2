# BAC Solara — Réseau Social Décentralisé & Flux

## 1. Vue d'ensemble
Le BAC **Solara** (`@apps/solara`) fournit le moteur de réseau social de la plateforme MosaiX : publications polymorphes (Articles, Sondages, Vitrines produits), commentaires, relations d'abonnements inter-acteurs (`followers`), et pipeline de modération de contenu.

## 2. Architecture & Services
- **`SolaraSocialService`** : Gestion des posts, types de publications extensibles via `PublicationTypeRegistry`, et modération.
- **`SolaraContentModeratorPlugin`** : Hook de modération de contenu (détection de mots proscrit, spam).

## 3. Modèle de Données & Tables SQL (schéma isolé `solara.*` depuis v1.002, préfixes débruités)
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

## 6. Décisions de modélisation vérifiées (v1.003, base live)
- **Syntaxe/ordre valides** : les remarques d'index `ON ""` et d'ordre portaient sur un export, pas sur nos migrations compilées (création parents-avant-enfants, index valides, FK présentes).
- **Réactions** : une seule active par acteur et cible (`UNIQUE(targetType,targetId,actorType,actorId)`, changement de type = upsert, anti-doublon y compris concurrent) ; types fermés (`like|love|laugh|surprised|sad|angry`).
- **Abonnements** : unicité sur le quad complet (les ids seuls ne sont pas prouvablement globaux) ; auto-suivi interdit (garde service + CHECK) ; race gérée par `ON CONFLICT` naturel.
- **Traductions** : `UNIQUE(postId,lang)`, index redondant supprimé ; codes courts (`fr`/`en`/…).
- **Vocabulaires fermés** : `actorType` (user/space/organization/system), `targetType` posts (feed/space/group/event), cibles réaction (post/comment) ; `publicationType` reste ouvert (registre extensible par design).
- **Compteurs** : `>= 0` en CHECK, incréments atomiques (`UPDATE … SET n = n + delta`) ; ordre déterministe (`createdAt`, `id` en tiebreak).
- **Contenus en TEXT** (posts, commentaires, traductions, descriptions catégories) ; `mediaUrls` = JSONB de clés stables (URLs signées générées au service, jamais stockées) ; `createdAt DEFAULT now()` partout.
- **Acteurs polymorphiques conservés (Option A)** : pas de table `actors` commune ni de FK inter-BAC (règle de frontière) — validation au niveau applicatif (hooks de modération, capabilities Citadelle/Spaces) ; statuts visibilité/blocage/signalements = passe dédiée future, pas ce schéma.
- **Non fait sciemment** : `parentCommentId` (pas de threads dans le code), association posts↔catégories (table `categories` sans lecteur), pagination curseur (tiebreak `id` prêt, API différée), index spéculatifs.