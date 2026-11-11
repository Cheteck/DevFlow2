# Pre-Production Audit Plan - MosaiX Framework (Version 2)

## Mission Overview

**Objective**: Validate production readiness by addressing all critical and high-severity gaps identified in the technical audit, ensuring the framework is stable, well-documented, and ready for deployment.

**Current Branch**: `audit-technique-mosaix-8397822254578305712`

**Overall Confidence Level**: 90% (after P0 completion) → Target ≥95%

---

## Phase 1: Critical P0 Items (COMPLETED)

| ID | Priority | Task | File | Status |
|----|----------|------|------|--------|
| P0-1 | Critical | Forward SDK grants in registration | `packages/sdk/src/index.ts` | ✅ Done |
| P0-2 | Critical | Expand conformance kernel suite | `packages/conformance/src/suites/kernel.ts` | ✅ Done |
| P0-3 | Critical | Verify kernel capability error type | `packages/conformance/src/suites/kernel.ts` | ✅ Done |

**Result**: Application manifests verified compliant, grants now forwarded, lifecycle methods validated.

---

## Phase 2: High-Priority P1 Items (Next 3 Sessions)

### Château 2: Gaps Résiduels P1

| MOS ID | Priority | Task | Component | Risk |
|--------|----------|------|-----------|------|
| MOS-005 | Média | ThemeMode test alignment | `packages/contracts/src/theme/` | Conformité accessibilité |
| MOS-011 | Média | Document grants injection pattern | `packages/sdk/src/index.ts` | Besoin documentation |
| MOS-012 | Média | Theme resolution coverage | `packages/contracts/src/theme/` | Couverture incomplète |
| MOS-013 | Média | Health check endpoints | `src/server/middleware/` | Non documenté |
| MOS-014 | Média | Cross-app integration tests | `demo/identity-sales.test.ts` | Couverture limitée |
| MOS-018 | Mauvais chemin | Order service plugin engine | `apps/commerce/src/domain/order.service.ts:88` | Chemin distant |

### Priorisation P1:
- **Sprint 2 (Cette session suivante)** : MOS-005, MOS-011, MOS-012 (theme & grants)
- **Sprint 3** : MOS-013, MOS-014 (health checks & integration tests)
- **Sprint 4** : MOS-018 (order service path)

---

## Phase 3: Medium-Priority P2 Items

| MOS ID | Priority | Task | Component | Risk |
|--------|----------|------|-----------|------|
| MOS-016 | Faible | `any` type in test | `src/server/middleware/maintenance-gate.test.ts:85` | Qualité type |
| MOS-017 | Faible | Unused variables in slop suite | `packages/conformance/src/suites/slop/*` | Nettoyage |
| MOS-019 | Faible | Aligned import styles | Multiple `apps/*/presentation/` | Consistence |

### Priorisation P2:
- Traitement après validation P1, ou en parallèle si ressources disponibles.
- Impact mineur sur la sécurité mais important sur la maintenabilité.

---

## Phase 4: Documentation et Rapports

| Tâche | Description | Fichier ciblé |
|-------|-------------|---------------|
| Mettre à jour le dashboard | Reflecter les nouveaux statuts et métriques | `.project/dashboard.md` |
| Créer un rapport de session | Journalisation des décisions et changements | `.project/reports/session-YYYY-MM-DD.md` |
| Mettre à jour la state du projet | Progression globale et roadmap | `.project/project_state.md` |
| Créer/maj des ADR | Décisions d'architecture si nécessaires | `.project/decisions/` |

---

## Execution Plan (Sprints)

### Sprint 1 - Session en cours:
- [x] Vérifier la compilation TypeScript
- [x] Valider les changements avec `git diff`
- [x] Fermer les P0 restants (déjà complétés)

### Sprint 2 - Prochainement:
- [ ] Corriger MOS-005 (ThemeMode test alignment)
- [ ] Corriger MOS-011 (Document grants pattern)
- [ ] Corriger MOS-012 (Theme resolution coverage)
- [ ] Mise à jour documentation associée

### Sprint 3 - Après validation P1:
- [ ] Corriger MOS-013 (Health check endpoints)
- [ ] Corriger MOS-014 (Cross-app integration tests)
- [ ] Corriger MOS-018 (Order service plugin engine path)

### Sprint 4 - Nettoyage et fin:
- [ ] Corriger MOS-016 (any type test)
- [ ] Corriger MOS-017 (unused variables slop)
- [ ] Corriger MOS-019 (import styles alignment)
- [ ] Rapports finaux et mise à jour documentation
- [ ] Validation CI/CD
- [ ] Passage au statut "Production Ready"

---

## Success Metrics

| Métrique | Cible | Statut actuel |
|----------|-------|---------------|
| P0 Critique | 3/3 ✅ | Terminé |
| P1 Élevés | 6/6 en cours | 0 terminé |
| P2 Moyens | 3/3 planifiés | 0 terminé |
| Couverture tests | ≥80% | À vérifier |
| Niveau de confiance | ≥95% | 90% (post-P0) |

---

## Validation Requise

Avant validation finale :

1. ✅ Tous les P0 critiques résolus
2. ✅ Compilation TypeScript sans erreur
3. ✅ Tests unitaires passent (couverture adéquate)
4. ✅ Rapport de session créé
5. ✅ Dashboard mis à jour
6. ✅ Passage en production autorisé par l'équipe

---

## Chantiers (Workstreams) Summary

| Château | Focus | Priorité | État |
|---------|-------|----------|------|
| **Château 1** | Corrections Critiques (P0) | Critique | ✅ Terminé |
| **Château 2** | Gaps Résiduels P1 | Élevé | 🟡 En cours |
| **Château 3** | Gaps P2 + Nettoyage | Moyen | ⚪ Non commencé |
| **Château 4** | Documentation & Rapports | Variable | ⚪ En parallèle |

**Note** : Chaque château peut être subdivisé en sous-tâches par session. La priorité est donnée aux items P1 critique pour atteindre le seuil de 95% de confiance avant le passage en production.

---

*Plan généré suite à l'audit technique vérifié. Score de confiance post-P0: 90%. Objectif: atteindre ≥95% avant déploiement production.*