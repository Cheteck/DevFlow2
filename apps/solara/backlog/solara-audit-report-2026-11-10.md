# Solara — Rapport d'audit technique

**Date :** 2026-11-10
**Périmètre :** `apps/solara/` — 15 fichiers TS (~2 100 lignes), `mosaix.json`, `package.json`, 2 tsconfig, `README.md`, `responsibilities.md`
**Méthode :** lecture seule (aucun fichier modifié) + exécution des vérifications du repo + comparaison avec les 10 BACs frères et le shell
**Livrable associé :** `solara-audit-items-2026-11-10.md` (registre actionnable), `solara-audit-index.md` (index)

> Convention d'ID : `SOL-P<n>-<nn>` — P0 bloquant, P1 architecture, P2 qualité métier, P3 hygiène.

---

## 1. Synthèse

Solara est un **BAC « fantôme »**. Il possède un modèle de domaine complet, un adapter Postgres, 3 migrations, un schéma `solara.*` dédié, 5 capabilities, 4 schémas d'événements, 10 routes REST et un contrôleur autorisé — **mais aucune de ces couches n'est branchée sur la plateforme en exécution**.

| Couche | Existe | Branchée en production | Preuve |
|---|---|---|---|
| Modèle de domaine | ✅ | ✅ | `src/domain/social.model.ts` |
| Adapter Postgres | ✅ | ❌ | `src/domain/postgres-social-repository.ts` — jamais résolu |
| Migrations (3) | ✅ | ✅ | `src/shell/bac-migrations.ts:357-369` |
| Schéma `solara.*` | ✅ | ⚠️/migrations OK, **lectures jamais faites** | idem |
| Service provider (`boot`) | ✅ | ❌ | aucun appelant de `createSolaraApp` hors test |
| Routes REST (10) | ✅ | ❌ | `src/infrastructure/solara-service-provider.ts:71-90` |
| Capabilities (5) | ✅ | ❌ | `MosaixApp.register` jamais appelé |
| Schémas d'événements (4) | ✅ | ❌ | `registerEventSchema` jamais atteint |
| Publication d'événements | ✅ | ❌ | aucun `app.publish` atteint |
| Modération (hooks) | ✅ | ❌ | `contentHooks` vide en production |
| Présentation SSR | ✅ | ⚠️ | rend un service **vide** |

**Conséquence utilisateur :** la page `/solara` affiche « Aucune publication dans ce flux » (`src/presentation/solara-view.ts:390`). Les endpoints `/api/solara/*` n'existent pas.

**Pourquoi les tests ne l'attrapent pas :** les 10 tests de `src/solara.test.ts` n'exercent que le chemin in-memory, via `createSolaraComposition()` sans `databasePort`. Le chemin production — Postgres, boot, event bus, modération — n'a **aucune** couverture.

**Les bugs sont empilés.** Corriger le branchement DB (P0-2) révèle le conflit de permissions (P0-1) → 403. Corriger les permissions révèle l'absence de publication d'événements (P1-8). Chaque correctif démasque le suivant : la Vague 1 a un **ordre imposé**.

---

## 2. P0 — Bloquants production

### SOL-P0-01 · Namespace de permissions divergent → 403 garantis

Solara exige un namespace de permissions que **personne ne possède**.

| Besoin | Solara exige | Le shell accorde | Match |
|---|---|---|---|
| lire le fil | `solara:feed:read` | `solara:read:feed` | ❌ |
| publier | `solara:post:create` | `solara:create:post` | ❌ |
| commenter | `solara:comment:add` | — | ❌ |
| réagir | `solara:reaction:add` | — | ❌ |
| suivre | `solara:follower:add` | — | ❌ |
| modérer | `solara:moderate:content` | `solara:moderate:content` | ✅ |

**Localisation**
- App : `src/index.ts:39-44` (manifeste), `src/infrastructure/solara-controller.ts:45,55,136,176,202,229` (guards), `frontend/src/index.ts:27,34,41` (slots), `src/presentation/solara-view.ts:42` (descriptor)
- Shell : `src/shell/profiles.ts:38-39,68-69,104-105,168-169`, `src/shell/ssr-auth-context.ts:77-78`, `src/shell/contextual-actions.ts:11-12`
- Tiers : `apps/imperia/src/domain/platform-topology.service.ts:46` (`solara:post:create`, `solara:comment:add` → format Solara)

**Mécanisme.** `packages/security/src/index.ts:37` :

```ts
if (roles.includes("admin") || roles.includes("platform-governor") || permissions.includes(requiredPermission)) {
```

Comparaison **exacte**, sans alias ni mapping. Seuls `roles: ["admin"]` / `["platform-governor"]` passent outre. Les rôles `member` et `moderator` de `src/shell/profiles.ts` ne contiennent aucun des deux → **403 sur toutes les routes Solara** dès qu'elles sont montées.

**Trois conventions coexistent** dans le repo : `domain:action:resource` (shell), `domain:resource:action` (Solara), et le format Solara appliqué par Imperia.

**Pourquoi rien ne l'attrape :** `src/solara.test.ts:19-26` construit le principal de test avec le namespace **de Solara** → le test valide un permission set que nul principal réel ne détient.

**Garde manquante :** `validateUserPermissions` (`src/shell/profiles.ts:324-345`) ne valide que le **préfixe BAC** (`solara:`). Les deux formes passent. L'item central `SHELL-PERM-01` est marqué `DONE` mais ne couvre pas la forme action/ressource.

**Nuance importante :** `requiredPermissions` du `BacDescriptor` n'est lu **nulle part** (`grep requiredPermissions src/` → 0) et `resolveBacAccess` (`src/shell/bac-access.ts:125-142`) ne contrôle que l'authentification. L'écran `/solara` reste donc accessible → **le défaut est latent** et s'active exactement au moment où le wiring est corrigé.

### SOL-P0-02 · Solara n'est pas branché sur la base → le fil est vide en production

`src/server/bac-wiring.ts:21` ne câble que **commerce** et **spaces** :

```ts
await Promise.all([wireCommerceDescriptor(db), wireSpacesDescriptor(db)]);
```

Commerce et Spaces exposent `createCommerceWiredDescriptor(db)` / `createSpacesWiredDescriptor(db)` depuis leur `composition-root.ts`. **Solara n'a aucun équivalent.** Résultat, `src/shell/orchestrator/bac-orchestrator.ts:49-52` :

```ts
const { createSolaraDescriptor } = await import("../../../apps/solara/src/presentation/solara-view.js");
return createSolaraDescriptor();          // ← aucun argument
```

→ `src/presentation/solara-view.ts:24` :

```ts
const service = socialService || new SolaraSocialService();
```

**Un service vide, recréé à chaque rendu.** Conséquences : le schéma Postgres `solara.*`, le `PostgresSocialRepository`, les compteurs et les migrations sont **inatteignables en production**. Le fil est structurellement vide.

**Aggravant :** ce fallback `new SolaraSocialService()` (stockage mémoire) viole `.project/architecture/in-memory-policy.md` et la règle eslint « Stockage en mémoire interdit hors tests/bench : exigez un DatabasePort (fail-fast) ». Le contournement est que le nom de la classe ne commence pas par `InMemory` — la règle est contournée par le nommage, pas respectée.

### SOL-P0-03 · Aucun `boot()` → routes, capabilities et events inexistants

`createSolaraApp` (`src/index.ts:191`) et `createSolaraComposition` (`src/composition-root.ts:19`) ne sont appelés **que depuis `src/solara.test.ts`** (`grep` sur `src/` → 0 occurrence ; sur tout le repo → uniquement le test).

Donc, en production :

- les **10 routes** de `src/infrastructure/solara-service-provider.ts:71-90` (`/api/solara/types|feed|posts|comments|reactions|followers|telemetry/ad` + alias `/solara/*`) ne sont jamais montées ;
- `MosaixApp.register` (`src/index.ts:87`) n'est jamais appelé → les **5 `provideCapability`** (`:93-170`) et les **4 `registerEventSchema`** (`:172-178`) ne sont jamais enregistrés ;
- `solara.post.published` n'est **jamais publié par Solara**.

**Conflit de contrat d'événement.** Le seul émetteur est le shell, `src/server/routes/feed-routes.ts:59` :

```ts
eventBackplane.publish("solara.post.published", { post: newPost });
```

Charge utile `{ post: FeedPost }` — **incompatible** avec le schéma déclaré dans `src/events/solara-events.ts:35-47` :

```ts
"solara.post.published": {
  required: ["postId", "actorId", "publicationType", "targetType", "targetId", "createdAt"], …
}
```

Le contrat d'événement est violé par son seul émetteur. Aucun abonné ne peut consommer `solara.post.published` conformément.

**Note :** le shell deep-importe `apps/solara/src/presentation/solara-view.js` (`bac-orchestrator.ts:50`), alors que `src/server/bac-wiring.ts:11-14` déclare que le serveur ne doit importer que le contrat public `apps/<bac>/src/composition-root.ts` et **jamais** les couches internes. Solara est l'un des apps deep-importés par le shell.

### SOL-P0-04 · La modération est inopérante sur tous les chemins de création

Trois chemins de création existent, **aucun** n'est modéré :

| Chemin | Appelle | Modération ? |
|---|---|---|
| REST | `solara-controller.ts:153` → `socialService.createPost` | ❌ |
| Capability | `src/index.ts:95` → `socialService.createPost` | ❌ |
| Command | `CreatePostHandler` (`src/commands/create-post.command.ts:32`) | ✅ *si dispatché* — mais personne ne dispatche |

Détail :

- `registerContentHook` (`src/domain/social.model.ts:222`) n'est appelé **que depuis le test** (`src/solara.test.ts:107`). En production `contentHooks` est toujours vide → `createPost` (`social.model.ts:245-253`) exécute **zéro hook**.
- `SolaraContentModeratorPlugin` est bien enregistré dans le conteneur (`solara-service-provider.ts:31`) et son hook est branché sur le moteur global (`:33`), mais ce hook n'est *exécuté* que par `CreatePostHandler` (`create-post.command.ts:29-30`) — chemin jamais emprunté.
- `SolaraModerationPipeline` (`src/domain/solara-moderation-pipeline.ts:112`) n'est **jamais instancié**, et son `HumanReviewQueueStage.evaluate` renvoie toujours `approved` (`:77-80`).

→ `responsibilities.md:36` (« Moderation = pipeline a hooks ») et `docs/bacs/02-solara.md:8` ne sont pas satisfaits.

**Seul filtre actif :** `ContentSafetyFilter.filterUnsafe` à la **lecture** (`solara-controller.ts:67`) — suppression silencieuse, sans trace, sans signalement, sans journalisation.

**Crossover central :** l'item central `PLG-04` (« Migration Solara Moderator vers HookEngine — Remplacer import statique par hook solara.post.beforeCreate ») couvre exactement ce défaut. **À faire converger, pas à dupliquer.**

### SOL-P0-05 · Les posts `space` / `group` / `event` sont silencieusement supprimés du fil

`solara-controller.ts:91` :

```ts
const paginated = FeedAggregator.aggregatePaginated(posts, [], { limit, afterCursor });
```

Le 2ᵉ argument est `followedSpaceIds = []`. Or `packages/feed-engine/src/index.ts` enregistre :

```ts
registerFeedTargetFilter("space", (post, ctx) => ctx.spaceIds.has(post.targetId));
registerFeedTargetFilter("group", (post, ctx) => ctx.groupIds.has(post.targetId));
registerFeedTargetFilter("event", (post, ctx) => ctx.eventIds.has(post.targetId));
```

Avec des sets vides → **tout post ciblant un espace, un groupe ou un événement est filtré**.

Or `targetType` est une dimension de premier ordre du modèle Solara : `src/domain/social.model.ts:85,128` (`"feed" | "space" | "group" | "event"`), acceptée par `createPost`, et garantie par le CHECK SQL `posts_target_check` (`20260926130000_harden_solara.ts:66`). Ces posts sont **acceptés, stockés, comptabilisés — et jamais visibles**. Perte de données silencieuse, sans log.

---

## 3. P1 — Architecture & cohérence

| ID | Constat | Localisation | Preuve / comparaison |
|---|---|---|---|
| **SOL-P1-01** | **Tenant codé en dur** `{organizationId: "default"}` alors que `createBoundedAppBootstrap` place le vrai tenant dans le conteneur (`packages/sdk/src/index.ts:267`). Chaque enveloppe d'événement et chaque contrôle de permission de capability est estampillé « default ». | `src/index.ts:88` | Canonique : `apps/spaces/src/index.ts:74-78`, `apps/solidarity/src/index.ts:75-79`, `apps/commerce/src/index.ts:78`, `apps/booking/src/index.ts:72`, `apps/citadelle/src/index.ts:266` (8/11). Impact `packages/sdk/src/index.ts:76,89` |
| **SOL-P1-02** | **Adapter Postgres dans `domain/`** — le taxonomique `app-domain` n'autorise que `framework-foundation` + `sdk` (`eslint.config.mjs:169`), or le fichier importe `@mosaix/ports-database` (framework-port). Invisible au lint : `boundaries` ne résout pas les specifiers nus. | `src/domain/postgres-social-repository.ts:1-7` | 10/10 apps frères placent l'adapter en `src/infrastructure/`. Split canonique : port en `domain/`, adapter en `infrastructure/` (cf. `apps/portfolio/src/domain/vendable-repository.ts` + `apps/portfolio/src/infrastructure/postgres-vendable-repository.ts`) |
| **SOL-P1-03** | **Pas de couche `application/`** alors que `responsibilities.md:15` la déclare. `src/commands/` et `src/events/` ne sont pas des types de couche → `app-general`, qui ne peut pas importer `app-domain` → **2 erreurs eslint**. | `src/commands/create-post.command.ts:2,3` | Emplacements propres : `apps/solidarity/src/application/solidarity-commands.ts`, `apps/portfolio/src/application/portfolio-application.ts` |
| **SOL-P1-04** | **Sortie de l'app vers le shell** (Layer 7 → Layer 5) : dépendance inversée. Aucun API public n'existe — `@mosaix/plugin-engine` n'exporte que la classe, `@mosaix/sdk` rien. `apps/solara/package.json:27` déclare `@mosaix/plugin-engine` **sans jamais l'importer**. | `src/infrastructure/solara-service-provider.ts:10`, `src/commands/create-post.command.ts:4` | Pattern partagé avec `apps/commerce/src/domain/order.service.ts:10` et `apps/imperia/src/domain/plugin-manager.service.ts:2` → **dette de plateforme**, à traiter au niveau repo |
| **SOL-P1-05** | **3 versions divergentes + 2 manifest** : `package.json` 0.1.0 · `mosaix.json` 1.0.0 · `MANIFEST` 1.0.0 · `BacDescriptor.version` **2.5.0** (le plus élevé du repo ; max ailleurs 1.1.0). Noms divergents (« Social & Content » vs « Social Engine »). `themeContract` présent dans le JSON, absent du const TS. | `src/index.ts:23-60`, `mosaix.json:1-63`, `package.json:3`, `src/presentation/solara-view.ts:38` | Aucun script ne compare les deux manifestes : `scripts/validate-manifests.ts` ne lit que le JSON |
| **SOL-P1-06** | **La présentation duplique la logique du contrôleur** : deux implémentations du ranking (`solara-view.ts:222-260` vs `solara-controller.ts:70-83`) et de l'injection sponsor (`interval: 3` vs `interval: 4`). Deux comportements, zéro code partagé. | `src/presentation/solara-view.ts:222-260` | — |
| **SOL-P1-07** | **La capability `solara.feed.read` ignore ses entrées et le repository** : synchrone, mémoire seule, sans pagination ni mode. En production → tableau vide. | `src/index.ts:168-170` | Les 4 autres capabilities persistent au moins |
| **SOL-P1-08** | **Le contrôleur ne publie aucun événement.** Aucun port `EventBus` n'existe dans `packages/ports/`. Le même manque existe sur portfolio — mais ici il est aggravé par P0-3. | `src/infrastructure/solara-controller.ts:134-251` | `grep "app.publish("` sur `apps/` → 7 hits, dans 2 fichiers seulement (`solara/src/index.ts`, `portfolio/src/index.ts`) |

---

## 4. P2 — Logique métier & qualité

### SOL-P2-01 · `likeCount` gonfle à chaque changement de réaction

`src/domain/social.model.ts:429-439` — `incrementLikeCount(targetId, 1)` est appelé pour **toute** réaction, y compris `love` / `angry`, alors que l'upsert DB natural-key (`src/domain/postgres-social-repository.ts:142`) fait qu'un changement `like → love` **ne crée pas de ligne** (contrainte `reactions_one_per_actor_target`).

→ Le compteur dérive du nombre de réacteurs distincts, et compte des réactions « angry » comme des « likes ».

### SOL-P2-02 · Réactions perdues en mémoire ; followers non dédupliqués en mémoire

- `addReaction` (`:419-441`) n'écrit dans **aucune** Map → sans repository, la réaction est **purement perdue**. `SocialRepositoryPort.getReactions` (`:175`) n'a aucun équivalent au niveau service.
- `followActor` (`:368-396`) empile sans contrôle de doublon, alors que la DB a `ON CONFLICT DO NOTHING` sur le quad (`postgres-social-repository.ts:116`) → divergence mémoire/DB.

### SOL-P2-03 · Compteur de commentaires découplé

`addComment` fait `post.commentsCount++` **en mémoire** (`:339`) **et** `repository.incrementCommentsCount(postId, 1)` **en DB** (`:343`) → double comptage après réécriture par l'upsert `savePost` (qui réécrit `likeCount`/`commentsCount` depuis l'objet mémoire).

### SOL-P2-04 · Dual write ambigu, source de vérité non définie, fuite mémoire

Les Maps sont le store primaire, miroir vers la DB. `listFeedAsync` (`:292-306`) fusionne la DB dans les Maps **sans jamais expirer** → posts supprimés toujours visibles, croissance mémoire non bornée (proportionnelle au fil), et ordre d'itération = **ordre d'insertion**, pas l'ordre DB → la capability renvoie un ordre arbitraire.

### SOL-P2-05 · Validation des entrées quasi inexistante

- `actorType` / `targetType` / `actorId` acceptés comme chaînes libres (`solara-controller.ts:136-146`). Les CHECK SQL sont la seule garde ; le chemin mémoire n'en a aucune. → `docs/bacs/02-solara.md:32` prétend « validation au niveau applicatif » : **faux**.
- La validation des métadonnées ne vérifie que la **présence** des champs (`social.model.ts:63-77`), jamais leur type.
- `docs/bacs/02-solara.md:17` annonce une « validation Zod des métadonnées » → **il n'y a aucun Zod dans Solara**.
- Aucune limite de longueur de contenu au niveau applicatif (le seul contrôle, `> 5000` caractères, est dans une étape morte : `solara-moderation-pipeline.ts:50`).

### SOL-P2-06 · Les erreurs serveur sont masquées en 400

`createPost` / `addComment` / `addReaction` convertissent **toute** erreur en `badRequest` (`:164-168`, `:191-195`, `:218-221`) → une panne DB renvoie 400, pas 500. `followActor` (`:227-251`) n'a pas ce try/catch → **500** pour la même classe d'erreur domain. Incohérence interne au même fichier.

### SOL-P2-07 · Classification d'erreur par préfixe de message

`denialOrError` (`:32-41`) teste `err.message.startsWith("Unauthorized")` / `startsWith("Forbidden")` → couplage au libellé exact de `packages/security/src/index.ts:26,40`. Tout changement de wording transforme silencieusement un 401/403 en 500.

### SOL-P2-08 · Permissions codées en dur ; permission ads inadéquate

Les 6 chaînes de permission sont dupliquées entre le manifeste (`src/index.ts:39-44`) et le contrôleur, sans source commune. `trackAdTelemetry` est protégé par `solara:moderate:content` (`:107`) — une permission de **modération** qui garde de la **télémétrie publicitaire**.

### SOL-P2-09 · `Guard` instancié en dur

`solara-controller.ts:16` → `private readonly guard = new Guard();` au lieu d'injection → non mockable, non configurable, non testable en isolation.

### SOL-P2-10 · Personnalisation codée en dur

`solara-controller.ts:71-75` → `userId: "current-user-1"`, `followedSpaceIds: ["space-commerce", "space-events"]`, `interestTags: ["artisanat", "booking", "musique", "tech"]`. La vue utilise `user.id || "Administrateur"` (`solara-view.ts:245`) → **deux identités codées en dur**.

Et les interest tags ne matchent jamais : `ForYouRecommendationEngine` lit `post.metadata.tags` (`packages/feed-engine`), que Solara ne pose jamais. La personnalisation est décorative.

### SOL-P2-11 · Pool de publications sponsorisées codé en dur dans le service métier

`src/domain/social.model.ts:189-209` — une fausse pub intégrée au domaine : « E-Commerce MosaiX », -20 %, `ctaUrl: "/commerce/products/ceramic-vase"` (espace de route de Commerce), `campaignId: "cmp-artisanat-2026"`, `sponsorBadge: "Sponsorisé"`. Injectée **par défaut** (`solara-controller.ts:60` : `sponsored !== "false"`).

`responsibilities.md:40` le signale déjà comme écart ouvert (« formaliser la frontière publicitaire »). Le CTA pointe dans l'espace de route d'un autre BAC → frontière publicitaire non définie.

### SOL-P2-12 · Télémétrie ads : array statique non bornée

`SponsorshipTelemetry` (`packages/feed-engine`) accumule dans un array statique ; `solara-controller.ts:119-125` écrit à chaque requête → fuite mémoire, perte au redémarrage, aucune agrégation, aucun TTL.

### SOL-P2-13 · `publicationType` non contraint ; `PostModel` dérivé de l'interface

`DefaultPublicationType` est `... | string` (`social.model.ts:6-14`) → toute chaîne est acceptée. Et `publicationType` est **absent du modèle ORM** `PostModel` (`:80-92`) → l'ORM a dérivé de l'interface `Post` (`:123-136`).

### SOL-P2-14 · 4 modèles ORM morts

`PostModel`, `CommentModel`, `ReactionModel`, `FollowerModel` (`social.model.ts:80-121`) — le repository écrit en SQL brut, aucun modèle n'est hydraté. `FollowerModel` porte un `declare createdAt: Date;` parasite (`:120`). `ReactionModel["type"]` est le seul usage survivant (`:419`), comme simple alias de type.

### SOL-P2-15 · Placeholder en production

`OpenGraphEmbedParser.parseDummy` (`solara-feed-realtime.ts:40-47`) renvoie « Shared Article » en dur et **lève** sur une URL invalide (`new URL(url)`). Le nom dit lui-même « dummy ».

### SOL-P2-16 · `HumanReviewQueueStage.evaluate` inerte

`src/domain/solara-moderation-pipeline.ts:77-80` renvoie toujours `{ status: "approved" }` — la file de revue humaine ne peut jamais être alimentée.

---

## 5. P3 — Hygiène, dette & documentation

### Code mort & fonctionnalités inertes

| ID | Constat | Localisation |
|---|---|---|
| **SOL-P3-01** | **~400 lignes de code mort** — `FeedScoringEngine`, `OpenGraphEmbedParser`, `SolaraGroupManager`, `SolaraRealtimeNotifier`, `SolaraAnalyticsTracker`, `MentionsAndTagsExtractor`, `SolaraModerationPipeline` : **aucune référence dans tout le repo** (vérifié par grep). `SocialAutoSharePlugin` n'est utilisé que par `tests/backlog-features-2026-09-24.test.ts`. → `responsibilities.md:27` revendique « groupes, realtime, analytics » : rien de tout cela n'est dans l'application qui tourne. | `src/domain/solara-feed-realtime.ts` (125 l.), `src/domain/solara-moderation-pipeline.ts` (154 l.), `src/domain/social-auto-share-plugin.ts` (147 l.) |
| **SOL-P3-02** | `socialAutoSharePlugin` n'écoute pas l'événement qu'il prétend traiter (« Called when event `portfolio.vendable.published` is triggered ») — aucun abonnement. Singleton de module hors DI. | `src/domain/social-auto-share-plugin.ts:62,169` |
| **SOL-P3-03** | Feature flag mort : `solara.comments.reactions` déclaré dans le catalogue shell et dans `packages/ports/feature-flags/src/catalog.ts`, **jamais lu**. | `src/shell/feature-flags.ts:133` |
| **SOL-P3-04** | `solara.moderation.ai_filter` garde un enregistrement **sans effet** (cf. P0-4). | `src/infrastructure/solara-service-provider.ts:29-36` |
| **SOL-P3-05** | Code mort dans le service provider : `container.instance("postgresSocialRepository", ...)` (`:23`) — l'instance est enregistrée mais le service est construit avec la variable locale (`:26`) ; l'entrée n'est jamais résolue. `commandBus.register("CreatePost", ...)` et `commandBus.register(CreatePostCommand.commandName, ...)` enregistrent le même handler sous 2 noms, alors que `CreatePostCommand` déclare `static commandName = "solara.post.beforeCreate"` **et** `readonly commandName = "CreatePost"` — le contrat `Command<CreatePostPayload>` est rompu. | `src/infrastructure/solara-service-provider.ts:23,45-46`, `src/commands/create-post.command.ts:18-19` |

### Packaging & configuration

| ID | Constat | Localisation |
|---|---|---|
| **SOL-P3-06** | `package.json` : **4 dépendances manquantes** (`@mosaix/contracts`, `@mosaix/ports-database`, `@mosaix/migrations`, `@mosaix/support`) et **6 inutiles** (`@mosaix/plugin-engine`, `@mosaix/container`, `@mosaix/http`, `@mosaix/orm`, `@mosaix/events`, `@mosaix/types`). `main`/`types`/`files` pointent vers `./dist/*` alors que le tsconfig émet vers `../../.mosaix/build/apps/solara` → **les points d'entrée publiés n'existent pas**. `eslintBoundaries: { type: "app" }` n'est lu par aucun fichier. | `package.json:7-8,15-33` ; imports : `src/index.ts:7-8`, `composition-root.ts:5`, `domain/postgres-social-repository.ts:6`, `presentation/solara-view.ts:6-11`, `infrastructure/migrations.ts:7` |
| **SOL-P3-07** | `tsconfig.frontend.json` redondant (`tsconfig.json:13` inclut déjà `frontend/src/**/*.ts`) et mal paramétré (`rootDir: "."` avec `include: ["frontend/**/*.ts"]` → sorties sous `frontend/frontend/`) ; référencé par rien. Le `tsconfig.json` ne référence ni `packages/contracts` ni `packages/ports/database` malgré des imports directs. | `tsconfig.frontend.json:1`, `tsconfig.json:11-53` |
| **SOL-P3-08** | `.js` compilés dans `src/` — non trackés (`.gitignore` `*.js`) mais présents sur disque à côté des `.ts` → risque que vitest/tsx résolvent un artefact périmé au lieu de la source. | `src/**/*.js` (13 fichiers) |
| **SOL-P3-10** | **3 sources de migration, 2 schémas, ids divergents.** `src/infrastructure/migrations.ts` crée les tables dans `public` ; `migrations/20260926094000_…` les déplace vers le schéma `solara` ; `migrations/20260926130000_…` durcit. Le provider expose l'id `solara.social.v1.001_create_social_tables` ; `src/shell/bac-migrations.ts:123-125` mappe des ids canoniques **différents** (`solara.social.v1.002_move_to_schema`, `…v1.003_harden_social`) ; l'id réel du fichier (`20260926094000_move_to_solara_schema`) ne correspond à aucun des deux. En outre `migrations.ts` et `migrations/` portent le **même basename**, proscrit par AGENTS.md §10. | `src/infrastructure/migrations.ts:105`, `src/infrastructure/migrations/20260926094000_…:40`, `src/shell/bac-migrations.ts:123-125,357-369` |

### Qualité de build, lint & tests

| ID | Constat | Localisation |
|---|---|---|
| **SOL-P3-11** | **9 erreurs eslint `boundaries/element-types`** sur 5 fichiers. À noter : baseline **repo-wide** (solidarity : 104 erreurs) — le plugin ne résout pas les specifiers `.js` ESM ; la vraie barrière est `no-restricted-imports`, scopée à `src/server/**` uniquement. | `src/commands/create-post.command.ts:2,3`, `src/composition-root.ts:2-4`, `src/index.ts:10-11`, `src/infrastructure/solara-service-provider.ts:9`, `src/presentation/solara-view.ts:12` |
| **SOL-P3-12** | **Couverture de test insuffisante** — 1 fichier / 10 tests, tous sur le chemin in-memory. **Rien** n'exerce le `PostgresSocialRepository` contre le schéma réel, ni le chemin capability/event, ni la cohérence migrations ↔ repository. Les 2 tests « repository » (`:167-224`) se contentent d'un `expect` sur une **chaîne SQL capturée** — ils ne vérifient pas le comportement. | `src/solara.test.ts` |
| **SOL-P3-13** | `tsc --build` cassé au niveau repo (`allowImportingTsExtensions` + `composite`) — **hors périmètre Solara**, mais `apps/solara/tsconfig.json` ne peut donc pas être vérifié isolément ; le build réel passe par `scripts/build.ts`. | root `tsconfig.json:12` |

### Documentation obsolète ou fausse

| ID | Affirmation fausse | Localisation |
|---|---|---|
| **SOL-P3-09** | `README.md:14` → `prd-solara.md` **inexistant** · `README.md:8` → dossier `plugins/` **inexistant** dans l'app · `README.md:12-25` omet `commands/`, `events/`, `domain/postgres-social-repository.ts`, `infrastructure/migrations/` · `src/index.ts:3` → `.project/architecture/canonical-app-schema.md` **inexistant** · `responsibilities.md:15` décrit une couche `application/` inexistante et place le repository en `infrastructure/` (il est en `domain/`) · `docs/bacs/02-solara.md:11-13` décrit les colonnes en **snake_case** (`actor_type`, `likes_count`) alors que le schéma utilise du camelCase quoté (`"actorId"`, `"likeCount"`) · `docs/bacs/02-solara.md:14` présente `categories`/`translations` comme fonctionnelles alors que la migration dit l'inverse (« categories stay unlinked (dead table, no repo) ») · `docs/bacs/02-solara.md:17` → Zod inexistant · la table `solara.reactions` n'est pas listée · `:18` promet une pagination par curseur que la capability ignore · `responsibilities.md:27` revendique « visibilité, realtime, analytics, groupes » : rien n'existe dans l'application qui tourne · `responsibilities.md:55-57` : les 3 critères de santé sont non cochés alors que conformance/manifests passent. | voir colonne |

---

## 6. Divergences spec ↔ implémentation (`docs/bacs/02-solara.md`)

| # | Spec | Implémentation | Verdict |
|---|---|---|---|
| 1 | `:17` « validation Zod des métadonnées » | `PublicationTypeRegistry.validateMetadata` — présence seule, pas de Zod | ❌ |
| 2 | `:11-13` colonnes snake_case | schéma camelCase quoté (`"actorId"`, `"likeCount"`) | ❌ |
| 3 | `:14` `categories` / `translations` = fonctionnalités | « dead table, no repo » (`20260926130000_harden_solara.ts:33-34`) | ❌ |
| 4 | `:4` « pipeline de modération de contenu » | pipeline jamais instancié, hooks vides (P0-04) | ❌ |
| 5 | `:32` « validation au niveau applicatif » (acteurs) | aucune validation applicative, seuls les CHECK SQL (P2-05) | ❌ |
| 6 | `:18` « pagination par curseur » | la capability `solara.feed.read` ignore le curseur (P1-07) | ⚠️ partiel |
| 7 | table `solara.reactions` non listée dans §3 | existe, avec contraintes dures | ⚠️ incomplet |

---

## 7. Ce qui est sain — à préserver

Voir index §7 pour le détail. En bref : les 3 migrations (documentées, durcies, **effectivement branchées**), le `PostgresSocialRepository` (adapter propre), le `PublicationTypeRegistry` (extension de vocabulaire), les schémas d'événements versionnés JSON Schema, et l'intention de `Guard.authorize` sur chaque route.

---

## 8. Méthode & limites

**Limites explicites :**

- Audit **en lecture seule** : aucun correctif n'a été appliqué, aucun test n'a été ajouté.
- Le comportement runtime n'a pas été observé en exécution (pas de boot de la plateforme) : les constats P0-2/P0-3 sont établis par **absence d'appelant** (grep exhaustif sur `src/`, `packages/`, `apps/`, `bootstrap/`), pas par observation directe.
- Les constats P0-1 et P0-05 sont établis par lecture de code croisé (namespace + registre de filtres de `feed-engine`) et par le **test** `Guard.authorize` de `packages/security` (comparaison exacte). Une exécution contre un principal réel serait la confirmation definitiva.
- `tsc --build` n'a pas pu servir de preuve (P3-13) ; la preuve typecheck retenue est `npx tsc --noEmit -p tsconfig.json` (0 erreur sur Solara).
- Les findings « baseline repo-wide » (eslint boundaries, duplication `MANIFEST`, `dist/` vs `.mosaix/build/`, absence de `application/` dans 9 apps sur 11) **ne sont pas imputés à Solara** : ils sont signalés comme dette de plateforme, avec la part propre à Solara isolée.

**Commandes exécutées (reproductibles) :**

```powershell
npx tsc --noEmit -p tsconfig.json
npx vitest run apps/solara
npx tsx scripts/validate-conformance.ts
npx tsx scripts/validate-manifests.ts
npx eslint apps/solara
```
