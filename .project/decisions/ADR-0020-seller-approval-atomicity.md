# ADR-0020 — Approbation vendeur atomique au niveau métier (saga idempotente)

**Status:** Accepted (réserve D3 levée — atomicité verrouillée, implémentation : SELL-FLOW-01)
**Date:** 2026-10-12
**Deciders:** Maintainer (verdict : feu vert sous réserve de verrouiller D3)

---

## Context (faits vérifiés)

1. **Même base transactionnelle** : un seul `DatabasePort` partagé (`bootstrap/app.ts`, singletons `database`/`databasePort`) ; schémas `portfolio.*` + `commerce.*` cohabitent dans le même Postgres. Une transaction SQL unique serait physiquement possible.
2. **Mais les transactions imbriquées ne sont PAS atomiques** : `PostgresDatabaseAdapter.transaction()` ouvre une connexion dédiée par appel top-level (checkout) ; un appel imbriqué retombe sur le pool partagé (savepoints sur une autre connexion). Toute saga qui imbriquerait `db.transaction()` (ex. via `repo.save()` dans un `approve()` transactionnel) serait **silencieusement non atomique**. Piège documenté, à ne jamais emprunter pour ce flux.
3. **Aucun arbitre de concurrence côté offres** : `commerce.offers` sans `proposalId`, sans UNIQUE partiel (précédent existant : `uniq_orders_idempotency`, `uniq_payment_intents_idempotency`) ; `approve()` publie et n'appelle rien ; `commerce.offer.create` n'existe pas en capability ; aucun appel inter-BAC par capability n'existe (seuls liens UI + lectures SQL directes + events déclarés).
4. **Events déclarés, chaîne non câblée** : `portfolio.vendable.published` jamais publié par le flow proposal ; le plugin Solara attend un payload avec prix absent du schéma (incohérence existante, hors périmètre — notée, non réparée ici).
5. **Droit de vendre vérifiable** : `SpaceService.isUserAdmin(spaceId, userId)` + `SpaceRolePolicyEngine.evaluateCapabilityAccess` existent côté Spaces ; `SellerEntityType` accepte `"space"`.

## Decision

> **Saga orchestrée idempotente à étapes séquentielles top-level (jamais imbriquées), arbitrée par contraintes DB, sans approbation partielle visible. Pas d'event-sourcing ; pas de transaction SQL unique comme mécanisme (piège §2).**

### Règles

1. **Termes soumis vs approuvés** : `commercialTerms` (dernière version soumise, éditable en Draft/ChangesRequested) ; `approvedTerms` (snapshot exact consommé) + `offerId` + `auditTrail` (append-only : transitions, acteur, feedback) écrits **si et seulement si** tout a réussi.
2. **Idempotence persistante** : `offerId` sur Proposal + `UNIQUE PARTIEL (proposalId) WHERE NOT NULL` sur `commerce.offers` (précédent : idempotency des orders/payments) ; fast-path `Approved` → retourne l'existant ; reprise sur 23505 et sur `DuplicateVendableReferenceError` (relecture de l'existant par référence) ; doubles approbations concurrentes convergent via les contraintes, jamais deux offres.
3. **Fail explicite** : parcours commercial sans `OfferProvisioningPort` câblé → `approve()` lève (jamais de repli silencieux). Rétrocompat : proposals sans `commercialTerms` = parcours non commercial inchangé.
4. **Validation bloquante pré-approbation** : prix>0 (CHECK existant `offers_values_check`), devise `[A-Z]{3}`, stock ≥ 0, vendeur `{type:"space"}` résolu, droit de vendre vérifié **au point d'entrée Spaces** (identité serveur, jamais champ client).
5. **Événements selon leurs contrats** : `portfolio.vendable.published` **sans** données commerciales ; **nouveau** `commerce.offer.activated` (offerId, vendableId, seller, priceInCents, currency, stockAllocation?, status) + capability `commerce.offer.create` déclarée ; émission via port injecté (adaptateur shell vers le backplane existant — précédent `psp-webhook-handler`).
6. **Aucune approbation partielle visible** : `Approved` + ids écrits en dernier, uniquement après vendable ET offre confirmés ; tout échec avant = statut `InReview` inchangé + erreur explicite (rejouable).

## Consequences

- Nouveau contrat fort : *une approbation commerciale réussie ⇒ vendable + offre + events vérifiables, sinon rien de visible*.
- Suivi hors périmètre : alignement du plugin Solara sur les contrats (pas d'enrichissement artificiel), `space_members` vs JSON embarqué (dette connue), documentation du piège `transaction()` imbriquée pour les futurs chantiers.
