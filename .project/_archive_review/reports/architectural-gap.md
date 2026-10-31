# Architectural Gap Analysis

## Décisions & principes vs implémentation
| Intention | Point d'application réel | Conforme ? | Écart | Sévérité | Testé ? |
|---|---|---|---|---|---|
| Runtime Kernel comme point d'application unique | `packages/core/src/kernel.ts` | Oui | Aucun | N/A | Oui |
| Contrats et Schémas partagés | `packages/contracts`, `packages/schemas` | Oui | Aucun | N/A | Oui |
| Interdiction de stockage en mémoire en production | `packages/support/src/in-memory-guard.ts` | Oui | Aucun | N/A | Oui |
| Pattern Service Provider obligatoire | Tous les BACs (`apps/*`) | Oui | Aucun | N/A | Oui (Build) |

## ADR à revalider / marquer Superseded
- Toutes les ADR en cours sont pleinement appliquées.

## Patterns non documentés (dérive)
- Aucun pattern non documenté détecté.

## Backlog Candidates
- [ ] Documenter formellement la règle `InMemoryGuard` dans `.project/architecture/`.
