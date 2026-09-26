# Responsabilites — telemetry

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/telemetry` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Metriques + export OTLP de traces : SpanData, OtlpTraceExporter (batch/flush), propagation de contexte cryptographiquement sure.

## Responsabilites

- Metriques + export OTLP de traces : SpanData, OtlpTraceExporter (batch/flush), propagation de contexte cryptographiquement sure.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par gateway, core ; implemente par adapter tracing-otel/metrics-otel.

## Frontieres

- Aucune collecte automatique imposee aux apps.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
