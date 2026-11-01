# Production Roadmap — MosaiX

**Dernière mise à jour :** 2026-11-01 — Itération 2 (P0-1…P0-5 terminés)
**Verdict architecte :** pas de Go-Live. Maturité logicielle encourageante, garanties opérationnelles non démontrées.

Objectif : passer du **Niveau 1 (déployable)** au **Niveau 2 (production-ready)** :
pannes, migrations, sauvegardes, secrets, déploiements et récupération **testés et documentés**.

## Phase 1 — Production Blockers (P0)

| # | Tâche | Preuve de fin | Statut |
|---|-------|---------------|--------|
| P0-1 | **R06** Interdire les fallbacks in-memory silencieux en prod (`MOSAIX_ENV=production` → fail-fast) | `73cd597` — 10 adaptateurs couverts + `in-memory-guard.e2e.test.ts` (3 tests) | DONE |
| P0-2 | **R05** Health probes : `/health/live`, `/health/ready` (DB ping), `/health/startup` | `b416c4e` — `health-probes.e2e.test.ts` (4 tests : live 200, ready 200 healthy, ready 503 PG down, startup 200) | DONE |
| P0-3 | **R02** Migrations : lock de concurrence + guard checksum (MIG-IMMUT-01) + test double-instance | `b2ce7b1` — `migrations-concurrency.e2e.test.ts` (2 tests : collision lock → `MigrationLockError`, migration modifiée → `MigrationChecksumError`) | DONE |
| P0-4 | **R09** CI GitHub Actions : build + test + security scan + artefact versionné | `66795c7` — pipeline typecheck/lint/build/test/validators/security + `pnpm audit --audit-level=moderate` | DONE |
| P0-5 | **R01** Secrets : versioning + révocation + refus de boot prod si secrets absents | `c0c7bb2` — `app-key.test.ts` 9/9 passent ; versioning + révocation dans `requireAppKey()` | DONE |
| P0-6 | **R07** Backup/DR : script dump PG + procédure restauration + test de restauration documenté | `91c84e2` — `scripts/db-backup.ts` + `backup-restore.e2e.test.ts` (3/3 tests) + RUNBOOK-DR-001 | DONE |
| P0-7 | **R03** Audit sagas/compensation workflows inter-BACs (commerce, booking, subscription) | Rapport d'audit + tests d'idempotence | OPEN |
| P0-8 | **R04** Audit MCP : permissions par outil, principal, ops sensibles | Rapport + tests deny | OPEN |
| P0-9 | **R08** Isolation tenant : clés Redis tenant-scoped + test E2E anti-fuite | Test rouge→vert | OPEN |

## Phase 2 — Delivery & Reliability (P1)

- Graceful shutdown testé (SIGTERM → drain des requêtes)
- Circuit breakers + retries bornés + timeouts sur adapters externes
- Chaos tests : PG arrêté, Redis saturé, rotation de clé en vol (Toxiproxy/Testcontainers)
- Image Docker : même digest staging→prod, scan image, SBOM

## Phase 3 — Observability & Performance (P1)

- OpenTelemetry : propagation trace ID inter-BACs
- Métriques par BAC + alertes + dashboards
- Benchmarks (auth, checkout, event bus) + SLO initiaux

## Phase 4 — Governance & Documentation (P1)

- `PRODUCTION_READINESS.md` (checklist 41 points, preuves liées)
- Runbooks (incident, rollback, DR)
- Matrice de compatibilité packages, versioning BACs

## Règles de la boucle

- Une tâche = un commit (plusieurs si atomique), validée par tests avant statut DONE.
- Chaque statut DONE doit pointer une preuve (test, commit, rapport).
- Un blocage → statut BLOCKED avec dépendance explicite, jamais masqué.
- Les tâches Phase 1 s'exécutent dans l'ordre de la colonne (dépendances implicites).
