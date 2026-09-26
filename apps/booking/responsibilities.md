# Responsabilites — app booking

| Champ | Valeur |
|---|---|
| Nom | `@apps/booking` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Reservation de creneaux |

## Raison d'etre

Slots, reservations, capabilities booking.slot.create/list + booking.reservation.create.

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Ressources reservables, calendriers, slots, capacites, regles de reservation, conflits, allocations, confirmations/annulations, waitlist FIFO, rappels T-24/T-1, sync iCalendar RFC 5545, empreinte bancaire (garantie).

## References externes (par ID, jamais de jointure)

- Client → Citadelle (opaque) ; ressource parente (Space, prestataire) par ID.
- Commande parente → Commerce (reference, quand la reservation nait d'un checkout).

## Invariants frontieres (ADR-0016)

1. **Source de verite de la disponibilite** : seul Booking alloue ; Commerce demande, Booking tranche.
2. **Ne possede pas les paiements** (ni l'encaissement, ni les remboursements) — l'empreinte de garantie n'est pas un paiement.

## Ecarts cible-vs-reel

- [ ] Rappels (email/push) durs dans le domaine : migrer vers futur Notifications a sa creation (BOUND-04), garder ici uniquement la planification.

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
