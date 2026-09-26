# Responsabilites — app subscription

| Champ | Valeur |
|---|---|
| Nom | `@apps/subscription` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Abonnements & facturation recurrente |

## Raison d'etre

Plans, souscriptions, metered billing ; capabilities subscription.plan.list / subscribe / metered.record.

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Plans recurrents, souscriptions, periodes/renouvellements/echeances, metering, prorata, essais, coupons, suspension/resiliation/changement de plan, MRR/ARR, webhooks, moteur de relance (dunning retry).

## References externes (par ID, jamais de jointure)

- Souscripteur → Citadelle/Space (par ID) ; droits decoulant de l'abonnement exposes en capabilities.

## Invariants frontieres (ADR-0016)

1. **Source de verite de l'engagement recurrent** — distinct des plans de capacites des Spaces et des abonnements techniques des plugins.
2. **Facturation/encaissement = contrats distincts** (futurs Billing/Payments) : Subscription calcule le du, ne l'encaisse ni ne le facture.

## Ecarts cible-vs-reel

- [ ] `subscription-billing-engine` embarque relances + `notificationMessage` (+ `send_reminder_email`) : extraire vers Notifications (BOUND-04) et Billing (BOUND-03) ; ici = echeancier + decisions uniquement.

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
