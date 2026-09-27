# ADR-0017 — Auth Session Shell Bridging (A' : Platform Auth session bridge)

**Status:** Draft (proposed 2026-09-27, deux second avis intégrés — ChatGPT puis Claude — en attente de validation humaine avant implémentation).
**Date:** 2026-09-27.
**Deciders:** Platform Architecture Review (proposé par l'agent, revu par ChatGPT puis Claude).
**Amends (traçabilité, sans changement de fond) :** ADR-0012 (`apps/identity` → `apps/citadelle`, continuité de nom/ownership).
**Références :** ADR-0012 (Platform Auth vs Identity), ADR-0016 (BAC ownership), `BRIEF-auth-session-shell-bridging.md` (existant vérifié + consultation).

---

## Context

ADR-0012 acte : `@mosaix/auth` possède l'unique session plateforme ; l'app identité fournit les workflows en consommant ses primitives. Mais le shell SSR n'a aucun concept de session (`mosaix_role` démo, aucun `/login`, routers BAC jamais montés sur HTTP), et `MOSAIX_DEMO_USERS=false` interdit désormais tout mock/in-memory (kill-switch implémenté, non commité). Il faut donc brancher une session réelle sans créer un second propriétaire de session ni violer ADR-0016.

Second avis (Claude, 2026-09-27) : garder l'intention de l'Option A du brief, mais **ne pas faire du shell un consommateur direct d'`IdentityController`** (même via container) et **ne pas loger un `SessionResolver` métier dans le shell**. D'où l'option A' ci-dessous, retenue.

---

## Decision (A')

> **Le shell ne possède jamais une session. Il possède uniquement son adaptation HTTP et consomme le contexte de Platform Auth. `@mosaix/auth` est l'unique propriétaire de la session plateforme. Citadelle possède le workflow et le domaine d'identité, sans posséder la mécanique de session.**

### Matrice de responsabilité

| Élément | Owner |
|---|---|
| Session ID, création, rotation, révocation, TTL | `@mosaix/auth` |
| `SessionStore` (port) + adapters PG/SQLite | persistance Platform Auth (`packages/adapters/`) |
| `PlatformSessionResolver` (`resolve(sessionId) → PlatformSessionContext \| null`) | `@mosaix/auth` (primitive, pas de `UserProfile` dedans) |
| Credentials, login/register workflows, identity/profile, MFA | Citadelle (via ports capability, jamais import direct) |
| Cookie HTTP (`__Host-mosaix_session`), parsing, `Set-Cookie`, SSR context, projection UI, 401/redirect | Shell (adaptateur mince) |
| Permissions métier | BAC concerné (jamais dans le cookie ni la session au-delà du `userId`) |
| JWT gateway/mobile | Platform Auth (mécanique) + Gateway (transport) |
| Demo personas | infra démo shell uniquement |

### Transports (deux représentations, un seul modèle)

> **JWT et sessions opaques sont deux représentations de transport du même modèle d'authentification plateforme ; aucune ne crée un second ownership de session.**

- SSR browser → **session opaque serveur** (`SessionStore`, révocable, sans claims dans le navigateur).
- Gateway/mobile/service-to-service → **JWT** existant (inchangé).

### Cookie session

`__Host-mosaix_session` (si déploiement compatible ; sinon `mosaix_session` avec justification) : `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sans `Domain`. Session ID opaque ≥128 bits CSPRNG (OWASP). **SameSite n'est pas la stratégie CSRF complète** : validation `Origin/Referer` + token CSRF sur les mutations browser dès la v1 (login-CSRF inclus).

### Invariants de session (non négociables, testés)

1. **Rotation au login** : `POST /login` → `Citadelle.authenticate` → `SessionManager.create()` → **nouvel ID**, ancien invalide. Jamais d'upgrade `anonymous → authenticated` sur le même ID. Tests : `old != new`, `old` rejeté.
2. **TTL triple** : idle expiration + absolute expiration + renewal — `TTL=3600` seul ne suffit pas.
3. **Données minimales** : `session_id, user_id, created_at, last_seen_at, expires_at, revoked_at` (+ métadonnées sécurité justifiées). Ni email, ni profil, ni permissions.
4. **Logout = révocation serveur + `Max-Age=0`** (idempotent ; cookie invalide/expiré → sûr).
5. **Aucun rôle/permission dérivé du cookie** : `cookie → session → userId → lookup autorisation/identité` à la requête ; pas de cache prématuré.
6. **`UserProfile` hors `@mosaix/auth`** : Auth retourne `userId`/`PlatformSessionContext` ; la projection applicative vit côté shell via capability profil.
7. **Legacy `mosaix_role`** : deux branches sans intersection — `DEMO → persona`, `REAL → session cookie ignorée si démo` (déjà implémenté). Jamais de conversion `mosaix_role=admin → session`.
8. **Invariant de régression** : `demo → aucun accès session réel nécessaire` ; `real → aucune persona admissible` (tests d'intégration). Le résolveur ne fabrique **jamais** d'utilisateur de démonstration en cas d'échec (retourne `null` ; la projection neutre éventuelle appartient au shell, pas à Auth).

### Composition root partagé (correction structurante, avis Claude Q1)

> Résoudre l'`AuthManager` « via le container (instance de la composition Citadelle) » ferait du shell un client direct de la composition interne d'une BAC — ADR-0016 violé, juste déplacé du statique vers le DI.

Donc :
- **Lecture** (résolution par requête SSR) : le shell consomme la primitive `@mosaix/auth` **directement** (précédent : `packages/gateway` → `validateJwt`, sans passer par une BAC). Lire un cookie opaque + interroger le `SessionStore` n'est pas de la logique métier.
- **Écriture** (login/logout/register/refresh) : workflows Identity → traversent Citadelle via ports capability (§ Ports).
- **Construction unique** : `AuthManager`/`SessionStore` sont construits dans un **composition-root partagé** (`bootstrap/`, en amont du shell ET de Citadelle — `createCitadelleApp`/`createCitadelleComposition` actuels en sont le contre-exemple), consommé des deux côtés. Ni shell→container-Citadelle, ni Citadelle en point de passage obligé pour une lecture. **À trancher en premier : tout le reste en dépend.**
- **Garde-fou (troisième avis)** : le Composition Root reste un **assembleur de dépendances**, pas un service central connaissant les détails métier, pas un nouveau BAC, pas un contournement des contrats. Structure cible (mappée aux chemins réels du repo) : `bootstrap/platform-composition.ts` + `bootstrap/auth-composition.ts`, `src/server/auth/shell-auth-adapter.ts`, `packages/auth/src/session-resolver.ts` + `platform-session-context.ts` (+ `ports/` si besoin), `apps/citadelle/src/ports/identity-{authentication,registration,profile}.port.ts`.

### Ports / capabilities

- `PlatformSessionResolver` + `PlatformSessionContext { sessionId, userId, authenticatedAt, expiresAt }` dans `@mosaix/auth` (lecture seule, testée isolément).
- Nouveau package port (ex. `packages/ports/identity/`) : `IdentityAuthenticationPort { authenticate }`, `IdentityRegistrationPort { register }`, `IdentityProfilePort { getIdentity }`. Citadelle implémente ; le shell dépend des **interfaces**. Suppression progressive de `shell → apps/citadelle` (dont `auth-routes.ts` → wizard direct).
- Endpoints : `POST /api/auth/login|logout`, `GET /api/auth/session` (contexte `{ authenticated, userId, sessionId }`, Platform Auth) — **pas** de `/api/auth/me` fourre-tout (le profil relève du domaine).
- Note structurelle (différée) : les adapters `SessionStore` vivent aujourd'hui côté Citadelle ; à terme ils relèvent de la persistance Platform Auth (`packages/adapters/*`). Comportement d'abord, déplacement ensuite.

### Persistance (avant tout login production-like)

`PostgresSessionStoreAdapter` **avant** l'activation du login (in-memory interdit en démo-off/pgsql par `InMemoryGuard`). **Pas de Redis à ce stade** : trou d'adapter, pas preuve d'insuffisance du relationnel (Redis = optimisation ultérieure sur besoin démontré). Secrets : adapter persistant + guard sur `InMemorySecretsAdapter` (**release blocker** indépendant).

### Phases (tranche verticale flaggée, avis Claude — remplace le découpage horizontal initial)

1. **Composition root partagé** — trancher où naissent `AuthManager`/`SessionStore` uniques (structurant, cf. § ci-dessus).
2. **`SessionResolver` dans `packages/auth`**, testé isolément (+ vérifier le chemin de refresh côté `SessionManager`, pas seulement JWT, sinon déconnexions horaires silencieuses).
3. **`PostgresSessionStoreAdapter` + guard secrets** (même lot, indépendant du reste).
4. **Tranche verticale flaggée** : endpoints shell→Citadelle (ports) + cookie + formulaire minimal, rotation + logout invalidant le store, tests e2e. **Pas d'endpoint login public sans UI/test qui l'exerce.**
5. **ADR-0017 final + erratum ADR-0012** (`apps/identity` → `apps/citadelle`) après implémentation.
6. **SSR + UI** comme projections des primitives testées.

Gate sécurité avant activation du login (revue humaine). Séquencer avec le chantier démo-off en cours (`profiles.ts` partagé) : **un seul chantier**, pas deux PR parallèles.

---

## Consequences

- Aucun endpoint public de login avant les garanties de persistance/sécurité (état intermédiaire assumé).
- Rate-limiting **spécifique auth** à vérifier (IP + identifiant, réponses uniformes, coût scrypt, limites différenciées login/register/refresh) au-delà du rate-limit HTTP générique existant.
- Perfs : lookup session+identité par requête SSR accepté initialement ; cache invalidable seulement sur besoin mesuré.
- Risques suivis : appel session réel en démo, double résolution, cache incohérent, `mosaix_role` résiduel, rotation mal implémentée, CSRF, dépendance masquée via container, session pgsql multi-process.

## Validation

- Gate sécurité avant activation du login (revue humaine obligatoire).
- Tests exigés : rotation, révocation (dont double logout, cookie invalide/expiré), expirations idle/absolute, refus `mosaix_role` en REAL, branches DEMO/REAL, révocation GDPR de sessions.
- Checkpoints merge (troisième avis) : **persistance** (restart serveur : session valide survit, révoquée non), **isolation** (jamais d'accès inter-utilisateurs), **autorisation** (relecture métier, rien de fiable depuis cookie/SSR), **performance** (mesurer avant cache), **rate limiting** (IP+identifiant), **démo** (tests on/off séparés), **révocation** (logout, expiration, admin, changement credentials).
- Référentiel : OWASP Session Management / ASVS pour la checklist des contrôles.
