# Responsabilites — mcp

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/mcp` |
| Version | `0.1.0` |
| Couche | Interoperabilite agents |

## Raison d'etre

Couche Model Context Protocol : serveurs, tool-registry, resource-registry, prompt-registry, providers, garde-fous security pour agents externes.

## Responsabilites

- Couche Model Context Protocol : serveurs, tool-registry, resource-registry, prompt-registry, providers, garde-fous security pour agents externes.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

contracts, core, schemas, security, types.

## Frontieres

- N'execute pas de modele LLM lui-meme.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
