# Responsabilites — http

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/http` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

SDK HTTP : Controller, Router, HttpRequest/Response, generateur OpenAPI, static file handler.

## Responsabilites

- SDK HTTP : Controller, Router, HttpRequest/Response, generateur OpenAPI, static file handler.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par core, gateway, control-plane, apps (presentation/).

## Frontieres

- Aucun serveur reseau (voir gateway).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
