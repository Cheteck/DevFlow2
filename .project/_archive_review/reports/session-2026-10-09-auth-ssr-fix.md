# Session 2026-10-09 — Fix navbar anonyme (AUTH-07 étapes 1-2)

## Objectif
Sans session, `/` affichait le menu `Utilisateur local / Membre` au lieu de `Se connecter / Créer un compte`. Diagnostic validé par revue externe : `getActiveUserProfile()` fabriquait une identité par défaut + rendu inconditionnel du widget.

## Changements (étapes 1-2 de la revue, pas de refonte globale)
- `packages/auth/src/session-resolver.ts` — aligné sur le port `SessionStore` : `revoke` (pas `delete` inexistant), rejet expirées + révoquées, fail closed si identité introuvable (fini le guest fabriqué). `+tenantId` au contexte.
- `src/shell/ssr-auth-context.ts` (nouveau) — `SsrAuthContext` discriminé `anonymous | authenticated | demo`, `buildSsrAuthContext()` par requête (session réelle > persona démo si démo on > anonyme), `?role=` et `mosaix_role` ignorés en démo-off. Résolution via `sessionManager` de la composition partagée (+ checks expiry/révocation), pas d'import direct `SessionResolver` dans le hot path SSR (loader dev stale). Profil authentifié neutre `Mon compte` (transitoire, en attendant `IdentityProfilePort` AUTH-05).
- `src/shell/renderer.ts` — `renderAuthButtons()` (`/login?next=`, `/register?next=`, sans `user-menu-dropdown`) + interdiction documentée du fallback local comme preuve d'auth.
- `home-page.ts` / `bac-page.ts` — branche navbar sur `auth.kind` (défaut anonyme = fail closed). Sidebars inchangées (pas une frontière sécu, chantier séparé).
- `src/start.ts` — construit `ssrAuth` une fois par requête, injecté aux 3 rendus.
- `src/server/routes/auth-routes.ts` — `GET /api/auth/session` vérifie expiration + révocation (2 voies : Router + legacy). Fini la session expirée encore `authenticated:true`.

## Non touché (volontairement, étapes 3-5 = chantiers séparés)
- `SPACES_LIST` global, `mosaix_active_space` sans vérification membership, sidebar anonyme, `PostgresSessionStoreAdapter` (shape incompatible avec le port — à traiter à part), gateway mobile JWT.

## Validation
- `npx vitest run session-resolver + ssr-auth-context + auth-routes + profiles` : **24/24 verts** (14 nouveaux).
- `npx eslint` fichiers touchés : propre.
- Durcissement post-revue : toute erreur du store (`get` qui throw, record malformé) → anonyme, jamais authentifié ni 500 sur page publique ; `/api/user/switch` déjà gaté démo-off (`user-routes.ts:21`, 403) — `window.switchRole()` côté client est donc inopérant en réel.
- Reste à prouver (E2E, étapes 3-5) : SSR sans cookie → boutons, session révoquée → boutons, login → menu → logout → boutons, requêtes concurrentes, memberships espace. Dev server non redémarré ici (tourne sur l'ancien code) — à vérifier après restart.

## Git State
- Branche : `backlog-tasks-completion-16894022842581055701`, aucun commit (à reviewer).
- Nouveaux : `src/shell/ssr-auth-context.ts`, `ssr-auth-context.test.ts`, `packages/auth/src/session-resolver.test.ts`, ce rapport.
- Modifiés : `session-resolver.ts`, `renderer.ts`, `home-page.ts`, `bac-page.ts`, `start.ts`, `auth-routes.ts`.
- Rollback : `git checkout -- <modifiés>` + supprimer les 4 nouveaux fichiers.
