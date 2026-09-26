# Responsabilites — app solidarity

| Champ | Valeur |
|---|---|
| Nom | `@apps/solidarity` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Coordination de crise |

## Raison d'etre

Signalements, besoins, dons, hubs/entrepots, missions, confirmations de distribution ; capabilities solidarity.* (incident/need/donation/hub/mission).

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Incidents, alertes de crise, besoins/demandes d'aide, dons (intentions + suivi), hubs/entrepots, missions, benevoles, distributions, matching geospatial (Haversine), arbre de Merkle (traçabilite), file offline, checklists, rapports OCHA/HXL.

## References externes (par ID, jamais de jointure)

- Acteurs → Citadelle/Spaces (par ID) ; beneficiaires pseudonymises (ne jamais stocker d'identite directe).

## Invariants frontieres (ADR-0016)

1. **Source de verite des operations de solidarite** — ne remplace ni l'alerte nationale, ni l'identite, ni les paiements.
2. **Dons financiers → futur Payments** : Solidarity suit l'intention et la distribution, pas la transaction.

## Ecarts cible-vs-reel

- [ ] Pseudonymisation beneficiaires : audit RGPD dedie (donnees sensibles, terrain).

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
