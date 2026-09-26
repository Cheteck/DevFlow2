# Responsabilites — app solara

| Champ | Valeur |
|---|---|
| Nom | `@apps/solara` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Feed social |

## Raison d'etre

Publications polymorphes (sondages, articles, showcases), commentaires, reactions, followers, hooks de moderation ; capabilities solara.* ; etendu par plugin solara-content-moderator.

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Publications polymorphes (articles, sondages, showcases), commentaires, reactions, follows, feed + scoring, visibilite, rich media OpenGraph, groupes, realtime, analytics, moderation 3-tiers (+ plugin `solara-content-moderator`), auto-share, contenu sponsorise.

## References externes (par ID, jamais de jointure)

- Auteur → Citadelle/Space (par ID) ; ressources referencees (vendable, offre, Space) **par ID**, jamais dupliquees.

## Invariants frontieres (ADR-0016)

1. **Possede interactions + contenu social, pas les objets references** : un post peut montrer un produit sans le posseder.
2. **Moderation = pipeline a hooks** (stages injectables), pas de censure en dur.

## Ecarts cible-vs-reel

- [ ] `sponsoredPool` : formaliser la frontiere publicitaire (post sponsorise ≠ offre Commerce) ou extraire vers Billing/Ads plus tard.

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
