# Workflow — Structural Gap Analysis

- **Catégorie :** `analysis`
- **Commande :** `/workflow analysis structural-gap`
- **Niveau de risque par défaut :** `medium`
- **Chemin :** `.project/workflows/analysis/structural-gap.md`

## Purpose

Identifier l'écart entre l'**architecture intentionnelle** (plans roadmap, règles de
dépendances, frontières de modules, responsabilités documentées, contrats) et la
**structure réelle** du code (packages, graphe d'imports, exports, organisation des
modules). Sortie : un rapport de gaps structurels et un backlog priorisé.

## Trigger

- Avant/après un refactoring ou une migration de modules.
- Quand une dérive structurelle est suspectée (duplication d'architecture, responsabilités floues).
- À la fin d'une phase (le code a-t-il la structure annoncée par la roadmap ?).
- Quand `audit/architecture` pointe des risques non couverts.

## Inputs

- source : `roadmap.md` (§7 plans architecturaux, §3 décisions), ADR, règles de dépendances documentées (`apps → sdk → core → types`, couche `types → contracts → schemas`), responsabilités par module
- réel : structure des packages (`packages/`, `apps/`), graphe d'imports, exports publics, configuration eslint-plugin-boundaries
- conventions de dépendances vérifiées automatiquement (CI)

## Process

1. **Construire la structure intentionnelle** à partir des docs :
   - plans (Control Plane / Runtime Plane / Applications)
   - règles de direction des dépendances
   - responsabilités attendues par package/module
   - frontières de contrats (`@mosaix/contracts` = ABI stable et versionné)

2. **Construire la structure réelle** à partir du code :
   - graphe des packages et de leurs imports réels
   - exports publics, modules présents
   - règles eslint-plugin-boundaries effectives (ce qui est réellement contrôlé)

3. **Comparer** et classer chaque écart :

```
MissingModule  — module/responsabilité documenté mais absent du code
OrphanModule   — module présent mais non documenté (non couvert par la roadmap)
DepViolation   — dépendance réelle contraire à la direction déclarée
ResponsibilityViolation — code situé dans un module dont la responsabilité diffère
Duplication    — même responsabilité implémentée à plusieurs endroits
BoundaryDrift  — frontière de contrats non respectée (imports vers types internes)
```

4. **Vérifier les garde-fous** — les violations sont-elles bloquées par la CI
   (eslint-plugin-boundaries) ou silencieuses (aucune règle) ? Une dérive non
   détectée automatiquement est plus grave.

5. **Prioriser** — Decision Score (Phase 4 AGENTS.md) : impact sur la maintenabilité,
   le risque de fuite d'abstraction, le coût de remise en conformité.

6. **Transcrire** — tâches backlog (refactor, migration, suppression de duplication,
   ajout de règles CI) et ADR si un choix d'architecture émerge.

## Outputs

- `.project/reports/structural-gap.md` :

```markdown
# Structural Gap Analysis

## Structure intentionnelle vs réelle
Intention | Réel | Écart | Sévérité | Détecté par CI ?
...

## Violations de dépendances
- ...

## Duplications / responsabilités floues
- ...

## Backlog Candidates
- ...
```

- Tâches backlog priorisées (type `refactor`, `chore`, `security` si frontière critique).
- Éventuel ADR si le gap révèle un choix d'architecture non documenté.

## Validation

- Chaque écart est étayé par une preuve (import réel, `package.json`, règle ESLint, export).
- La comparaison distingue ce qui est automatiquement contrôlé de ce qui ne l'est pas.
- Les gaps prioritaires sont actionnables (une tâche = une remise en conformité).

## Risks

- Décréter un gap sur l'architecture documentée alors que la doc est obsolète →
  distinguer « le code dérive » de « la doc est en retard » (lire `documentation/sync`).
- Violations bloquantes non signalées par la CI → prioriser l'ajout de règles (T-06).
- Refactoring massif → découper, ne pas changer de comportement (voir `maintenance/refactor`).