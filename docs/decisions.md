# Décisions d'architecture — MosaiX / DevFlow2

**ADR-lite — 2026-11-08 — Refactor incrémental, pas de réécriture**

## Contexte

Le monorepo MosaiX est une architecture hexagonale modulaire organisée en Bounded Application Contexts (BACs autonomes dans `apps/`) avec un `RuntimeKernel` arbitre (`packages/core/src/kernel.ts`). Aucun accès direct aux données n'est détecté dans l'UI (contrôle 1 respecté). Néanmoins, plusieurs god-objects grossissent (`src/shell/renderer.ts` 1 684 L, `src/start.ts` 695 L, `packages/feed-engine/src/index.ts` 1 403 L) et la configuration est éparpillée dans 42 fichiers (`process.env` sans module central + fail-fast). Un risque de perte de données silencieuse est documenté (`KNOWN-03`, dead-letter queue sans log, P0).

## Décision

Garder l'architecture hexagonale modulaire (monolithe) et ne **pas** réécrire. Traiter la dette technique par refactor incrémental, réversible, en commençant par le **logging des événements mis en dead-letter queue** de l'event bus (`packages/core/src/event-bus.ts`, bloc `deliver`, lignes 236–242), suivi d'un test unitaire.

## Alternatives écartées

- Réécriture complète des god-objects (renderer.ts, start.ts, feed-engine) : interdite par la règle d'or "jamais de réécriture" ; risque de régression élevé.
- Passage aux microservices / file de messages externe / CQRS : aucun problème mesuré (latence, coût, équipe bloquée) que le monolithe modulaire n'adresse pas ; coût de complexité non justifié.
- Ajout d'une bibliothèque de validation d'environnement tierce avant migration des 42 fichiers : règle de trois non satisfaite ; ajout de dépendance non justifié pour un premier pas.

## Conséquences

- Risque de perte de données réduit : tout événement en DLQ génère un log structuré (event ID, subscriber, error, attempts, failedAt).
- Aucun changement d'interface publique ; modification localisée et réversible (`git revert`).
- Prépare le terrain au découpage incrémental des god-objects prévu par `.project/architecture/god-objects-remediation-plan.md` (étapes P0→P2).
- À réévaluer après ce premier refactor avant d'aborder la centralisation de la configuration (contrôle 7).
