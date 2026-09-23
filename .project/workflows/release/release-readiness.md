# Workflow — Release Readiness

- **Catégorie :** `release`
- **Commande :** `/workflow release release-readiness`
- **Niveau de risque par défaut :** `high`
- **Chemin :** `.project/workflows/release/release-readiness.md`

## Purpose

Vérifier qu'une version est prête à être publiée, selon un checklist
exhaustif et reproductible.

## Trigger

- Avant tout tag/version (MAJOR.MINOR.PATCH).
- Avant une livraison importante (démo, milestone, publication).

## Inputs

- version cible (SemVer)
- diff depuis la dernière version (`git log`)
- état des tests, docs, CI

## Process

1. **Tests** — suite complète verte (build, lint, tests, format) ; CI vert sur la branche.
2. **Documentation** — docs alignées code (voir `documentation/sync`).
3. **Changelog** — entrée de version complète et datée.
4. **Migration** — migrations nécessaires documentées, ordre d'application défini.
5. **Breaking changes** — identifiés et explicités (nouvelle MAJOR si nécessaire).
6. **Sécurité** — audit rapide (`audit/security`) : aucun finding High/Critical ouvert.
7. **Dépendances** — versions cohérentes, aucune vulnérabilité connue bloquante.
8. **Gouvernance** — état `.project/` à jour (dashboard, state, changelog).
9. **Checklist finale** :

```markdown
## Release Checklist — vX.Y.Z
□ Tests verts (build/lint/test/format)
□ CI vert
□ Documentation synchronisée
□ Changelog à jour
□ Migrations documentées
□ Breaking changes listés
□ Audit sécurité : aucun High/Critical
□ Git : tags + historique propre
```

## Outputs

- Checklist de release complétée (validée ou bloquée)
- Tag Git + changelog + notes de migration
- Retour d'expérience si blocages (apprentissage)

## Validation

- Chaque case de la checklist est réellement vérifiée (pas de déclaration non effectuée).
- En cas de case non cochée → la release est bloquée, pas contournée.

## Risks

- Publier avec des tests rouges → blocage obligatoire.
- Changelog incomplet → toute modification significative doit être traçée.
- Tag erroné / pas de plan de rollback → Git Recovery Principle : documenter comment revenir en arrière.