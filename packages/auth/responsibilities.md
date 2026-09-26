# Responsabilites — auth

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/auth` |
| Version | `0.1.0` |
| Couche | Primitif framework (Layer 4) |

## Raison d'etre

Contexte borne Authentification : AuthManager, pipeline, providers registry (local/OIDC/WebAuthn), sessions, challenges, JWT, pont OIDC.

## Responsabilites

- Contexte borne Authentification : AuthManager, pipeline, providers registry (local/OIDC/WebAuthn), sessions, challenges, JWT, pont OIDC.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`).

## Interactions

ports credential-store/identity-store/session/token/id ; consomme par gateway, apps/citadelle.

## Frontieres

- Ne stocke rien lui-meme (delegue aux ports) ; ne gere pas les autorisations fines (voir security).

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
