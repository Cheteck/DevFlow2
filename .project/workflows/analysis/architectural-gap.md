# Workflow — Architectural Gap Analysis

- **Catégorie :** `analysis`
- **Commande :** `/workflow analysis architectural-gap`
- **Niveau de risque par défaut :** `medium`
- **Chemin :** `.project/workflows/analysis/architectural-gap.md`

## Purpose

Identifier l'écart entre l'**architecture intentionnelle** (décisions ADR, principes
directeurs, plans Control/Runtime/Applications, modèle de gouvernance et de
communication) et l'**architecture implémentée** (patterns réels, responsabilités,
conformité aux principes). Contrairement au gap structurel (forme physique du code :
packages, imports, frontières), le gap architectural mesure **la conformité aux
décisions et principes** : est-ce que le système est *conçu* comme annoncé, pas
seulement *organisé* comme annoncé.

## Trigger

- À la fin d'un milestone : les décisions ADR et les principes roadmap sont-ils respectés dans l'implémentation ?
- Avant de figer une API publique ou de stabiliser une frontière.
- Quand `audit/architecture` détecte des dérives de patterns ou de responsabilités.
- Quand un nouveau pattern apparaît sans ADR (Architecture Drift Prevention).

## Inputs

- source : `roadmap.md` (§2 piliers, §3 décisions, §7 plans, §10 principes 1-18), ADR dans `decisions/`, contrats (`@mosaix/contracts`), modèle de communication (Event Envelope, Permission Grammar, Authorization Engine)
- réel : implémentation (`packages/`, `apps/`), patterns de code utilisés, points d'application des règles (kernel, registres, engine), tests de conformité
- historique des décisions : quelles ADR existent et sont-elles suivies

## Process

1. **Inventorier les décisions et principes** — lister ce qui doit guider l'implémentation :
   - ADR (statut Accepted et leur contenu)
   - principes directeurs (§11 roadmap : « Applications ne communiquent jamais directement », « Runtime Kernel est le point d'application unique », « Everything is a Contract », …)
   - décisions verrouillées (§3 : isolation Web Workers, Dual Event Bus, Minimal Manifest, permission `domain:resource:action:scope`)

2. **Confronter à l'implémentation** — pour chaque décision/principe, vérifier le point de
   contrôle réel : où est-il appliqué ? Est-il appliqué partout ? Est-il testé ?

3. **Classer chaque écart** :

```
PrincipleViolation  — principe roadmap non respecté par le code
AdrNotFollowed      — ADR Accepted non appliquée dans l'implémentation
AdrSuperseded      — implémentation contredit une ADR (à re-évaluer ou marquer Superseded)
PatternNotDocumented — nouveau pattern/approche sans ADR (dérive)
GovernanceGap      — modèle de gouvernance promis (Control Plane) non matérialisé
EnforcementGap     — règle architecture non vérifiée automatiquement (fiable au push, pas à la revue)
```

4. **Vérifier les garde-fous** — la règle est-elle testée (tests de conformité) ou
   uniquement documentée ? Une règle non enforceable dérive silencieusement.

5. **Prioriser** — Decision Score (Phase 4 AGENTS.md) : impact sur la cohérence
   long terme, la sécurité (gouvernance), le coût de correction.

6. **Transcrire** — tâches backlog (mise en conformité, création d'ADR, ajout de
   tests de conformité), décisions ADR à revalider, notes d'architecture.

## Outputs

- `.project/reports/architectural-gap.md` :

```markdown
# Architectural Gap Analysis

## Décisions & principes vs implémentation
Intention | Point d'application réel | Conforme ? | Écart | Sévérité | Testé ?
...

## ADR à revalider / marquer Superseded
- ...

## Patterns non documentés (dérive)
- ...

## Backlog Candidates
- ...
```

- Tâches backlog priorisées (type `refactor`, `docs` (ADR), `security` si gouvernance).
- ADR créés ou mis à jour si la réalité contredit une décision.

## Validation

- Chaque écart est relié à une décision/principe identifiable et à une preuve dans le code.
- La conformité est distinguée « vérifiée par test » vs « vérifiée visuellement » vs « non vérifiée ».
- Aucune décision rejetée sans analyse : une contradiction implémentation/ADR est documentée (Superseded) ou corrigée.

## Risks

- Confondre avec le gap structurel → le gap architectural traite *la conformité aux décisions*, pas la forme physique (faire les deux via `analysis/structural-gap`).
- ADR obsolètes jamais relues → le workflow doit périodiquement ré-évaluer le statut des décisions.
- Règles « documentées mais non testées » → prioriser les tests de conformité (fiable).