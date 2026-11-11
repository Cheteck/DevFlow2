# Solara — Registre actionnable de l'audit

**Date :** 2026-11-10 · **Source :** `solara-audit-report-2026-11-10.md` · **Index :** `solara-audit-index.md`

42 items. Statuts : `OPEN` · `VERIFY` · `DONE` · `BLOCKED` · `LATER`.
Effort : **S** < 1 h · **M** 1-3 h · **L** 1-2 j.
Score = Impact × Urgence (1-3 chacun).

> **Règle de comptage :** le nombre de tâches ouvertes se recompte depuis le tableau §1, jamais depuis un paragraphe.

---

## 1. Registre

| ID | Titre | Type | Score | Effort | Statut | Dépend de |
|---|---|---|---|---|---|---|
| SOL-P0-01 | Namespace de permissions divergent → 403 garantis | Sécurité / correctif | 9 | M | OPEN | — |
| SOL-P0-02 | Solara non branché sur la base → fil vide en production | Architecture | 9 | M | OPEN | — |
| SOL-P0-03 | Aucun `boot()` → routes, capabilities et events inexistants | Architecture | 9 | L | OPEN | SOL-P0-01, SOL-P0-02 |
| SOL-P0-04 | Modération inopérante sur tous les chemins de création | Sécurité / fonction | 9 | M | OPEN | SOL-P0-03 |
| SOL-P0-05 | Posts `space`/`group`/`event` supprimés du fil | Correctif / données | 6 | S | OPEN | — |
| SOL-P1-01 | Tenant codé en dur `{organizationId:"default"}` | Sécurité / multi-tenant | 6 | S | OPEN | SOL-P0-03 |
| SOL-P1-02 | Adapter Postgres dans `domain/` | Architecture | 2 | S | OPEN | — |
| SOL-P1-03 | Pas de couche `application/` | Architecture | 1 | S | OPEN | — |
| SOL-P1-04 | Sortie de l'app vers `src/shell/` | Architecture | 4 | M | OPEN | — |
| SOL-P1-05 | Versions et manifestes divergents | Hygiène | 2 | S | OPEN | — |
| SOL-P1-06 | Présentation duplique la logique du contrôleur | Duplication | 2 | M | OPEN | — |
| SOL-P1-07 | Capability `solara.feed.read` ignore entrées et repository | Fonction | 4 | S | OPEN | SOL-P0-02 |
| SOL-P1-08 | Le contrôleur ne publie aucun événement | Fonction | 4 | M | OPEN | SOL-P0-03 |
| SOL-P2-01 | `likeCount` gonfle à chaque changement de réaction | Correctif | 4 | S | OPEN | — |
| SOL-P2-02 | Réactions perdues en mémoire ; followers non dédupliqués | Correctif | 4 | M | OPEN | — |
| SOL-P2-03 | Compteur de commentaires découplé | Correctif | 1 | S | OPEN | — |
| SOL-P2-04 | Dual write ambigu + fuite mémoire des Maps | Architecture | 4 | L | OPEN | SOL-P0-02 |
| SOL-P2-05 | Validation des entrées absente (aucun Zod) | Sécurité | 4 | M | OPEN | — |
| SOL-P2-06 | Erreurs serveur masquées en 400 | Robustesse | 2 | S | OPEN | — |
| SOL-P2-07 | Classification d'erreur par préfixe de message | Robustesse | 1 | S | OPEN | — |
| SOL-P2-08 | Permissions codées en dur ; permission ads inadéquate | Hygiène | 2 | S | OPEN | SOL-P0-01 |
| SOL-P2-09 | `Guard` instancié en dur | Testabilité | 1 | S | OPEN | — |
| SOL-P2-10 | Personnalisation codée en dur | Correctif | 4 | S | OPEN | SOL-P0-02 |
| SOL-P2-11 | Pool sponsorisé codé en dur dans le domaine | Fonction / frontière | 4 | M | OPEN | — |
| SOL-P2-12 | Télémétrie ads : array statique non bornée | Robustesse | 1 | S | OPEN | — |
| SOL-P2-13 | `publicationType` non contraint ; `PostModel` dérivé | Correctif | 1 | S | OPEN | — |
| SOL-P2-14 | 4 modèles ORM morts | Hygiène | 1 | S | OPEN | — |
| SOL-P2-15 | Placeholder `parseDummy` en production | Hygiène | 1 | S | OPEN | — |
| SOL-P2-16 | `HumanReviewQueueStage.evaluate` inerte | Fonction | 1 | S | OPEN | SOL-P0-04 |
| SOL-P3-01 | ~400 lignes de code mort | Hygiène | 1 | M | OPEN | — |
| SOL-P3-02 | `socialAutoSharePlugin` n'écoute pas son événement | Fonction | 1 | S | OPEN | — |
| SOL-P3-03 | Feature flag mort `solara.comments.reactions` | Hygiène | 1 | S | OPEN | — |
| SOL-P3-04 | `solara.moderation.ai_filter` garde un enregistrement sans effet | Hygiène | 1 | S | OPEN | SOL-P0-04 |
| SOL-P3-05 | Code mort dans le service provider + `Command` contract rompu | Correctif | 1 | S | OPEN | — |
| SOL-P3-06 | `package.json` : deps manquantes/inutiles, `dist` vs build | Packaging | 2 | S | OPEN | — |
| SOL-P3-07 | `tsconfig.frontend.json` redondant ; références manquantes | Packaging | 1 | S | OPEN | — |
| SOL-P3-08 | `.js` compilés dans `src/` | Hygiène | 4 | S | OPEN | — |
| SOL-P3-09 | Documentation obsolète ou fausse | Documentation | 2 | M | OPEN | — |
| SOL-P3-10 | 3 sources de migration, ids divergents, basename dupliqué | Correctif | 4 | M | OPEN | — |
| SOL-P3-11 | 9 erreurs eslint `boundaries` (baseline repo-wide) | Qualité | 1 | M | OPEN | SOL-P1-02, SOL-P1-03 |
| SOL-P3-12 | Couverture de test : jamais le chemin production | Qualité | 4 | L | OPEN | SOL-P0-02 |
| SOL-P3-13 | `tsc --build` cassé au niveau repo — hors périmètre Solara | Qualité | 1 | M | LATER | — |

**Comptes :** P0 = 5 · P1 = 8 · P2 = 16 · P3 = 13 · **42**.

---

## 2. Vague 1 — Débloquer la production

> **Ordre imposé.** Chaque correctif révèle le suivant. Ne pas paralléliser.

### SOL-P0-01 · Namespace de permissions divergent

- **Localisation** — App : `src/index.ts:39-44`, `src/infrastructure/solara-controller.ts:45,55,136,176,202,229`, `frontend/src/index.ts:27,34,41`, `src/presentation/solara-view.ts:42`. Shell : `src/shell/profiles.ts:38-39,68-69,104-105,168-169`, `src/shell/ssr-auth-context.ts:77-78`, `src/shell/contextual-actions.ts:11-12`. Tiers : `apps/imperia/src/domain/platform-topology.service.ts:46`.
- **Constat** — Solara exige `solara:feed:read` / `solara:post:create` / `solara:comment:add` / `solara:reaction:add` / `solara:follower:add`. Le shell accorde `solara:read:feed` / `solara:create:post`. `packages/security/src/index.ts:37` compare **exactement** → 403 pour `member` et `moderator` (seuls `admin` / `platform-governor` passent).
- **Impact** — Toutes les routes Solara en 403 dès qu'elles sont montées. `moderator` peut modérer mais ne peut ni lire le fil ni publier.
- **Action** — **Décision de plateforme d'abord** (le shell ou l'app ?), puis aligner sur **une source unique** (idéalement dérivée du manifeste, plus une constante exportée). Corriger Imperia en même temps (3ᵉ convention). Étendre `validateUserPermissions` (`src/shell/profiles.ts:324-345`) pour valider la forme action/ressource, sinon la divergence reviendra.
- **Critères d'acceptation** — ① Un principal de rôle `member` avec les permissions du shell obtient 200 sur `GET /api/solara/feed`. ② Un principal sans permission obtient 403. ③ Une seule forme de permission `solara:*` existe dans tout le repo (grep). ④ `validateUserPermissions` rejette la forme non canonique.
- **Vérification** — Test d'intégration HTTP avec un principal réel + `grep -rn "solara:" apps src` ne renvoyant qu'une seule famille de chaînes.
- **Coût / bénéfice** — M (≈ 2 h, transverse). Bénéfice : déblocage total du BAC + prévention de la régression par la garde de forme.

### SOL-P0-02 · Brancher Solara sur la base de données

- **Localisation** — `src/server/bac-wiring.ts:21` (ne cable que commerce + spaces), `src/shell/orchestrator/bac-orchestrator.ts:49-52`, `src/presentation/solara-view.ts:24`, `src/composition-root.ts` (absent de `createSolaraWiredDescriptor`).
- **Constat** — `createSolaraDescriptor()` est appelé **sans argument** → `new SolaraSocialService()` recréé à chaque rendu → service vide. Le schéma `solara.*`, l'adapter et les migrations sont inatteignables.
- **Impact** — Le fil est structurellement vide en production. Contredit `.project/architecture/in-memory-policy.md` et la règle eslint « fail-fast / DatabasePort requis ».
- **Action** — Ajouter `createSolaraWiredDescriptor(db)` dans `src/composition-root.ts` (en s'appuyant sur `PostgresSocialRepository`), l'enregistrer dans `src/server/bac-wiring.ts`, et **supprimer le fallback** `socialService || new SolaraSocialService()` de `solara-view.ts:24` → échouer explicitement si aucun adapter. Aligner sur le pattern de `apps/commerce/src/composition-root.ts`.
- **Critères d'acceptation** — ① `GET /solara` affiche les publications présentes en base. ② Une publication insérée en base apparaît dans le fil sans redémarrage. ③ Aucun `new SolaraSocialService()` sans adapter en chemin de production (grep).
- **Vérification** — Test d'intégration : INSERT en base → GET `/solara` → contenu présent. Ouverture de `docs/bacs/02-solara.md` §3 confrontée aux colonnes réelles.
- **Coût / bénéfice** — M (≈ 3 h). Bénéfice : le BAC devient fonctionnel ; 3 migrations et un schéma dedicated enfin utilisés.

### SOL-P0-03 · Monter le `ServiceProvider` (routes, capabilities, events)

- **Localisation** — `src/index.ts:87-181` (`MosaixApp.register`, 5 `provideCapability`, 4 `registerEventSchema`), `src/infrastructure/solara-service-provider.ts:71-90` (10 routes), `src/composition-root.ts:19`.
- **Constat** — `createSolaraApp()` et `createSolaraComposition()` ne sont appelés que depuis `src/solara.test.ts`. Aucun shell/app n'appelle `ServiceProvider.boot()`. Aucun `MosaixApp.register` pour Solara. Le seul éditeur de `solara.post.published` est le shell (`src/server/routes/feed-routes.ts:59`) avec une charge utile **incompatible** du schéma déclaré (`src/events/solara-events.ts:35-47`).
- **Impact** — 10 routes inexistantes, 5 capabilities injoignables, 4 schémas d'événements non enregistrés, 4 événements jamais publiés, contrat d'événement violé par son seul émetteur.
- **Action** — Appeler `createSolaraApp(kernel, tenant)` au boot (ou monter le router Solara via la même mécanique que commerce/spaces). Décider où vit la publication d'événements (cf. SOL-P1-08) et **aligner la charge utile** de `src/server/routes/feed-routes.ts:59` sur le schéma déclaré, ou faire de Solara le seul éditeur et retirer celui du shell.
- **Critères d'acceptation** — ① `GET /api/solara/feed` répond (200 ou 401/403 selon le principal, **pas 404**). ② `POST /api/solara/posts` crée une publication persistée. ③ `solara.post.published` est émis par Solara **et** par aucun autre éditeur, avec une charge utile conforme au schéma. ④ Les 4 `registerEventSchema` sont actifs.
- **Vérification** — Test HTTP de bout en bout + abonnement à l'événement du kernel + asserts sur la forme de la charge utile.
- **Coût / bénéfice** — L (≈ 1 j, transverse shell). Bénéfice : le contrat d'événements redevient exécutable.

### SOL-P0-04 · Câbler la modération sur tous les chemins de création

- **Localisation** — `src/domain/social.model.ts:222` (`registerContentHook`), `:245-253` (boucle de hooks), `src/infrastructure/solara-service-provider.ts:29-36` (enregistrement plugin), `src/commands/create-post.command.ts:29-30` (exécution du hook).
- **Constat** — `registerContentHook` n'est appelé que depuis le test. `contentHooks` est vide en production. Le hook enregistré sur le moteur global n'est exécuté que par `CreatePostHandler`, que personne ne dispatche. `SolaraModerationPipeline` n'est jamais instancié ; `HumanReviewQueueStage.evaluate` renvoie toujours `approved`.
- **Impact** — Aucun contenu n'est modéré, quelle que soit la voie d'écriture. Contrary to `responsibilities.md:36` et `docs/bacs/02-solara.md:8`.
- **Action** — **Coordonner avec l'item central `PLG-04`** (ne pas dupliquer). Faire passer **tous** les chemins (REST, capability, command) par un point unique : soit router via le `CommandBus`, soit enregistrer le hook de modération comme `contentHook` sur `SolaraSocialService` au boot.
- **Critères d'acceptation** — ① Un contenu avec mot proscrit est rejeté par la voie REST, par la capability **et** par la command. ② Un test échoue si `contentHooks` est vide au boot. ③ La file de revue humaine reçoit réellement un item pour un contenu flaggé.
- **Vérification** — 3 tests, un par chemin de création.
- **Coût / bénéfice** — M (≈ 3 h, avec `PLG-04`). Bénéfice : la modération redevient un mécanisme actif, pas une documentation.

### SOL-P0-05 · Filtrage du feed : posts `space`/`group`/`event` supprimés

- **Localisation** — `src/infrastructure/solara-controller.ts:91` (`aggregatePaginated(posts, [], …)`) ; filtres cibles dans `packages/feed-engine/src/index.ts` (`registerFeedTargetFilter`).
- **Constat** — `followedSpaceIds = []` → `spaceIds`/`groupIds`/`eventIds` vides → tous les posts ciblés sont filtrés. Or `targetType` ∈ `feed|space|group|event` est garanti par le CHECK SQL `posts_target_check`.
- **Impact** — Posts acceptés, stockés, comptabilisés et **invisibles** dans tous les fils. Perte de données silencieuse, sans log.
- **Action** — Passer les identifiants suivis réels, ou filtrer hors `FeedAggregator` pour les modes non personnalisés. Vérifier aussi la vue (`solara-view.ts:222-260`), qui applique le même `FeedAggregator` via `aggregatePaginated`.
- **Critères d'acceptation** — ① Un post `targetType: "space"` apparaît dans le fil `space` correspondant. ② Un post `targetType: "feed"` reste visible. ③ Test de non-régression sur les 4 `targetType`.
- **Vérification** — 3 tests (un par `targetType` non-`feed`).
- **Coût / bénéfice** — S (≈ 1 h). Bénéfice : suppression d'une perte de données silencieuse.

---

## 3. Vague 2 — Architecture & cohérence

### SOL-P1-01 · Tenant codé en dur

- **Localisation** — `src/index.ts:88`. Conteneur alimenté par `packages/sdk/src/index.ts:267`. Impact `packages/sdk/src/index.ts:76,89`.
- **Constat** — `{ organizationId: "default" }` en dur alors que `createBoundedAppBootstrap` place le vrai tenant dans le conteneur.
- **Impact** — Toutes les enveloppes d'événements et tous les contrôles de permission de capability estampillés « default » → isolation multi-tenant rompue.
- **Action** — `const tenant = container.resolve<TenantIdentity>("tenant");` (le conteneur le contient déjà). Pattern : `apps/spaces/src/index.ts:74-78`.
- **Acceptation** — ① Un event publié par Solara porte le tenant réel. ② Test : deux tenants → événements distincts. ③ Aucun `"default"` en dur dans `apps/solara/`.
- **Effort / bénéfice** — S. Bénéfice : correction de l'isolation multi-tenant.

### SOL-P1-02 · Adapter Postgres dans `domain/`

- **Localisation** — `src/domain/postgres-social-repository.ts` → déplacer vers `src/infrastructure/postgres-social-repository.ts`.
- **Constat** — `app-domain` n'autorise que `framework-foundation` + `sdk` (`eslint.config.mjs:169`) ; le fichier importe `@mosaix/ports-database` (framework-port). 10/10 apps frères placent l'adapter en `infrastructure/`.
- **Action** — Déplacer le fichier ; conserver le port `SocialRepositoryPort` dans `domain/social.model.ts:166`. Importer le port depuis l'adapter (port en domain, adapter en infrastructure).
- **Acceptation** — ① `src/domain/` n'importe plus `@mosaix/ports-database`. ② 0 nouvelle erreur `boundaries` (cf. SOL-P3-11). ③ Le port et l'adapter sont dans 2 fichiers distincts.
- **Effort / bénéfice** — S. Bénéfice : hexagonale respectée, alignement sur les 10 autres apps.

### SOL-P1-03 · Créer la couche `application/`

- **Localisation** — `src/commands/` (non déclaré comme couche → `app-general`, qui ne peut pas importer `app-domain` → 2 erreurs eslint), `src/events/`, capabilities inline dans `src/index.ts`.
- **Constat** — `responsibilities.md:15` déclare `application/` (CQRS/capabilities/events) : elle n'existe pas. Emplacements propres : `apps/solidarity/src/application/solidarity-commands.ts`, `apps/portfolio/src/application/portfolio-application.ts`.
- **Action** — Déplacer `src/commands/create-post.command.ts` → `src/application/solara-commands.ts` ; extraire les capabilities + `registerEventSchema` de `src/index.ts` vers `src/application/solara-capabilities.ts`. Trancher si `src/events/` reste à sa place (compatible avec commerce/spaces/citadelle).
- **Acceptation** — ① `src/application/` existe et contient capabilities + commands. ② `src/index.ts` ne fait plus que composition (manifest + boot). ③ 0 erreur `boundaries` sur `src/application/`.
- **Effort / bénéfice** — S. Bénéfice : structure conforme à la taxonomie et à `responsibilities.md`.

### SOL-P1-04 · Sortie de l'app vers `src/shell/`

- **Localisation** — `src/infrastructure/solara-service-provider.ts:10`, `src/commands/create-post.command.ts:4` → `../../../../src/shell/plugin-engine-bootstrap.js`.
- **Constat** — Dépendance inversée Layer 7 → Layer 5. Aucun API public : `@mosaix/plugin-engine` n'exporte que la classe, `@mosaix/sdk` rien. `package.json:27` déclare `@mosaix/plugin-engine` sans l'importer.
- **Impact** — Non détectable par le lint actuel (`boundaries` ne résout pas les specifiers ; `no-restricted-imports` est scopé à `src/server/**`). `apps/commerce` et `apps/imperia` ont le même défaut → **dette de plateforme**, pas propre à Solara.
- **Action** — Exposer un accessor public dans `@mosaix/plugin-engine` (ou `@mosaix/sdk`) : `getPluginEngine()` / injection via conteneur. Puis remplacer les 2 imports Solara. À traiter au niveau repo (cf. `PLG-02` « Bootstrapping PluginEngine dans le Shell »).
- **Acceptation** — ① `grep "src/shell" apps/solara` → 0. ② Un hook enregistré via l'API publique est bien exécuté. ③ `@mosaix/plugin-engine` réellement importé.
- **Effort / bénéfice** — M (coordonné `PLG-02`). Bénéfice : frontière de couches restaurée, testabilité.

### SOL-P1-05 · Versions et manifestes divergents

- **Localisation** — `package.json:3` (0.1.0) · `mosaix.json:5` (1.0.0) · `src/index.ts:27` (1.0.0) · `src/presentation/solara-view.ts:38` (**2.5.0**). Noms : `src/index.ts:26` vs `mosaix.json:4`. `themeContract` : `mosaix.json:62` vs absent du const TS.
- **Constat** — 4 versions, 2 noms, 2 manifestes, aucun script de comparaison (`scripts/validate-manifests.ts` ne lit que le JSON).
- **Action** — Fixer une version unique ; générer le const TS depuis `mosaix.json` (script de build) ou l'inverse ; aligner le nom ; documenter le rôle de `themeContract` (typée dans `packages/contracts`, **lue nulle part**).
- **Acceptation** — ① Un script compare les 2 manifestes et échoue en CI en cas de divergence. ② Une seule version dans le repo pour Solara. ③ Le `BacDescriptor.version` est aligné sur le manifeste.
- **Effort / bénéfice** — S. Bénéfice : une seule source de vérité, discovery shell fiable.

### SOL-P1-06 · Extraire le ranking partagé

- **Localisation** — `src/presentation/solara-view.ts:222-260` vs `src/infrastructure/solara-controller.ts:70-83`.
- **Constat** — Deux implémentations du dispatch (for_you / trending / media / chronological / ranked) et de l'injection sponsor (`interval: 3` vs `interval: 4`). Deux comportements pour un même domaine.
- **Action** — Extraire un module `src/application/solara-feed-pipeline.ts` (ou `src/domain/`) consommé par le contrôleur et la vue ; un seul jeu de modes, un seul `interval`.
- **Acceptation** — ① Le dispatch des modes n'existe qu'à un endroit. ② Un test paramétré sur les modes couvre contrôleur **et** vue.
- **Effort / bénéfice** — M. Bénéfice : suppression de la divergence silencieuse, halved surface de test.

### SOL-P1-07 · Capability `solara.feed.read` inexploitable

- **Localisation** — `src/index.ts:168-170` → `socialService.listFeed("feed", "", undefined)`.
- **Constat** — Synchrone, mémoire seule, aucun paramètre d'entrée honoré (ni pagination, ni mode, ni cible). En production (mémoire vide) → tableau vide.
- **Action** — Accepter `{ targetType, targetId, mode, limit, afterCursor }`, passer par la voie asynchrone (repository), réutiliser le pipeline de feed de SOL-P1-06.
- **Acceptation** — ① La capability accepte et honore pagination + mode. ② Un test de capability renvoie les posts de la base.
- **Effort / bénéfice** — S. Bénéfice : la capability devient un vrai contrat.

### SOL-P1-08 · Le contrôleur ne publie aucun événement

- **Localisation** — `src/infrastructure/solara-controller.ts:134-251` (4 handlers d'écriture) ; ports disponibles : aucun `EventBus` dans `packages/ports/`.
- **Constat** — Seules les capabilities publient (`src/index.ts:110,128,148,164`). Les créations via REST n'émettent rien → deux chemins, deux sémantiques.
- **Action** — **Trancher** : (a) introduire un port `EventPublisher` injecté dans le contrôleur, ou (b) faire du `CommandBus` le point d'écriture unique (REST et capabilities y passent). L'option (b) résout aussi SOL-P0-04.
- **Acceptation** — ① Une création par REST et par capability produisent **le même** ensemble d'événements. ② Test : les 2 voies émettent les 4 types d'événements.
- **Effort / bénéfice** — M. Bénéfice : sémantique d'événements unique.

---

## 4. Vague 3 — Logique métier & qualité

| ID | Localisation | Constat | Critère d'acceptation | E |
|---|---|---|---|---|
| SOL-P2-01 | `src/domain/social.model.ts:429-439` ; `src/domain/postgres-social-repository.ts:142` | `incrementLikeCount(+1)` sur **toute** réaction, y compris `love`/`angry`, alors que l'upsert natural-key ne crée pas de ligne → compteur divergent | Compteur = nombre de réacteurs distincts ; changer le type ne l'incrémente pas ; un test par type de réaction | S |
| SOL-P2-02 | `src/domain/social.model.ts:419-441`, `:368-396` | Réactions non conservées sans adapter ; followers non dédupliqués en mémoire (la DB déduplique) | `getReactions` existe au niveau service ; suivre 2× le même acteur ne crée pas 2 relations en mémoire **et** en DB | M |
| SOL-P2-03 | `src/domain/social.model.ts:339,343` ; `postgres-social-repository.ts:172-176` | `commentsCount++` mémoire **et** `incrementCommentsCount` DB → double comptage | Compteur DB = nombre réel de commentaires après relecture | S |
| SOL-P2-04 | `src/domain/social.model.ts:185-188`, `:292-306` | Maps = store primaire + miroir DB ; fusion sans expiration → mémoire non bornée, posts supprimés visibles, ordre arbitraire | **Une seule** source de vérité (DB) ; les Maps deviennent un cache TTL ou disparaissent ; ordre déterministe `(createdAt DESC, id DESC)` | L |
| SOL-P2-05 | `src/infrastructure/solara-controller.ts:136-146` ; `src/domain/social.model.ts:63-77` | Aucune validation de `actorType`/`targetType`/`actorId`/longueur ; métadonnées validées par présence seule ; pas de Zod | Zod (ou équivalent) sur le body REST **et** sur les entrées de capability ; alignement avec `docs/bacs/02-solara.md:17` | M |
| SOL-P2-06 | `src/infrastructure/solara-controller.ts:164-168`, `191-195`, `218-221` vs `227-251` | Toute erreur → 400 (panne DB masquée) ; `followActor` → 500 pour la même classe d'erreur | Erreurs domain → 400 ; erreurs infra → 500 ; traitement homogène sur les 4 handlers | S |
| SOL-P2-07 | `src/infrastructure/solara-controller.ts:32-41` | `startsWith("Unauthorized"/"Forbidden")` couplé au libellé de `packages/security/src/index.ts:26,40` | Classement par **type d'erreur** (ex. `GuardError`), pas par chaîne | S |
| SOL-P2-08 | `src/index.ts:39-44` vs `solara-controller.ts:45,55,107,136,176,202,229` | Permissions dupliquées en dur ; la télémétrie ads est gardée par `solara:moderate:content` | Permissions dérivées du manifeste ; permission dédiée `solara:ads:telemetry` | S |
| SOL-P2-09 | `src/infrastructure/solara-controller.ts:16` | `new Guard()` en dur → non mockable | `Guard` injecté par le conteneur | S |
| SOL-P2-10 | `src/infrastructure/solara-controller.ts:71-75` ; `src/presentation/solara-view.ts:245-248` | `userId:"current-user-1"`, espaces et interests codés en dur ; 2 identités divergents ; interests jamais matchés (`metadata.tags` jamais posé) | Identité issue du contexte (`req.principal`) ; profil réel ; `metadata.tags` réellement alimenté | S |
| SOL-P2-11 | `src/domain/social.model.ts:189-209` ; `src/infrastructure/solara-controller.ts:60,87-89` | Fausse pub dans le service métier, injectée par défaut ; `ctaUrl` dans l'espace de route de Commerce | Pool sponsorisé **hors** du domaine (port/adaptateur) ou suppression ; opt-in explicite ; frontière publicitaire formalisée (cf. `responsibilities.md:40`) | M |
| SOL-P2-12 | `src/infrastructure/solara-controller.ts:119-125` | `SponsorshipTelemetry` = array statique non borné | Persisté ou TTL ; croissance bornée | S |
| SOL-P2-13 | `src/domain/social.model.ts:6-14`, `:80-92` vs `:123-136` | `publicationType` = `string` ; absent du modèle ORM | Type contraint (union + registre) ; `PostModel` aligné sur `Post` | S |
| SOL-P2-14 | `src/domain/social.model.ts:80-121` | 4 modèles ORM jamais hydratés (SQL brut) ; `declare createdAt` parasite | Supprimés, ou réellement utilisés par un `Repository` | S |
| SOL-P2-15 | `src/domain/solara-feed-realtime.ts:40-47` | `parseDummy` : « Shared Article » en dur + `new URL()` qui lève | Implémenté via un fetcher réseau avec timeout, ou supprimé | S |
| SOL-P2-16 | `src/domain/solara-moderation-pipeline.ts:77-80` | `evaluate` renvoie toujours `approved` → file de revue jamais alimentée | Un contenu flaggé entre dans la file ; `resolveItem` clôt le pipeline | S |

---

## 5. Vague 4 — Hygiène, dette & documentation

| ID | Localisation | Constat | Critère d'acceptation | E |
|---|---|---|---|---|
| SOL-P3-01 | `src/domain/solara-feed-realtime.ts` (125 l.), `solara-moderation-pipeline.ts` (154 l.), `social-auto-share-plugin.ts` (147 l.) | ~400 lignes, 0 référence dans tout le repo. `responsibilities.md:27` revendique « groupes, realtime, analytics » qui n'existent pas | Code supprimé **ou** branché ; `responsibilities.md` aligné sur le réel | M |
| SOL-P3-02 | `src/domain/social-auto-share-plugin.ts:62,169` | N'écoute pas `portfolio.vendable.published` ; singleton hors DI | Abonnement réel à l'événement, ou suppression | S |
| SOL-P3-03 | `src/shell/feature-flags.ts:133` | `solara.comments.reactions` déclaré, jamais lu | Lu ou retiré du catalogue | S |
| SOL-P3-04 | `src/infrastructure/solara-service-provider.ts:29-36` | Flag qui garde un enregistrement sans effet | Effet réel (cf. SOL-P0-04) ou retrait | S |
| SOL-P3-05 | `src/infrastructure/solara-service-provider.ts:23,45-46` ; `src/commands/create-post.command.ts:18-19` | Instance conteneur jamais résolue ; handler enregistré 2× ; `Command` contract rompu (`static` vs instance `commandName`) | 1 enregistrement par commande ; `commandName` conforme au contrat `Command<T>` | S |
| SOL-P3-06 | `package.json:7-8,15-33` | 4 deps manquantes (`contracts`, `ports-database`, `migrations`, `support`), 6 inutiles ; `main`/`types`/`files` → `./dist` alors que l'emit est `.mosaix/build/apps/solara` ; `eslintBoundaries` non lu | `pnpm install --frozen-lockfile` OK ; les points d'entrée publiés existent ; deps = imports réels | S |
| SOL-P3-07 | `tsconfig.frontend.json:1` ; `tsconfig.json:11-53` | `tsconfig.frontend.json` redondant + `rootDir` incohérent, référencé par rien ; ni `packages/contracts` ni `packages/ports/database` en `references` | Un seul projet TS pour l'app ; `references` complètes | S |
| SOL-P3-08 | `src/**/*.js` (13 fichiers) | Artefacts compilés à côté des `.ts` → risque de résolution vers du code périmé | `src/**/*.js` supprimés ; ajout au `.gitignore` si nécessaire | S |
| SOL-P3-09 | `README.md:8,12-25` ; `src/index.ts:3` ; `responsibilities.md:15,27,55-57` ; `docs/bacs/02-solara.md:11-18` | 12+ affirmations fausses ou obsolètes (voir rapport §5) | Toutes corrigées ; un lien vers ce backlog dans `responsibilities.md` | M |
| SOL-P3-10 | `src/infrastructure/migrations.ts:105` ; `migrations/20260926094000_…:40` ; `src/shell/bac-migrations.ts:123-125` | 3 sources de migration, 2 schémas, ids divergents (id fichier ≠ id canonique) ; basename `migrations` dupliqué (AGENTS.md §10) | Ids alignés ; un seul provider ; basename unique | M |
| SOL-P3-11 | 5 fichiers, 9 erreurs `boundaries` | Baseline repo-wide (104 sur solidarity) ; la règle `no-restricted-imports` ne s'applique qu'à `src/server/**` | 0 erreur sur Solara après SOL-P1-02/03 ; note explicite que le reste est une dette plateforme | M |
| SOL-P3-12 | `src/solara.test.ts` | 10 tests, chemin in-memory seul ; 2 tests « repository » n'assertent qu'une chaîne SQL | Tests contre le **schéma réel** : repository, migrations, capability, event, tenant | L |
| SOL-P3-13 | root `tsconfig.json:12` | `tsc --build` cassé (`allowImportingTsExtensions` + `composite`) — **hors périmètre Solara** | Décision repo ; ne pas traiter dans Solara | M |

---

## 6. Points d'attention transverses

1. **Ne pas casser l'existant.** `src/domain/solara-feed-realtime.ts` est mort mais `FeedScoringEngine` duplique `packages/feed-engine` (`FeedScorer`). Supprimer, ne pas réimplémenter.
2. **`@mosaix/feed-engine` est la source de vérité** pour le feed (ranking, sponsored, safety). Solara ne doit pas le re-dépendre dans `domain/` — cf. `SOL-P1-02`.
3. **Le shell deep-importe Solara** (`src/shell/orchestrator/bac-orchestrator.ts:50`) alors que `src/server/bac-wiring.ts:11-14` l'interdit. À corriger dans le cadre de SOL-P0-02, pas séparément.
4. **`docs/bacs/02-solara.md` est la spec** — la corriger (SOL-P3-09) après les corrections de code, pas avant, sinon elle décrit un état transitoire.
5. **Coordination avec le registre central** — `.project/backlog/BACKLOG.md` doit reprendre les 5 items P0 avec un renvoi ici (cf. index §5). Ne pas dupliquer les fiches.
6. **Les tests de Solara doivent rester verts** à chaque item : le protocole « 1 changement → vérification → la suite » d'AGENTS.md §1 s'applique.

---

## 7. Suivi

| Vague | Items | Statut | Preuve |
|---|---|---|---|
| 1 — Bloquants | SOL-P0-01…05 | OPEN | — |
| 2 — Architecture | SOL-P1-01…08 | OPEN | — |
| 3 — Qualité métier | SOL-P2-01…16 | OPEN | — |
| 4 — Hygiène | SOL-P3-01…13 | OPEN | — |

**Critère de sortie de la Vague 1 :** `GET /api/solara/feed` renvoie les publications présentes en base, et `POST /api/solara/posts` crée une publication **persistée, modérée et visible dans le fil**.
