# Roadmap — Auth/Session réelle + Kill-switch démo (ADR-0017)

**Références :** `decisions/ADR-0017-auth-session-shell-bridging.md` (DRAFT), `decisions/BRIEF-auth-session-shell-bridging.md` (§8-10 : 3 avis), `backlog/active-backlog.md` §14.
**Règle centrale :** le shell ne possède jamais une session ; `@mosaix/auth` possède la session plateforme ; Citadelle possède le domaine identité.
**Risque :** High/Critical — gate sécurité + validation humaine avant activation du login.

---

## Phase 0 — Kill-switch démo ✅ TERMINÉ (à commiter)

`MOSAIX_DEMO_USERS=false` désactive : cookie `mosaix_role`, personas (`LOCAL_USER_PROFILE` neutre), fallback feed mock, seeds, flags mémoire, fallbacks in-memory (`InMemoryGuard`), mocks Citadelle, emails fabriqués.
Critère : 21/21 tests verts, boot démo-off sans mock vérifié (`/api/feed` → `[]`, HTML sans personas).

## Phase 1 — Composition root partagé 🔴 BLOQUANT, à trancher en premier (AUTH-01)

Audit `AuthManager`/`SessionManager`/`CitadelleAdapters` → `bootstrap/auth-composition.ts` : instance unique `AuthManager`/`SessionStore` construite en amont shell+Citadelle. Garde-fou : assembleur uniquement, pas de logique métier.
Critère : zéro dépendance shell→BAC (statique ou container) ; **validation humaine**.

## Phase 2 — Fondations persistance (AUTH-02, AUTH-03 — parallélisable avec Phase 3)

`PostgresSessionStoreAdapter` + migrations, secrets persistants + guard `InMemorySecretsAdapter`, vérification refresh `SessionManager`, tests sqlite+pgsql.
Critère : boot pgsql démo-off sans throw, sessions persistées au restart. **Pas d'endpoint login.**

## Phase 3 — Primitives + ports, sans exposition publique (AUTH-04, AUTH-05)

`SessionResolver` + `PlatformSessionContext` dans `@mosaix/auth` (rotation, idle/absolute/renewal, révocation) ; `packages/ports/identity` (authentication/registration/profile) implémentés par Citadelle ; suppression imports directs shell→Citadelle (dont wizard).
Critère : SSR résout une session réelle (valide/expirée/révoquée/inconnue testées), **aucun endpoint public**.

## Phase 4 — Tranche verticale flaggée (AUTH-06, AUTH-07)

`POST /api/auth/login|logout` + `GET /api/auth/session`, cookie `__Host-mosaix_session`, CSRF, rate-limit IP+identifiant, formulaire Login/Register minimal + usermenu, tests e2e. Flag off par défaut.
Critère : parcours complet exercé ; logout révoque serveur ; **gate sécurité (OWASP) avant activation.**

## Phase 5 — Finalisation (AUTH-08)

ADR-0017 final (depuis l'implémentation) + erratum ADR-0012 + activation cible.
Critère : autorisation humaine explicite.

---

## Ordre strict

**0 (commit) → 1 → 2+3 (parallèles) → 4 → 5.** Ne pas exposer de login public avant la Phase 4. Séquencer avec `profiles.ts` comme un seul chantier (pas de PR parallèle).
