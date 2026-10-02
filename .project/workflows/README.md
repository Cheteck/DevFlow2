# Workflows opérationnels — Catalogue

Ce répertoire contient la couche **opérationnelle** du steward protocol.
`AGENTS.md` reste la constitution (principes, risques, Git, validation).
Chaque workflow est une procédure courte, orientée mission, exécutable à la demande.

## Règles d'utilisation

1. Un workflow décrit une mission. Il s'exécute à hauteur du risque de la tâche.
2. Les sorties sont déposées dans `.project/` (reports, backlog, decisions, knowledge).
3. Si un workflow révèle une amélioration non liée à la mission, créer une tâche backlog — ne pas la faire dans la foulée (scope creep).
4. Un nouveau comportement récurrent **doit** devenir un workflow, pas un ajout à AGENTS.md.
5. Le format canonique est défini dans `_template.md`.

## Catalogue

| Catégorie | Workflow | Commande | Sortie principale |
|-----------|----------|----------|-------------------|
| agent | session-start | `/workflow agent session-start` | Sélection de l'objectif |
| agent | session-end | `/workflow agent session-end` | Dashboard + état à jour |
| audit | repository-health | `/workflow audit repository-health` | `reports/repository-health-report.md` |
| audit | architecture | `/workflow audit architecture` | `reports/architecture-audit.md` |
| audit | security | `/workflow audit security` | `reports/security-audit.md` |
| audit | technical-debt | `/workflow audit technical-debt` | Tâches backlog |
| maintenance | fix | `/workflow maintenance fix` | `completed/` + rapport |
| maintenance | refactor | `/workflow maintenance refactor` | Commits atomiques + tests |
| improvement | code-quality | `/workflow improvement code-quality` | Commits + connaissances |
| improvement | performance | `/workflow improvement performance` | `reports/performance.md` (preuves) |
| analysis | functional-gap | `/workflow analysis functional-gap` | `reports/functional-gap.md` + backlog |
| analysis | structural-gap | `/workflow analysis structural-gap` | `reports/structural-gap.md` + backlog |
| analysis | architectural-gap | `/workflow analysis architectural-gap` | `reports/architectural-gap.md` + backlog |
| testing | test-gap-analysis | `/workflow testing test-gap-analysis` | Tâches backlog |
| documentation | sync | `/workflow documentation sync` | Docs alignées code |
| architecture | rfc-process | `/workflow architecture rfc-process` | `working/RFC-XXXX-*.md` → ADR |
| architecture | adr-create | `/workflow architecture adr-create` | `decisions/ADR-XXXX-*.md` |
| planning | backlog-review | `/workflow planning backlog-review` | `dashboard.md` mis à jour |
| release | release-readiness | `/workflow release release-readiness` | Release checklist |
| recovery | incident-response | `/workflow recovery incident-response` | `reports/incidents/` |
| project | memory-cleanup | `/workflow project memory-cleanup` | Mémoire projet compactée |

## Enchaînement naturel (session nominale)

```
/workflow agent session-start
  → priorité : /workflow planning backlog-review
  → mission : selon objectif (fix, refactor, code-quality, …)
  → fermeture : /workflow agent session-end
```

## Constitution & Spécifications

La doctrine architecturale de MosaiX est définie dans `.project/architecture/` :

| Document | Rôle |
|----------|------|
| `constitution.md` | Les 7 lois immuables (toute modification = RFC + consensus) |
| `manifest-invariants.md` | Ce qu'un manifeste garantit (immutable, déclaratif, versionné, …) |
| `capability-invariants.md` | Contrat d'une capacité (signature stable, versionnée, permission-gated, …) |
| `event-invariants.md` | Contrat d'un événement (immutable, owned, replayable, tenant-isolated, …) |

Chaque ADR référence ces documents. En cas de conflit entre une proposition
et la Constitution, c'est la proposition qui change — jamais la Constitution.

## Index

- `agent/` — cycle de session
- `audit/` — diagnostic du repository
- `analysis/` — analyse des gaps fonctionnels, structurels et architecturaux
- `maintenance/` — correction et refactoring
- `improvement/` — amélioration continue
- `testing/` — couverture de tests
- `documentation/` — alignement doc/code
- `architecture/` — décisions d'architecture
- `planning/` — priorisation du backlog
- `release/` — préparation de version
- `recovery/` — réponse à incident
- `project/` — hygiène de la mémoire projet
