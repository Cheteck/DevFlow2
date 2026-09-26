# Responsabilites — ui-runtime

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/ui-runtime` |
| Version | `0.1.0` |
| Couche | Plan experience UI |

## Raison d'etre

Composition d'experience : SlotRegistry (contributions par slot, ordre, permission, renderer), I18n, plugins de rendu (qr-code, form-help-sidebar).

## Responsabilites

- Composition d'experience : SlotRegistry (contributions par slot, ordre, permission, renderer), I18n, plugins de rendu (qr-code, form-help-sidebar).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

consomme par apps (frontend/) et shell.

## Frontieres

- Aucun framework frontend impose ; rendu serveur simple (string).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
