# Audit — Implémentations qui contournent le système de base de données MosaiX

Date : 2026-09-26 · Portée : `src/`, `apps/*/src`, `scripts/`, `packages/*/src` (runtime, hors tests/docs)
Référentiel officiel : `DatabasePort` → adapters (`database-sqlite`) → `DatabaseManager` → moteur de migrations
(`@mosaix/migrations` : Registry → Planner → Runner, ledger `mosaix_migrations`) → CLI `mosaix migrate` → boot fail-fast si migrations pendantes.

Bonne nouvelle : le socle est sain — `node:sqlite` n'est importé que par l'adapter, le ledger framework (`sql-store.ts`),
le registre agrégé (`src/shell/migration-registry.ts`), le câblage CLI et le fail-fast au boot sont en place.
Ce qui suit, ce sont les **fuites autour** de ce socle.

---

## 1. CRITIQUE — risque de perte/corruption de données

### F1. Feed : double écriture mémoire + DB, schémas divergents
- `src/shell/feed-store.ts` — `Proxy` sur tableau mémoire + `savePostToDb()` best-effort (`.catch` loggé) + DDL propre
  (`shell_feed` avec `author_role, author_avatar, bac_source`, **sans** `category/tags/space_id`).
- `src/shell/feed-service.ts` — `FeedService` 100 % DB, schéma `shell_feed` aligné sur la migration core
  (`category/tags/space_id`, sans `author_role/...`).
- `src/server/routes/feed-routes.ts:39-50` — POST écrit aux **deux** (mémoire d'abord, DB en `.catch(() => null)` **silencieux**) ;
  GET préfère la DB puis retombe sur la mémoire (`:101`).
- Conséquences : redémarrage = perte des posts mémoire ; contenus DB/mémoire divergent ; si `initFeedStore()` tourne un jour
  contre une DB migrée, ses INSERT échouent (`no such column: author_role`) — silencieux.
- Fait aggravant : `initFeedStore()` n'est **appelé par personne** (DDL mort), mais `feedStore` mémoire est lu par
  `feed-routes.ts` et `compliance-routes.ts:124`.

### F2. `commerce_orders` : trois définitions, un seul nom de table
- Migration Postgres `apps/commerce/src/infrastructure/migrations.ts:19` (camelCase `userId/vendableId/customerId`, enum de statuts, modèle enchères).
- DDL runtime `apps/commerce/src/infrastructure/order.repository.ts:13-27` (snake_case minimaliste, autre jeu de colonnes).
- Migration sqlite `src/shell/database/core-migration.ts` (encore un autre jeu : `title/price/stock...`).
- Le premier arrivé gagne (`IF NOT EXISTS`) ; les autres cassent en silence (`.catch(() => null)` ligne 26).

### F3. `user_subscriptions` : même pattern + bricolage de placeholders
- `apps/subscription/src/domain/subscription.service.ts:24-58` — DDL dans le constructeur, miroir `Map` mémoire + relecture DB,
  erreurs avalées (`.catch(() => [])`, `.catch(() => null)`), et `formatQuery()` qui réécrit `?` → `$n` à la main
  (doublon de ce que le store/adapter doivent posséder).

### F4. Bug live : `feedService.listFeed()` n'existe pas
- `src/server/routes/mobile-routes.ts:237` appelle une méthode absente de `FeedService` (tsc le signale déjà) → 500 à chaque appel.
  Symptôme typique de la dérive F1.

## 2. HIGH — contournement du moteur de migrations

### H1. `scripts/init-dev-admin.ts` : script mort + DDL divergent
- Référencé **nulle part** (ni `package.json`, ni docs, ni CLI). Recrée `identities` en 5 colonnes contre 10 dans la migration core.
  S'il est un jour exécuté sur une base fraîche, il fige un schéma étroit.

### H2. DDL défensif dans des méthodes qui ne sont jamais appelées
- `packages/core/src/platform-settings.ts:67` (`CREATE TABLE` dans `PostgresPlatformSettingsStore.init()`) et
  `packages/core/src/tenant-schema-manager.ts:22` (table `*_metadata`) — aucun appelant dans `src/`.
  Pas dangereux aujourd'hui, mais c'est le précédent « DDL hors migrations » qui a produit F2/F3.

### H3. `core-migration.ts` : SQL brut monolithique
- Passe par le moteur (checksum, ledger, `down`) : conforme. Mais blob de ~260 lignes / 20 tables multi-BAC en SQL brut
  (pas de `SchemaBuilder`, donc pas de validation grammaire), et son en-tête annonce déjà la cible :
  propriété par BAC. Prochaine table ajoutée ici = dette qui grandit.

## 3. MEDIUM — mémoire / fichiers au lieu de la base

| # | Cas | Fichier | Effet |
|---|-----|---------|-------|
| M1 | Feature flags persistés en JSON | `src/shell/feature-flags.ts` (`.mosaix/feature-flags.json`) | Mono-instance, pas de concurrence ni d'historique ; le nom `Persistent…Manager` sur-vend un fichier local |
| M2 | Overrides de composition en JSON | `src/shell/editor.ts` (`.mosaix/composition-overrides.json`, écrit par l'admin via `/api/theme/preset`) | Même classe que M1, écritures admin hors base |
| M3 | `platformSettingsService` (core) sur `InMemory` par défaut ; impl Postgres jamais instanciée dans `src/` ; contrôleur imperia `new PlatformSettingsService()` sans repository | `packages/core/src/platform-settings.ts:158`, `apps/imperia/src/infrastructure/imperia-controller.ts:20` | Choix admin non persistés (constaté : seul le thème platform a été migré vers sqlite) |
| M4 | `InMemoryThemeAssignmentsStore` en fallback du bridge | `src/shell/theme/theme-bridge.ts` | OK en repli, mais les assignations d'entités ne sont toujours pas résolues par requête (V2.3 incomplet côté lecture) |
| M5 | `feedStore` mémoire (voir F1) | `src/shell/feed-store.ts`, `feed-routes.ts`, `compliance-routes.ts` | — |

## 4. Vérifié propre — aucune action
- `node:sqlite` importé uniquement par `packages/adapters/database-sqlite` ;
- ledger framework, registre agrégé, CLI `migrate/status/rollback`, fail-fast au boot ;
- migration thème `shell.theme.v1.001` via le moteur (+ tests) ;
- `migrations.ts` des apps (Postgres) bien formées — le problème est qu'elles sont **court-circuitées au runtime**, pas leur forme ;
- `migration-governance.service.ts` : chaînes SQL de **preview** uniquement.

---

## 5. Items backlog proposés (prêts à intégrer)

| ID | Titre | Portée | Criticité |
|----|-------|--------|-----------|
| DB-BYPASS-01 | Supprimer `src/shell/feed-store.ts` (DDL + Proxy) ; routes feed 100 % `FeedService` ; erreurs DB non silencieuses | `feed-store.ts`, `feed-routes.ts`, `compliance-routes.ts` | CRITIQUE (F1) |
| DB-BYPASS-02 | Réconcilier `commerce_orders` : un schéma canonique (migration), supprimer le DDL de `OrderRepository`, brancher le repo sur la migration | commerce + core-migration | CRITIQUE (F2) |
| DB-BYPASS-03 | Idem `user_subscriptions` : migration dédiée, supprimer DDL constructeur + `formatQuery` manuel | subscription | CRITIQUE (F3) |
| DB-BYPASS-04 | Corriger `mobile-routes.ts:237` (`listFeed` inexistant → `getFeed`) + test de non-régression | mobile-routes | CRITIQUE (F4, bug live) |
| DB-BYPASS-05 | Supprimer ou migrer `scripts/init-dev-admin.ts` (script mort, DDL divergent `identities`) | scripts | HIGH (H1) |
| DB-BYPASS-06 | Interdire le DDL hors migrations : règle lint/grep-guard CI (`CREATE TABLE` hors `*.migration.*`, `migrations.ts`, tests) | CI | HIGH (H2, prévention) |
| DB-BYPASS-07 | Découper `core-migration.ts` par BAC (chaque app possède ses tables) | shell/database + apps | HIGH (H3, struct.) |
| DB-BYPASS-08 | Flags + overrides composition : décider base vs fichier (si base : tables + migrations + store ; si fichier : documenter mono-instance) | feature-flags, editor | MEDIUM (M1/M2) |
| DB-BYPASS-09 | Brancher un settings store persistant dans le shell (finir M3 : écriture admin des paramètres plateforme) | core/imperia/shell | MEDIUM (M3) |
| DB-BYPASS-10 | Résolution du thème par requête (lire `theme_assignments`, entity-first) pour clore V2.3 côté lecture | theme-bridge/persistence | MEDIUM (M4) |

Règle proposée (DB-BYPASS-06) : tout `CREATE TABLE` hors moteur = échec CI, avec allowlist explicite
(moteur, grammaires, tests, seeders versionnés).

---

## 6. Extension — sessions, auth/identités et autres aspects gérés

Même méthode : comparer ce que le framework gère (ports/adapters) avec ce que le runtime fait réellement.

### S0. Constat racine : il n'y a pas d'authentification réelle au runtime
- Login = cookie démo `mosaix_role` (`src/server/routes/user-routes.ts:17-46`), sans mot de passe, sans ligne de session,
  sans JWT émis ni vérifié dans `src/` (`JwtService`/`resolveJwtSecret` : zéro usage hors boot-check).
- `identityStore` construit dans `database-bootstrap.ts:104` mais **jamais lu** (zéro appelant).
- Tables `sessions`/`tokens`/`credentials` : écrites **uniquement** par les DELETE GDPR
  (`anonymization-orchestrator.ts:57-63`), jamais insérées ni lues. `revoked_at` n'est vérifié nulle part.
- `init-dev-admin.ts` crée un admin que rien ne lit (script mort, voir H1).
- Conséquence : tout le reste ci-dessous gravite autour d'une session qui n'existe pas — chaque contournement
  est à lire comme dette **bloquante pour une vraie auth**, pas comme bug isolé.

### S1. Sessions mobiles : 3 Maps mémoire, aucun sweep, fuite + perte au restart — CRITIQUE (sécurité)
- `src/server/routes/mobile-routes.ts:26` — `authCodes` (codes PKCE, expiry lazy seulement, pas de purge : fuite mémoire).
- `packages/mobile-bridge/src/auth/refresh-token-rotator.ts:31` — `static sessions` (rarévocation testée `:95`, bien,
  mais mémoire process : perte au restart = déconnexion massive + pas de partage inter-instances).
- `packages/mobile-bridge/src/push/device-registry.ts:20` — `static devices` (registrations push volatiles).
- Fait aggravant `mobile-routes.ts:147` : `userId: currentUser.id || "Lord Cheteck"` — identité réelle hardcodée en fallback.

### S2. Mots de passe en clair dans un Map non expiré — CRITIQUE (sécurité)
- `apps/citadelle/src/domain/registration-wizard.service.ts:50-56` — brouillons en `Map` mémoire avec `step1.password` **en clair**.
- `ttlMs` (24 h, ligne 51) est **déclaré mais jamais appliqué** (`getDraft` ne vérifie rien) : croissance non bornée,
  message « expirée » mensonger, et `finalizeRegistration` (`:161-196`) ne transmet **même pas** le mot de passe
  à `userService.create` — collecté pour rien. De plus `finalizeRegistration` n'est appelé par **aucune route**
  (`auth-routes.ts` : start/get/step uniquement).

### S3. Double monde DI : singletons shell vs Container apps — MEDIUM (testabilité)
- `src/` n'utilise jamais le `Container` (seul `theme-bridge.ts:130` le lit en défensif) : `FeedService`,
  `platformFeatureFlags`, `feedService`, wizards sont des singletons de module (`new` inline).
- Les apps passent par providers + `container.resolve`. Deux doctrines cohabitent ; les singletons shell sont
  incoulables sans effet de bord process (cf. tests obligés au `:memory:` par injection manuelle).

### S4. IDs faibles bricolés vs packages `id-uuid`/`id-ulid` — MEDIUM
- `src/shell/feed-service.ts:37` — `feed_${Date.now()}_${Math.random()…}` (collisions + prévisibilité).
- `mobile-routes.ts:145` — `crypto.randomBytes` inline (correct mais hors adapter `crypto-node`/`id-*`).
- Les ports existent (`id-uuid`, `id-ulid`, `crypto-node`) et ne sont pas utilisés côté shell.

### S5. Push FCM en `isMockMode: true` par défaut — MEDIUM (comportement prod mensonger)
- `packages/mobile-bridge/src/push/fcm-push-adapter.ts:17` — l'endpoint `/api/mobile/push/test` répond `success: true`
  sans rien envoyer. Acceptable en dev, dangereux sans garde-fou prod explicite.

### Vérifié propre — aucune action
- Aucun `fetch(` serveur dans `src/` (pas de HTTP sortant sauvage) ;
- `registration-wizard` : `finalize` supprime le brouillon (`drafts.delete`) quand il est appelé ;
- `PkceValidator`/`RefreshTokenRotator` : logique de rotation correcte (rejet `previousRefreshTokens`, expiry) —
  seul l'hébergement (mémoire) est en cause.

---

## 7. Items backlog proposés — extension sessions/auth/aspects

| ID | Titre | Portée | Criticité |
|----|-------|--------|-----------|
| SES-01 | Persister sessions mobiles + codes PKCE + devices (tables `mobile_sessions`, `mobile_auth_codes`, `mobile_devices` via migrations ; TTL + purge) ; supprimer le fallback `"Lord Cheteck"` | mobile-bridge, mobile-routes, shell/database | CRITIQUE (S1) |
| SES-02 | Mots de passe wizard : ne jamais stocker en clair (hash immédiat ou ne collecter qu'à `finalize`), appliquer le TTL 24 h + purge, brancher `finalizeRegistration` à une route ou supprimer le wizard | citadelle, auth-routes | CRITIQUE (S2, sécurité) |
| SES-03 | Trancher l'auth runtime : soit brancher `identityStore` + sessions DB + JWT (fin du mode démo permanent), soit acter officiellement `demo-only` avec garde-fous (le statut quo hybride est le pire des cas) | shell, citadelle, core | CRITIQUE (S0, décision) |
| SES-04 | Vérifier `revoked_at` (sessions/tokens) sur chaque requête authentifiée une fois SES-03 tranché | shell | HIGH (découle de S0) |
| SYS-01 | Converger l'injection : `Container` (ou équivalent) dans le shell au lieu des singletons de module ; à défaut, documenter les deux mondes et la règle | shell, apps | MEDIUM (S3) |
| SYS-02 | Utiliser les ports `id-*`/`crypto-node` dans le shell (`feed-service`, `mobile-routes`) ; interdire `Math.random()` pour les IDs (lint) | shell | MEDIUM (S4) |
| SYS-03 | FCM : `isMockMode` interdit en prod (fail-fast au boot si `MOSAIX_ENV=production` sans credentials) | mobile-bridge | MEDIUM (S5) |
| SYS-04 | Supprimer `feedService.listFeed` OU l'implémenter (doublon de DB-BYPASS-04 côté mobile) | mobile-routes | CRITIQUE (bug live, cf. F4) |

---

## 8. Industrialisation — suite `integrity` dans `@mosaix/conformance`

L'audit ci-dessus est désormais exécutable : `packages/conformance/src/suites/integrity.ts`
(8 règles, 8 tests) + `pnpm check:integrity` (report par défaut, `--strict` pour CI).
État initial mesuré : **54 findings (22 error / 32 warn)** — tous les cas F/H/M/S de ce rapport sont retrouvés,
plus des inédits ci-dessous (déjà reversés en backlog).

Règles : `no-ddl-outside-migrations`, `no-direct-sqlite-driver`, `no-swallowed-db-errors`,
`no-memory-session-stores`, `no-plaintext-password-defaults`, `no-direct-identities-sql`,
`no-math-random-ids`, `no-mock-in-prod-path` — allowlists explicites (moteur, grammaires, adapters,
previews gouvernance, anonymisation GDPR). Prochaine étape : `--strict` en CI après résorption (DB-BYPASS-06).

Découvertes inédites du scan (hors audit manuel) :

| ID | Titre | Fichier |
|----|-------|---------|
| SES-05 | Brouillons mémoire non expirés (même pattern que le wizard citadelle) | `apps/portfolio/.../product-wizard.service.ts:77`, `apps/solara/.../social-auto-share-plugin.ts:36` |
| SES-06 | Credential store 100 % mémoire avec IDs `Math.random()` | `apps/citadelle/src/infrastructure/in-memory-credential-store.ts` |
| SYS-05 | IDs `Math.random()` dispersés (booking, commerce, imperia, solara, spaces, subscription…) — chantier d'ensemble SYS-02 confirmé : 18 occurrences | divers (voir `pnpm check:integrity`) |


