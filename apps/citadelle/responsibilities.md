# Responsabilites — app citadelle

| Champ | Valeur |
|---|---|
| Nom | `@apps/citadelle` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Identite (Identity BC) |

## Raison d'etre

Authentification, credentials, tokens, sessions, profils ; capabilities identity.user.create/lookup ; binaire start.ts (`start:citadelle`) ; s'appuie sur packages/auth + stores.

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Identites (`identities` : email, password_hash scrypt, roles) — source de verite de l'identite des acteurs.
- Credentials, sessions, tokens (stores via ports), comptes sociaux lies, recovery.
- Parcours d'inscription (registration-wizard) : validation, CGU, type de compte.

## References externes (par ID, jamais de jointure)

- `ownerUserId`, `actorId`, `member.userId` → references opaques vers Citadelle (jamais de jointure inter-BAC, jamais de denormalisation d'email).
- Consomme `@mosaix/auth` (Platform Auth, ADR-0012) pour sessions/tokens.

## Invariants frontieres (ADR-0016)

1. **Authentifie, n'autorise pas metier** : Citadelle prouve *qui* (authN) ; chaque BAC decide *quoi* (authZ) via ses policies.
2. **Ni profils metier des Spaces, ni roles d'equipe, ni policies de domaine.**
3. **1 utilisateur → 1 auth plateforme → 1 session → N apps** (ADR-0012).

## Ecarts cible-vs-reel

- [ ] `registration-wizard` attribue des roles metier (`merchant`, `delivery_partner`, `collective_manager`) : trancher — roles techniques d'onboarding vs roles metier (dus aux BACs). Cible : Citadelle n'emeet que des claims d'identite, les roles metier naissent dans Spaces/Commerce (BOUND-07).

## Frontieres

- Aucun import depuis une autre app.
- Aucun acces infra direct hors ports.
- Aucune route sans autorisation.

## Non-responsabilites

- Ne reimplemente pas le kernel, le gateway, ni les adapters.
- N'expose pas de secret.

## Criteres de sante

- [ ] Conforme a `pnpm check:conformance` + `check:manifests`.
- [ ] Tests de domaine verts (`*.test.ts`).
- [ ] OpenAPI genere sans erreur.
