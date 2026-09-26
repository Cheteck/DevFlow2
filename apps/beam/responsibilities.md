# Responsabilites — app beam

| Champ | Valeur |
|---|---|
| Nom | `@apps/beam` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Messagerie temps reel |

## Raison d'etre

Conversations directes/groupe, dispatch de messages, capabilities beam.message.send / beam.conversation.create, consomme feed-engine + events.

## Responsabilites

- Respecter le schema canonique : `mosaix.json`, `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine), couches `domain/` (pur), `application/` (CQRS/capabilities/events), `infrastructure/` (controllers avec `Guard.authorize`, repositories persistent-first), `presentation/`.
- Declarer capabilities versionnees + schemas d'evenements ; enregistrer au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persistance : DatabasePort d'abord, fallback in-memory uniquement si aucun adapter fourni.

## Interactions

Monte sur `RuntimeKernel` via conteneur enfant par tenant. Communique inter-apps uniquement par capabilities/evenements (aucun import direct inter-apps). Infra via ports/adapters.


## Donnees possedees (source de verite)

- Conversations (directes/groupe), participants, messages, pieces jointes, accuses, presence, recherche, E2E (ECDH/AES-GCM), upload fragmente, purge RGPD, bot commands.

## References externes (par ID, jamais de jointure)

- Participants → Citadelle (opaque) ; pieces jointes via StoragePort.

## Invariants frontieres (ADR-0016)

1. **Conversations privees uniquement** : ni feed social (Solara), ni notifications systeme generiques, ni bus metier inter-BAC (infra events MosaiX).
2. **CIBLE : Beam ne distribue pas les notifications produit** (BOUND-04).

## Ecarts cible-vs-reel

- [ ] **Ecart (cible vs reel)** : tables `beam_notifications` + `beam_push_subscriptions` — la notification transverse est absorbee. Geler toute extension notif ici ; extraction vers Notifications (BOUND-04).

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
