# Migration Plan: @mosaix/dev-server Decomposition (ADR-0023)

## Status

- [x] Phase 1 : Extraction (DevSupervisor, etc. vers `packages/command-center`).
- [x] Phase 2 : Dual-write (ré-export déprécié v0.2.0).
- [x] Phase 3 : Infrastructure.
  - [x] Phase 3a : Alias Vitest.
  - [x] Phase 3b : Workspace dep racine, import package (`scripts/dev.ts`).
- [x] Phase 4 : Hygiène & Boundaries.
  - [x] Responsabilités, Changellog, ESLint rules.
- [ ] Phase 5 : Extraction `@mosaix/dev-session`.
- [ ] Phase 6 : Nettoyage dual-write (prévu v0.2.0).

## Notes
- Le test `tests/http/bac-access.http.test.ts` **était en échec** (timeout beforeAll 150s) à cause d'un bug pré-existant : `MOSAIX_DEMO_USERS=false` active `InMemoryGuard` sur `PlatformSettingsService`, faisant planter le serveur silencieusement.
- **Corrigé** : ajout de `ALLOW_IN_MEMORY_IN_PRODUCTION=true` dans les env du test (commit `c330dd9`). Le test cible le routage HTTP, pas la persistance des settings.
- Tous les tests passent désormais (202 fichiers, 1167 tests).
