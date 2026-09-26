# Responsabilites — schemas

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/schemas` |
| Version | `0.1.0` |
| Couche | Fondation (Layer 1) |

## Raison d'etre

Validateurs Zod des contracts : ApplicationManifestSchema, grammaire permissions 4-parties, versions SemVer, schemas theme stricts. Validation runtime + manifests.

## Responsabilites

- Validateurs Zod des contracts : ApplicationManifestSchema, grammaire permissions 4-parties, versions SemVer, schemas theme stricts. Validation runtime + manifests.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

contracts + zod ; consomme par core, CLI, scripts de check.

## Frontieres

- Aucune logique metier, aucun acces IO.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
