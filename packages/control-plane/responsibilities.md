# Responsabilites — control-plane

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/control-plane` |
| Version | `0.1.0` |
| Couche | Plan de controle |

## Raison d'etre

Serveur d'administration : inspection topologie, moteur de regles, supervision DLQ/circuit-breaker, preview SQL migrations — monte comme app privilegiee (imperia).

## Responsabilites

- Serveur d'administration : inspection topologie, moteur de regles, supervision DLQ/circuit-breaker, preview SQL migrations — monte comme app privilegiee (imperia).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

core, http, security ; expose l'etat du kernel.

## Frontieres

- Aucune logique metier applicative.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
