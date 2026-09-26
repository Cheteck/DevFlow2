# Responsabilites — contracts

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/contracts` |
| Version | `0.1.0` |
| Couche | Fondation (Layer 1) |

## Raison d'etre

Contrats canoniques du domaine : applications, plugins, capabilities, experiences, themes, evenements, securite, routes, runtime, platform. Source de verite typage.

## Responsabilites

- Contrats canoniques du domaine : applications, plugins, capabilities, experiences, themes, evenements, securite, routes, runtime, platform. Source de verite typage.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

types en dependance ; consomme par schemas, core, sdk, apps, plugin-engine, mcp.

## Frontieres

- Aucune implementation runtime, aucune validation Zod, aucune dependance infra.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
