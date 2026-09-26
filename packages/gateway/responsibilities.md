# Responsabilites — gateway

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/gateway` |
| Version | `0.1.0` |
| Couche | Entree runtime (Layer 5) |

## Raison d'etre

Serveur HTTP de production : branchement au RouteRegistry du kernel, middlewares zero-trust OIDC, rate limiting, exposition /openapi.json.

## Responsabilites

- Serveur HTTP de production : branchement au RouteRegistry du kernel, middlewares zero-trust OIDC, rate limiting, exposition /openapi.json.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

auth, core, http, pipeline, telemetry, types.

## Frontieres

- Aucune logique metier ; ne parle aux apps que via Router/Capabilities.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
