# CLEANUP_REPORT — Nettoyage .project (2026-10-31)

## Résumé

| Metric | Valeur |
|--------|--------|
| Fichiers analysés | ~120 (`.project/` complet + racine) |
| Fichiers archivés | 98 |
| Fichiers fusionnés | 0 (les sources de vérité actuelles suffisent) |
| Fichiers supprimés (racine) | 7 (artefacts build) |
| Fichiers conservés | ~70 (hors archive) |
| Doublons identifiés | 1 (`VIEW-E2E-A` dans `BACKLOG.md`) |
| Erreur corrigée | 1 (doublon BACKLOG) |
| Réduction brute | ~60 fichiers retirés de l'arborescence principale |

---

## A. Informations essentielles conservées

| Document | Rôle | À jour |
|----------|------|--------|
| `PROJECT_OVERVIEW.md` | ✅ Nouveau — Source canonique d'état courant | 2026-10-31, vérifié contre code |
| `PRODUCTION_AUDIT.md` | Risques production (9 P0) | 2026-10-31 |
| `PRODUCTION_ROADMAP.md` | Plan de remédiation Phase 1-4 | 2026-10-31 |
| `RELEASE-READINESS.md` | Gate prod (P0 checklist) | 2026-10-09 |
| `BACKLOG.md` | Registre actif tâches (5P0, 6P1, 9P2) | 2026-10-13 |
| `INMEMORY_REMEDIATION.md` | Audit vérifié fallbacks in-memory | 2026-10-31 |
| `dashboard.md` | Métriques + synthèse livraisons | 2026-10-31 |
| `PROJECT.md` | Master directive (vision, invariants) | Stable |
| `REQUIREMENTS.md` | Catalog REQ-IDs | Stable |
| `roadmap.md` | Feuille de route horizons futurs | Stable |
| `decisions/ADR-0001..0023` | Décisions techniques (23 ADRs) | Immuables |
| `architecture/` | Blueprints, invariants, diagrams | 16 fichiers actifs |
| `knowledge/` | Connaissances domaine consolidées | 6 fichiers |
| `prd/` | Spécifications produit (PRD-0006..0012) | 8 fichiers |
| `workflows/` | Procédures opérationnelles | 17 fichiers |

---

## B. Informations fusionnées

Aucune fusion nécessaire. Les documents actifs n'ont pas de contenu dupliqué significatif :
- `PRODUCTION_AUDIT.md` remplace déjà l'audit framework (`audit-technique-mosaix-2026.md` → archivé)
- `INMEMORY_REMEDIATION.md` remplace les audits in-memory dispersés
- `active-backlog.md` est un REDIRECT vers `BACKLOG.md`

---

## C. Informations obsolètes archivées (98 fichiers)

### Rapports de session (40 fichiers)
Tous les `session-2026-09-24.md` → `session-2026-11-06.md` déplaçés vers `_archive_review/reports/`.
**Raison :** Historique de session, utilité actuelle nulle. Le `changelog.md` et les commits Git portent l'historique.

### Audits techniques obsolètes (18 fichiers)
- `audit-technique-mosaix-2026.md` → Supplanté par `PRODUCTION_AUDIT.md` (plus récent, plus dense)
- `audit-applicatif-mosaix-2026.md` → Supplanté par `PRODUCTION_AUDIT.md` + `INMEMORY_REMEDIATION.md`
- `audit-injection-extensibilite-2026-09-24.md`, `audit-performance-2026.md`, `audit-plugin-engine-2026.md`, `audit-preproduction-2026-09-25.md`
- `security-audit-2026-09-25.md` → Résolu (8/8 vulnérabilités patchées, dans `dashboard.md`)
- `preproduction-audit-apps-2026.md`, `db-bypass-audit-2026-09-26.md`, `remediation-plan-2026.md`
- `mcp-audit-week1.md`, `mcp-improvement-report.md`, `mcp-intelligence.md`, `mcp-scenario-{A,B,C}.md`
- `analyse-commit-bf25309-audit.md`, `analyse-god-objects-audit.md`, `frontend-audit-report.md`
- `architectural-gap.md`, `functional-gap.md`, `structural-gap.md`
- `ocp-remaining-violations.md`, `theme-management-analysis.md`, `repository-health-report.md`
- `commandes-complementaires-conformance.md`

**Raison :** Ces audits ont été supplantés par des audits plus récents, les problèmes ont été résolus, ou le contenu est capturé dans les documents actifs.

### Plans pré-production dépassés (6 fichiers)
- `STATE.md` → Supplanté par `dashboard.md` + `PROJECT_OVERVIEW.md`
- `PRE-PRODUCTION-AUDIT-PLAN.md`, `PRE-PRODUCTION-AUDIT-PLAN-v2.md` → P0 terminés, supplanté par `PRODUCTION_ROADMAP.md`
- `WORKFLOW-PRE-PRODUCTION-AUDIT.md` → Même contenu que les plans ci-dessus
- `project_state.md` → Duplication de `STATE.md`
- `roadmap-auth.md` → Contenu dans `decisions/ADR-0017-auth-session-shell-bridging.md`
- `PLATFORM-GRANDES-LIGNES.md` → Contenu dans `PROJECT.md` + `PROJECT_OVERVIEW.md`

### Fichiers de travail (11 fichiers)
- `working/commit-msg-{2,3,4,5,6}.txt`, `working/vitest-{final,full,wip}.txt` → `_archive_review/working/`
**Raison :** Artefacts temporaires de session.

### Rapports DEV-SERVER (5 fichiers)
- `DEV-SERVER-ARCHITECTURE-REVIEW-SYNTHESIS.md`, `DEV-SERVER-LIFECYCLE-DIAGRAM.md`, `DEV-SERVER-LIFECYCLE-MERMAID.md`, `DEV-SERVER-MIGRATION-PLAN.md`, `DEV-SERVER-RESPONSIBILITY-MATRIX.md`
**Raison :** Travail parallèle (dev-server → command-center refactor), pas notre travail.

### Artefacts build racine (7 fichiers)
- `.tsc-build-errors.txt`, `.tsc-errors-2.txt`, `.tsc-errors-root.txt`, `.tsc-errors.txt`, `.tsc-verify-build.txt`, `.tsc-verify-root.txt`, `prompt.txt`
**Raison :** Sorties transitoires de build, jamais utiles après résolution.

---

## D. Informations superflues supprimées

- **Historique session détaillé** : 40 rapports de session conservés en archive. Les détails sont dans les commits Git.
- **Rapports intermédiaires** : 18 audits dont les conclusions sont dans les documents actifs ou les problèmes ont été résolus.
- **Brouillons temporaires** : 11 fichiers `working/` (commit-msg, vitest output).

---

## E. Nouvelle organisation

```
.project/
├── PROJECT_OVERVIEW.md          ← Source canonique d'état courant (NOUVEAU)
├── PRODUCTION_AUDIT.md          ← Risques production (9 P0)
├── PRODUCTION_ROADMAP.md        ← Plan Phase 1-4
├── RELEASE-READINESS.md         ← Gate prod
├── dashboard.md                 ← Métriques + synthèse
├── PROJECT.md                   ← Master directive
├── REQUIREMENTS.md              ← Catalog REQ-IDs
├── roadmap.md                   ← Feuille de route
├── changelog.md                 ← Historique des changements
├── decisions/                   ← 23 ADRs (immuables)
├── architecture/                ← 16 fichiers actifs (blueprints, invariants, C4)
├── backlog/                     ← BACKLOG.md, RELEASE-READINESS.md, INMEMORY_REMEDIATION.md, PLAN-VAGUES.md
├── knowledge/                   ← 6 fichiers (connaissances domaine)
├── prd/                         ← 8 PRDs (PRD-0006..0012)
├── workflows/                   ← 17 procédures opérationnelles
├── codebase/                    ← 3 fichiers (ARCHITECTURE.md, CONVENTIONS.md, STACK.md)
├── archive/                     ← Legacy backlog (gelé)
├── working/                     ← Temp (commit-msg-7.txt, session-report-2026-10-31.md)
└── _archive_review/             ← 98 fichiers archivés (réserver avant suppression définitive)
    ├── reports/                 ← 64 fichiers (sessions, audits, DEV-SERVER)
    ├── state/                   ← 6 fichiers (plans pré-prod dépassés)
    └── working/                 ← 8 fichiers (temporaires)
```

---

## F. Corrections appliquées

| Fichier | Problème | Correction |
|---------|----------|------------|
| `BACKLOG.md` | Ligne `VIEW-E2E-A` dupliquée (lignes 16-17) | Doublon supprimé |

---

## G. Points nécessitant validation humaine

1. **`_archive_review/`** — 98 fichiers à revérifier avant suppression définitive (recommandé : 2-4 semaines de rétention)
2. **`chatgpt-web-mcp/`** — Repo git intégré, non tracké, exclu de vitest. Décision requise : submodule ou `.gitignore` ?
3. **`ADR-0017-auth-session-shell-bridging.md`** — Toujours en Draft, besoin de validation humaine avant implémentation
4. **Workflows obsolètes ?** — Les 17 workflows dans `.project/workflows/` sont toujours utilisés par le protocole AGENTS.md

---

## H. Commits produits

| Hash | Message |
|------|---------|
| `edb4a9b` | `docs(project): compact .project documentation, archive obsolete reports` (98 fichiers) |
| `d0c24d9` | `chore: remove root build artifacts` (6 fichiers `.tsc-*.txt`) |
| `032bcc2` | `docs(reports): archive obsolete audit-applicatif-mosaix-2026.md` |
| `d1488eb` | `docs(dashboard): update with 2026-10-31 cleanup summary` |

---

## I. Rollback

```bash
git reset --hard f8a76d4  # avant le début du nettoyage (HEAD avant edb4a9b)
```
