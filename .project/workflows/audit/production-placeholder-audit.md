# Workflow — Production Placeholder Audit

- **Catégorie :** `audit`
- **Commande :** `/workflow audit production-placeholder-audit`
- **Niveau de risque par défaut :** `low`
- **Chemin :** `.project/workflows/audit/production-placeholder-audit.md`

## Purpose

Faire respecter la règle constitutionnelle « aucun ajout in-memory/mock/démo
dans les chemins de production » (AGENTS.md, Règles absolues) : détecter les
implémentations mock, les données de démonstration et les fallbacks silencieux
dans le code de production, les transformer en tâches backlog priorisées —
jamais en refactoring opportuniste.

## Trigger

- Health check périodique (recommandé : chaque session significative touchant
  `apps/`, `src/` ou `packages/adapters/`).
- Avant un merge vers `main` (avec `pnpm check:integrity --strict`).
- À la demande.

## Inputs

- code source (`apps/`, `src/`, `packages/`, `scripts/`, `bootstrap/`)
- sortie de `pnpm check:integrity` (règles `CONF-SEC-003`, `CONF-PROD-001`, `CONF-PROD-002`)
- doctrine `InMemoryGuard` + gate `isDemoMode()` (`@mosaix/support`)

## Process

1. **Gate automatique** — exécuter `pnpm check:integrity` ; tout finding
   `CONF-SEC-003` / `CONF-PROD-001` / `CONF-PROD-002` est bloquant (error).
   Zéro finding = prérequis, pas preuve d'absence (les règles sont des
   tripwires regex, pas une analyse sémantique).
2. **Inventaire ciblé** — rechercher dans les chemins de production
   (tests `*.test.ts`, `demo/`, adapters mémoire explicites et allowlists
   documentées exclus d'office) :
   - datasets démo en dur (posts, conversations, métriques, compteurs UI) ;
   - identités forgées (`sess-` + timestamp, utilisateurs démo par défaut) ;
   - seeds non gatés (helpers de seed hors seeder CLI `isDemoMode()`) ;
   - credentials mock par défaut (clés `mock*`, tokens factices silencieux) ;
   - stores mémoire sur des chemins persistants (sessions, migrations, events).
3. **Triage** — pour chaque item : violation réelle vs exception constitutionnelle
   (doubles de test, adaptateur choisi à la composition, `demo/`, fallback gardé
   documenté). Seules les violations réelles deviennent des tâches.
4. **Backlog** — une tâche par violation (fichier:ligne, preuve, remédiation :
   port + adaptateur réel, gate `isDemoMode()`, ou suppression), priorisée au
   Decision Score. Les corrections triviales et sûres (nombres en dur → retrait,
   helper test-only → déplacé en `*.test.ts`) peuvent être exécutées dans la
   foulée ; toute décision de design (gate vs suppression, nouveau port) reste
   une tâche.
5. **Exceptions** — toute allowlist ajoutée aux règles (`CONF-PROD-002` pour le
   stub login démo, etc.) doit citer la raison + le TODO de sortie. Révoquer
   l'exception dès le wiring réel livré.

## Outputs

- Tâches backlog priorisées (une par violation, avec preuve).
- Corrections triviales appliquées + tests.
- Rapport `.project/reports/` si volume important.

## Validation

- `pnpm check:integrity` : zéro finding `CONF-SEC-003`/`CONF-PROD-*`.
- `pnpm test` vert, `pnpm lint` 0 erreur sur les fichiers touchés.
- Chaque tâche backlog cite sa preuve (fichier:ligne avant correction).

## Risks

- Regex ≠ sémantique : un passage au vert ne prouve pas l'absence de mocks
  (ex. compteurs UI en dur) — l'inventaire manuel ciblé reste obligatoire.
- Faux positifs sur littéraux légitimes → allowlist documentée, jamais
  suppression de la règle.
- Tenter de tout purger d'un coup → prioriser, incrémenter (V0/V1 feed : modèle).
