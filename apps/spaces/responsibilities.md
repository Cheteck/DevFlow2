# Responsabilites — app spaces

| Champ | Valeur |
|---|---|
| Nom | `@apps/spaces` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Entites & pages modulaires |

## Raison d'etre

Paradigme Pages/Spaces : entites, modules activables, roles equipe, acting-as-space + audit ; capabilities spaces.space.create / spaces.module.toggle.

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Spaces (`spaces_spaces` : slug, categorie, template, `ownerId`, `team[]`, `enabledCapabilities`, domaine, navigation publique).
- Equipes et roles locaux (`owner|administrator|editor|moderator|analyst`), demandes d'adhesion, audience/followers du Space.
- Registre metier (`business-registry` : verify/reject/revoke), contexte `acting-as-space` + piste d'audit.
- Ressources **possedees en propre** par le Space (pages, medias de marque).

## References externes (par ID, jamais de jointure)

- `ownerId` / `member.userId` → Citadelle (opaque).
- `enabledCapabilities` → capabilities declarees par les BACs (activation, pas reimplementation).
- Ressources metier (offres, commandes, publications) → **references par ID**, propriete au BAC competent.

## Invariants frontieres (ADR-0016)

1. **Ownership ≠ propriete metier** (arbitrage 2, ADR-0016) : le Space est acteur et contexte d'action ; une commande passee *dans* un Space appartient a Commerce, une publication a Solara.
2. **Un Space n'est ni un compte utilisateur ni un commerce autonome.**
3. **`acting-as-space` toujours audite** (qui, quel Space, quel role, quelle capability).

## Ecarts cible-vs-reel

- [ ] Verifier qu'aucune logique commande/paiement ne s'est glissee dans `business-registry` ou les templates (revue ciblee).

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
