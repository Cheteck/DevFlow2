# RFC Process — MosaiX

## Purpose

Transformer une idée en décision architecturale tracée, sans précipitation ni omission.

---

## Trigger

Toute proposition qui :
- modifie une loi de la Constitution
- introduit un nouveau contrat runtime (event, capability, permission, manifest, policy)
- change l'API publique du Kernel, du SDK ou des packages `types/contracts/schemas`
- impacte la sécurité, la gouvernance ou la compatibilité ascendante

---

## Inputs

- Problème identifié (pain point, opportunité, risque)
- Contexte technique (code concerné, ADR existants, roadmap)
- Contraintes (performance, sécurité, compatibilité, délai)

---

## Process

### 1. Capture (Idea → RFC Draft)

```bash
/workflow capture architecture-rfc "Titre court"
```

Crée : `.project/working/RFC-XXXX-title.md` (template ci-dessous)

**Template RFC :**
```markdown
# RFC-XXXX: Titre

## Status
Draft | Under Discussion | Accepted | Rejected | Superseded

## Problem
Quel problème résout ce RFC ? Pourquoi maintenant ?

## Context
- ADR existants concernés
- Code impacté (packages, fichiers)
- Risques connus

## Proposal
Description technique précise (API, contrats, schémas, flux)

## Alternatives Considered
- Option A : pourquoi rejetée
- Option B : pourquoi rejetée

## Consequences
### Positive
### Negative
### Risks

## Implementation Plan
- Étapes (liens vers tâches backlog)
- Migration si breaking change
- Tests requis

## Open Questions
- Points non tranchés
```

### 2. Discussion (7 jours minimum)

- Publier dans l'espace de discussion (GitHub Discussions / fichier RFC)
- Inviter les parties prenantes (mainteneurs, domain experts)
- Recueillir objections, améliorations, cas limites
- **Aucune décision avant 7 jours** (sauf urgence sécuritaire justifiée)

### 3. Decision

| Issue | Action |
|-------|--------|
| Consensus | → Accepted, passer à ADR |
| Objections majeures non résolues | → Rejected (documenter pourquoi) |
| Besoin d'expérimentation | → Prototype (Spike), puis retour à 2 |

### 4. ADR Creation

Si Accepted :

```bash
/workflow architecture adr-create "Titre" --rfc RFC-XXXX
```

Crée `.project/decisions/ADR-XXXX-title.md` avec :
- Contexte (depuis RFC)
- Décision
- Conséquences
- Alternatives rejetées
- Références (RFC, code, specs)

### 5. Implementation

- Créer tâches backlog (phase correspondante)
- Implémenter avec tests, docs, migration
- `pnpm check` vert à chaque commit

### 6. Audit (Post-Implementation)

```bash
/workflow audit milestone
```

Vérifie : implémentation conforme à l'ADR, tests couvrent les cas limites, docs à jour, aucune régression.

---

## Outputs

- RFC accepté/rejeté (archivé dans `.project/rfc/`)
- ADR créé (si accepté) dans `.project/decisions/`
- Tâches backlog créées
- Implémentation committée
- Audit report dans `.project/reports/`

---

## Validation

- RFC suit le template complet
- Discussion ≥ 7 jours (horodatée)
- ADR référence le RFC
- Code implémenté + tests + docs
- Audit passed

---

## Risks

- RFC bloqué trop longtemps → timebox à 30 jours, puis escalade
- Décision sans RFC → rollback immédiat si détecté
- ADR sans implémentation → marquer `Deferred` avec date butoir