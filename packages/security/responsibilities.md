# Responsabilites — security

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/security` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Controle d'acces : Policy (regles nommees), Guard.authorize(user, permission, ressource), UserContext. Utilise dans les controllers.

## Responsabilites

- Controle d'acces : Policy (regles nommees), Guard.authorize(user, permission, ressource), UserContext. Utilise dans les controllers.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

sans dependance ; consomme par apps, http, mcp.

## Frontieres

- Ni authentification (voir auth), ni stockage de roles.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
