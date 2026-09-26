# Responsabilites — mobile-bridge

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/mobile-bridge` |
| Version | `0.1.0` |
| Couche | Pont mobile |

## Raison d'etre

Connectivite Android/iOS : auth PKCE, push FCM, App Links, delta-sync, codegen client.

## Responsabilites

- Connectivite Android/iOS : auth PKCE, push FCM, App Links, delta-sync, codegen client.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

auth, core ; consomme par apps exposees mobile.

## Frontieres

- Aucune app mobile livree.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
