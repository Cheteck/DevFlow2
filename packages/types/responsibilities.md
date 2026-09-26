# Responsabilites — types

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/types` |
| Version | `0.1.0` |
| Couche | Fondation (Layer 1) |

## Raison d'etre

Types et enveloppes partages sans dependance : TenantIdentity, MosaixEventEnvelope, PermissionString, statuts d'app, utilitaires d'ID (uuidV7).

## Responsabilites

- Types et enveloppes partages sans dependance : TenantIdentity, MosaixEventEnvelope, PermissionString, statuts d'app, utilitaires d'ID (uuidV7).
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

contracts, schemas, core, ports, adapters, apps.

## Frontieres

- Aucune logique metier, aucune validation runtime (Zod), aucun import workspace.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
