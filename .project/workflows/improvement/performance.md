# Workflow — Performance

- **Catégorie :** `improvement`
- **Commande :** `/workflow improvement performance`
- **Niveau de risque par défaut :** `medium`
- **Chemin :** `.project/workflows/improvement/performance.md`

## Purpose

Optimiser les performances **sur la base de preuves**, jamais par intuition.
Chaque optimisation est mesurée avant et après, et validée par des données.

## Trigger

- Budget de performance violé (cf. North Star MosaiX : event routing < 5ms, permission check < 2ms, …).
- Symptôme observé (lenteur, lag, blocage).
- Audit ou benchmark programmé.

## Inputs

- zone concernée (module, opération, chemin critique)
- budget de performance applicable
- conditions de mesure reproductibles

## Process

1. **Problème observé** — décrire le symptôme et le contexte.

```
Problem:
Evidence:
Measurement:
```

2. **Mesurer avant** — benchmark/outil de profilage reproductible, base de référence.
3. **Hypothèse** — identifier le goulot d'étranglement probable (avec preuve, pas de supposition).
4. **Changement** — appliquer la plus petite optimisation justifiée.

```
Change:
Expected gain:
Measured result:
```

5. **Mesurer après** — rejouer exactement la même mesure.
6. **Comparer** — gain réel vs attendu ; si pas de gain mesuré, reconsidérer.
7. **Valider** — tests verts, aucun comportement modifié.
8. **Document** — résultats dans `.project/reports/performance.md`, connaissance réutilisable.

## Outputs

- Rapport de performance avec mesures avant/après
- Optimisation validée (ou rejetée sur preuve)
- Connaissance réutilisable si le pattern se reproduit

## Validation

- Mesures avant/après dans des conditions identiques.
- La suite de tests passe (aucune régression fonctionnelle).
- Le gain mesuré est réel et significatif ; sinon, ne pas conserver le changement.

## Risks

- Optimisation prématurée sans preuve → strictement interdit (Evidence Based Engineering).
- Micro-optimisations qui détruisent la lisibilité → prioriser les gains significatifs.
- Mesures non reproductibles → conditions stables (isolation, itérations multiples, médiane).