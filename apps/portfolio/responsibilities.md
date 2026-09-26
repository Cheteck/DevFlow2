# Responsabilites — app portfolio

| Champ | Valeur |
|---|---|
| Nom | `@apps/portfolio` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — PIM / vendables |

## Raison d'etre

Produits/Services/Experiences/Biens numeriques decoupes (vendables), completude, contenu localise FR/EN/AR, workflow de proposition ; capabilities portfolio.vendable.*.

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Fiches vendables (PIM) : attributs, specifications, variantes descriptives, taxonomie, medias, SEO/slug, traductions FR/EN/AR, completude, index de recherche a facettes.
- WizardsProduit, import/export CSV/JSON, analytics boutique, alertes restock (abonnements email).

## References externes (par ID, jamais de jointure)

- Vendables references **par ID** depuis Commerce (offres), Solara (publications), Spaces (catalogues).
- Medias via StoragePort ; CDN en presentation.

## Invariants frontieres (ADR-0016)

1. **CIBLE : fiche ≠ offre** (ADR-0016) : le PIM decrit et normalise ; seul Commerce vend (prix de vente, stock reservable, panier, commande).
2. **Une fiche n'est pas necessairement achetable** (brouillon, archive, vitrine).

## Ecarts cible-vs-reel

- [ ] **Ecart majeur (cible vs reel)** : `vendable.ts` porte `stock`, `inventory`, `pricing.basePrice` ; `product-wizard` valide prix/stock ; `shop-inventory-report` valorise le stock. Soit regression vers le PIM pur (prix/stock → offre Commerce), soit formalisation d'un « prix catalogue de reference » distinct du « prix de vente » (BOUND-01). A trancher avant tout nouveau champ commercial.

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
