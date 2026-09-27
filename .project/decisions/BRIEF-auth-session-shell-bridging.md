# BRIEF — Auth/session réelle côté shell : existant, problème, second avis demandé

**Status :** DRAFT — document de consultation (pas une décision).
**Date :** 2026-09-27.
**Objectif :** recueillir un second avis (Claude) sur la façon d'implémenter une auth/session réelle côté shell, dans le respect des décisions déjà actées.
**Question centrale :** comment brancher une session réelle sur le shell SSR, qui doit posséder quoi, et par où commencer — sans violer ADR-0012 ni ADR-0016 ?

---

## 1. Décisions déjà actées (cadre non négociable sauf remise en cause explicite)

### ADR-0012 — Platform Auth vs Identity Workflows (Accepted, 2026-08-19)

Règle immuable : **1 User → 1 Platform Authentication → 1 Platform Session → N Applications.**

- **Platform Auth (`@mosaix/auth`, Layer 4 framework-primitive)** : possède l'état d'authentification plateforme, les tokens et **l'unique session plateforme**. Ne dépend JAMAIS de l'app Identity.
- **Identity (à l'époque `apps/identity`, aujourd'hui `apps/citadelle`)** : fournit les workflows user-facing (login, logout, registration, credentials) **en consommant** les primitives Platform Auth.
- **Applications** : consomment le contexte d'auth unique ; leurs règles d'autorisation fines restent leur propriété.

### ADR-0016 — BAC ownership and boundaries

Chaque bounded context possède son domaine, ses interfaces et ses contrats. Le shell reste un hôte (routage, SSR, composition), pas un domaine métier. Les imports directs shell→BAC et BAC→shell sont des violations connues et documentées (cf. rapports d'audit `analyses/`, `.project/reports/audit-injection-extensibilite-2026-09-24.md`).

---

## 2. Existant vérifié (facts, code lu)

### 2.1 `packages/auth` — la mécanique (Layer 4, testé)

`packages/auth/src/` : `auth-manager.ts` (`AuthManager implements SessionCreationPort`, providers Map + identity/session/credential/token stores + ChallengeManager, scrypt via providers), `session-manager.ts` (create/ENS TTL défaut 3600s, `SessionStore` port), `token-manager.ts`, `jwt-service.ts` (HMAC-SHA256, `timingSafeEqual`, `exp`, `resolveJwtSecret()` fail-fast prod — cf. changelog), `challenge-manager.ts`, `provider-registry.ts`, `oidc-bridge.ts` + `oauth/` (google/apple/microsoft/github/facebook).
Charte (`responsibilities.md`) : ne stocke rien (délègue aux ports), aucune logique métier applicative, pas de duplication.
Consommateurs réels : `packages/gateway` (`gateway.ts` : `JwtService`, `validateJwt`, rate-limiters auth), `apps/citadelle` (`index.ts:9` : `AuthManager`, `identity-controller.ts:1` : type-only).

### 2.2 `apps/citadelle` — le domaine identité (BAC)

- Stores : `SQLiteIdentityStoreAdapter` / `PostgresIdentityStoreAdapter`, credential/token stores sqlite+pgsql, `SQLiteSessionStoreAdapter`. Fallbacks `InMemory*` **avec** `InMemoryGuard.reportFallback` (`index.ts:105,135`, `composition-root.ts:139`, `index.ts:78,92`).
- **Trou : pas de `PostgresSessionStoreAdapter`** (`index.ts:121-141` : commentaire explicite, fallback InMemory assumé + backlog). Sur pgsql, toute construction de `CitadelleAdapters` sans `sessionStore` injecté passe par le guard.
- **Trou : `InMemorySecretsAdapter` construit sans guard** (`index.ts:160`).
- `IdentityController` : `handleLogin` (email+password → `authManager.authenticate`, 503 si pas d'AuthManager — pas de token mock), `handleLogout`, `handleRefresh`, `getProfile`, `handleRegister`. `index.ts:198-205` : `router.post("/login"|"/register"|"/logout"|"/refresh")`, `router.get("/profile")`.
- **Ce router BAC n'est jamais monté sur le HTTP du shell** (vérifié : `src/server/api-dispatcher.ts` ne référence Citadelle nulle part ; le shell sert les BAC via descripteurs SSR `BacDescriptor.render()`, pas via leurs routers).
- `src/server/routes/auth-routes.ts` : seul pont existant = **wizard d'inscription** (`RegistrationWizardService` importé **en direct** depuis `apps/citadelle` — violation de couches déjà signalée en audit). Pas de login, pas de session.
- Vues SSR (`presentation/citadelle-view.ts`) : tabs profile/users/security, table `USERS` **mock en dur** (Administrateur, Sarah Connor, John Doe), fausse session « Chrome (Session Actuelle), Paris, IP 192.168.1.5 ». (Gate demo en cours, §4.)
- Migrations : tables `identities`/`credentials`/`tokens` shell-owned + `citadelle_*` réservées non branchées (ownership DB en backlog : DB-BAC-OWNERSHIP).

### 2.3 Shell SSR — aucun concept de session

- `src/shell/profiles.ts` : `USER_PROFILES` (3 personas mock), `getActiveUserProfile()` (cookie `mosaix_role` + `?role=`), `getActiveSpaceProfile()` (DB). `src/start.ts` : `currentUser` → pages SSR + dispatcher API.
- Pas de page `/login`, pas de cookie de session, pas de résolution JWT/session côté shell. Rate-limit strict déjà en place sur `/api/auth`, `/api/login` (`start.ts:70-76`).
- `isDemoMode()` : canonique, désormais dans `@mosaix/support/src/demo-mode.ts` (partagé shell + BACs), ré-exporté par `profiles.ts`.

### 2.4 Gateway / mobile

- `packages/gateway` : edge HTTP natif (pipeline, OpenAPI, CORS, security headers), `validateJwt`, `AuthRateLimiterMiddleware`. JWT = transport service/mobile.
- `packages/mobile-bridge` : `auth-code-store`, `refresh-token-store`, `device-registry-adapter` (persistants, récents).

---

## 3. Problème

**Avec `MOSAIX_DEMO_USERS=false`, l'UI ne doit afficher aucune donnée mock — mais il n'existe aucun chemin d'auth réelle côté shell.** Conséquences concrètes :

1. Le usermenu ne peut pas afficher « Login / Register » utilement : aucune page ni endpoint de login n'est exposé au shell.
2. Le backend de login existe (Citadelle) mais est inatteignable en HTTP.
3. Les stores de session sont incomplets sur pgsql (adapter manquant) et les secrets sont en mémoire sans garde.
4. Toute rustine (ex. bouton vers `/identity`) pointerait vers des vues à contenu mock → affordance de sécurité mensongère.

**Question :** quel découpage d'implémentation respecte ADR-0012/ADR-0016 tout en donnant au shell une session réelle, et par quoi commencer ?

---

## 4. Travaux en cours (non commités, session du 2026-09-27)

Kill-switch démo global quand `MOSAIX_DEMO_USERS=false` (ou prod) :
`src/shell/profiles.ts` (cookie `mosaix_role` ignoré + `LOCAL_USER_PROFILE` neutre, mêmes droits member, sans persona), `src/server/routes/feed-routes.ts` (fallback mock `feedStore` désactivé, `[]` sur DB vide), `src/shell/feed-service.ts` (`seedInitialFeedIfEmpty` no-op), `src/shell/seeders/database-seeder.ts` (refus fail-fast), `scripts/setup-sqlite.ts` (skip seeds), `src/shell/feature-flags.ts` (construction sans DB refusée), `packages/support/...` (`demo-mode.ts` canonique, `InMemoryGuard` lève aussi quand démo off), `apps/citadelle/.../citadelle-view.ts` (table USERS + fausse session gatées), `src/shell/renderer.ts` (email fabriqué remplacé par « accès local »), `.env.example` (sémantique documentée). Tests : 21/21 verts sur le périmètre (profils, seeder, support, citadelle) ; boot vérifié `:3101–3103` avec démo off (`/api/feed` → `[]`, plus de personas dans le HTML).

---

## 5. Options envisagées

### Option A (recommandée) — Moteur `packages/auth` + ownership Citadelle + résolution shell

1. **Résolveur session shell** (`src/server/auth/session-resolver.ts`, nouveau) : cookie opaque `mosaix_session` → `AuthManager` **unique** résolu via le container (instance de la composition Citadelle, pas de duplication) → mapper session→`UserProfile`. Sans session valide → `LOCAL_USER_PROFILE` (démo off) ; chemin démo inchangé quand démo on.
2. **Endpoints shell→Citadelle** : `POST /api/auth/login|logout`, `GET /api/auth/me` qui **délèguent** à l'`IdentityController` du container + posent/effacent le cookie HttpOnly/Secure/SameSite. Corrige au passage l'import direct du wizard (passer par le container).
3. **UI** : usermenu démo-off/sans-session → boutons Login/Register → formulaire branché ; register → wizard existant.
4. **Gaps persistance** : `PostgresSessionStoreAdapter`, secrets persistants + guard sur `InMemorySecretsAdapter`, persistance du wizard.
5. **ADR-0017** `auth-session-shell-bridging` : consigne la règle « auth=mécanique, Citadelle=domaine, shell=transport/résolution ».

Transport : **cookie de session opaque** (sessions serveur = design existant) pour le SSR ; **JWT** conservé pour gateway/mobile/service-to-service. Les deux coexistent déjà dans le codebase.

### Option B — Tout dans Citadelle (y compris la mécanique session/cookie)

Rejetée : dupliquerait la mécanique déjà consommée par gateway/mobile, et contredirait la charte de `@mosaix/auth` + ADR-0012 (la session plateforme n'appartient pas à un BAC).

### Option C — Session possédée par le shell

Rejetée : l'identité est un domaine, le shell doit rester un hôte ; créerait le même couplage que les audits dénoncent déjà.

---

## 6. Questions ouvertes pour le second avis

1. Le découpage A respecte-t-il correctement ADR-0012, ou le « résolveur shell » fait-il du shell un second propriétaire de session déguisé ? Faut-il plutôt un `SessionResolver` dans `packages/auth` consommé par le shell ?
2. Cookie opaque vs JWT HttpOnly pour le SSR : le codebase a les deux écoles (sessions serveur côté auth, `JwtService` côté gateway). La coexistence proposée est-elle tenable, ou faut-il converger (ex. JWT court + refresh, sessions révocables uniquement) ?
3. Ordre des phases : résoudre d'abord le transport (1+2 sans UI), ou livrer UI+endpoints ensemble pour éviter des endpoints sans consommateur ?
4. `PostgresSessionStoreAdapter` manquant : le construire (nouveau package adapter, doctrine `packages/adapters/`) ou brancher Redis (`packages/adapters/*redis*` existe ?) avec un vrai client — sachant que le guard lève désormais en démo-off/pgsql ?
5. Failles à ne pas rater : fixation de session au login (rotation d'ID ?), `SessionManager` TTL/refresh actuel suffisant ?, mapping session→permissions (relecture DB à chaque requête vs cache), révocation (logout + GDPR), rate-limit login (existant : suffisant ?), CSRF sur cookie SameSite=Lax + POST (faut-il un token anti-CSRF ?).
6. La trajectoire invalide-t-elle quelque chose d'ADR-0012 (qui parle d'`apps/identity`, aujourd'hui `apps/citadelle`) ou faut-il un amendement de traçabilité ?
7. Risques sous-estimés dans les phases (régression démo-on, perfs résolution par requête, migration des cookies existants `mosaix_role`) ?

---

## 7. Contraintes

- Sécurité : risque High/Critical — validation humaine aux points sensibles, pas de secret en dur, pas de contournement des guards.
- Non-régression : mode démo (défaut dev) inchangé ; `pnpm test` vert ; boot sqlite+pgsql.
- Traçabilité : ADR-0017 à écrire avant/après implémentation selon l'avis reçu.

---

## 8. Second avis reçu (Claude, 2026-09-27) — RETENU sous forme A'

L'avis corrige l'Option A sur deux points structurants, intégrés dans `ADR-0017-auth-session-shell-bridging.md` (DRAFT) :

1. **`SessionResolver` = primitive `@mosaix/auth`** (`resolve(sessionId) → PlatformSessionContext`), pas service métier du shell. Le shell ne fait qu'adaptateur HTTP + projection SSR. Le mapping `UserProfile` reste hors auth.
2. **Pas de `shell → IdentityController`** (même via container) : ports capability (`IdentityAuthenticationPort`, `IdentityRegistrationPort`, `IdentityProfilePort`) implémentés par Citadelle ; `/api/auth/me` scindé en `/api/auth/session` (Platform Auth) vs profil (domaine).

Points confirmés : cookie opaque SSR + JWT gateway/mobile (coexistence documentée), `__Host-` + CSRF dès v1, rotation obligatoire, TTL triple, pas de permissions dans le cookie, Postgres avant Redis, `InMemorySecretsAdapter` = release blocker, phases 0→4 avec **aucun endpoint login public avant les garanties** (Phase 1 sans `/login`), gate sécurité entre Phase 2 et 3.

---

## 9. Second avis (Claude, 2026-09-27) — CORRIGE le précédent sur 3 points

L'avis ChatGPT (§8) était juste sur le fond mais insuffisant sur la **construction** et le **phasage**. Corrections retenues, intégrées dans `ADR-0017` :

1. **Composition root partagé (structurant, à trancher en premier).** « Résolu via le container (instance Citadelle) » = dépendance shell→BAC déplacée du statique vers le DI, toujours interdite par ADR-0016. Règle : **lecture** (résolution SSR) → primitive `@mosaix/auth` directe, comme `gateway → validateJwt` ; **écriture** (login/logout/register) → traverse Citadelle via ports ; **construction unique** `AuthManager`/`SessionStore` dans `bootstrap/`, en amont des deux (contre-exemple actuel : `createCitadelleApp`/`createCitadelleComposition`).
2. **Tranche verticale flaggée, pas phases horizontales.** Ni « transport seul » ni « tout d'un coup » : resolver + endpoints + formulaire minimal + tests e2e, derrière flag. Un endpoint login public sans UI/test qui l'exerce = surface d'attaque non exercée en zone security-critical.
3. **ADR après implémentation** (la décision composition-root éclairera mieux la règle), + erratum ADR-0012 (`apps/identity` → `apps/citadelle`). Divergences annexes tranchées : refresh à vérifier côté `SessionManager` (sinon déconnexions horaires), rate-limit clé IP+identifiant, lookup DB simple puis mesure avant tout cache, `mosaix_role` vs `mosaix_session` à ne jamais confondre (vérification explicite), chantier démo-off (`profiles.ts`) séquencé comme **un seul chantier** avec le resolver.

---

## 10. Troisième avis (autre LLM, 2026-09-27) — CONVERGENT, 2 apports

Même conclusion (A' + Composition Root partagé + tranche verticale flaggée), avec :

1. **Garde-fou composition-root** : reste un assembleur de dépendances — pas un service central métier, pas un nouveau BAC, pas un contournement des contrats. Objection principale à surveiller. Structure cible proposée et mappée aux chemins réels dans `ADR-0017` (le `src/bootstrap/` du brief d'origine n'existe pas : c'est `bootstrap/` racine).
2. **Checkpoints merge explicites** : restart (session valide survit, révoquée non), isolation inter-utilisateurs, relecture autorisation, mesure perf avant cache, rate-limit IP+identifiant, tests démo on/off, révocation multi-cas. Intégrés dans `ADR-0017` § Validation.
3. **Règle resolver** : ne jamais fabriquer de démo en cas d'échec (intégré invariant 8).

Consensus à 3 avis : ownership (auth=mécanique, Citadelle=domaine, shell=transport), cookie opaque SSR + JWT gateway, PG avant Redis, rotation/CSRF/secrets dès v1, tranche verticale flaggée, ADR final après implémentation. Point d'entrée : décision composition-root.
