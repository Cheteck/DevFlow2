# Production Roadmap — MosaiX

**Dernière mise à jour :** 2026-10-31 — Itération 1 (après audit + consultation architecte)
**Verdict architecte :** pas de Go-Live. Maturité logicielle encourageante, garanties opérationnelles non démontrées.

Objectif : passer du **Niveau 1 (déployable)** au **Niveau 2 (production-ready)** :
pannes, migrations, sauvegardes, secrets, déploiements et récupération **testés et documentés**.

## Phase 1 — Production Blockers (P0)

| # | Tâche | Preuve de fin | Statut |
|---|-------|---------------|--------|
| P0-1 | **R06** Interdire les fallbacks in-memory silencieux en prod (`MOSAIX_ENV=production` → fail-fast) | Test : boot prod sans DB/Redis refuse le démarrage | OPEN |
| P0-2 | **R05** Health probes : `/health/live`, `/health/ready` (DB ping), `/health/startup` | Tests : PG down → ready 503, live 200 | OPEN |
| P0-3 | **R02** Migrations : lock de concurrence + guard checksum (MIG-IMMUT-01) + test double-instance | Test CI : mutation de migration appliquée → échec | OPEN |
| P0-4 | **R09** CI GitHub Actions : build + test + security scan + artefact versionné | Run vert sur branche | OPEN |
| P0-5 | **R01** Secrets : versioning + révocation + refus de boot prod si secrets absents | Tests rotation/révocation | OPEN |
| P0-6 | **R07** Backup/DR : script dump PG + procédure restauration + test de restauration documenté | Runbook + preuve de restauration | OPEN |
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
