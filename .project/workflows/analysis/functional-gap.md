# Workflow — Functional Gap Analysis

- **Catégorie :** `analysis`
- **Commande :** `/workflow analysis functional-gap`
- **Niveau de risque par défaut :** `medium`
- **Chemin :** `.project/workflows/analysis/functional-gap.md`

## Purpose

Identifier l'écart entre la **fonctionnalité intentionnelle** (objectifs de roadmap,
objectifs de tâches, contrats `@mosaix/contracts`, manifests, comportements attendus)
et la **fonctionnalité réellement livrée et testée** dans le code.
Sortie : un rapport de gaps fonctionnels et un backlog priorisé.

## Trigger

- À la fin d'un milestone / phase (contrôle de livraison réelle vs prévue).
- Quand la roadmap ou les objectifs de backlog semblent en avance sur l'implémentation.
- Avant une démo, une release ou un sprint planning.
- Quand un audit de santé (repository-health) détecte un doute sur l'avancement réel.

## Inputs

- source : `roadmap.md`, `backlog/`, ADR, contrats (`packages/contracts`), schemas (`packages/schemas`)
- réel : code source (`packages/`, `apps/`), exports des API publiques
- tests existants (quels comportements sont vérifiés)
- état des tâches (`working/`, `completed/`, `dashboard.md`)

## Process

1. **Inventorier l'intention** — lister chaque capacité/document livrable promis :
   - objectifs de roadmap (par phase)
   - objectifs de tâches backlog (champ `Objectif` + `Prochaines étapes`)
   - contracts `@mosaix/contracts` et validateurs `@mosaix/schemas`
   - comportements attendus décrits dans les ADR et la spec

2. **Cartographier le livrable** — pour chaque élément, localiser l'implémentation réelle
   (module, export public, fonctionnalité).

3. **Vérifier** chaque intention contre **deux faits** :
   - est-il implémenté dans le code ?
   - est-il couvert par un test dans un test ?

4. **Classer chaque gap** :

```
Missing     — intention sans implémentation
Partial     — implémenté partiellement (comportements manquants)
Untested    — implémenté mais non couvert par un test
DocQuelleOnly — présent dans la doc/spec, absent du code (déclaré mais inexistant)
Undocumented — implémenté dans le code mais absent de la roadmap/spec (résisté) → dérive documentaire
```

5. **Prioriser** — appliquer le Decision Score (Phase 4 AGENTS.md) à chaque gap
   (impact fonctionnel × probabilité de rencontre × coût de comblement).

6. **Transcrire** — créer une tâche backlog par gap actionnable (Missing/Partial/Untested).
   Les gaps de type `Undocumented` deviennent une dérive documentaire (voir `documentation/sync`).

## Outputs

- `.project/reports/functional-gap.md` :

```markdown
# Functional Gap Analysis

## Couverture fonctionnelle
Intention | Implémentation | Test | Type de gap | Priorité
...

## Gaps critiques (à combler)
- ...

## Gaps partiels / non testés
- ...

## Backlog Candidates
- ...

## Score de livraison
Fonctionnalités livrées : X/Y | Testées : X/Y
```

- Tâches backlog priorisées (type `feat` pour `missing`, `test` pour `untested`).
- Éventuel alignement `project_state.md` / `dashboard.md` si le taux de livraison réel diffère de l'affiché.

## Validation

- Chaque ligne « gap » est étayée par une localisation (fichier:ligne) ou un test.
- Aucune intention écartée sans raison ; la liste des intentions couvre le périmètre déclaré.
- Les gaps prioritaires sont actionnables et datables.

## Risks

- Confondre « documented-only » et « implémenté » → ne déclarer un gap que sur preuve (recherche de symbole, test, export).
- Juxtaposer roadmap surpromise et faible livraison → le rapport évalue l'écart, ne déplace pas les objectifs seuls.
- Toute amélioration non liée au gap → tâche backlog, jamais scope creep.