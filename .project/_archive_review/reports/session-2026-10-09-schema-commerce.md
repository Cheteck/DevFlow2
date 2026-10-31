# Session 2026-10-09 — Critique schéma commerce traitée (v1.003 fusionnée)

## Méthode
Chaque remarque confrontée au réel (migration compilée + base live + code). Comme pour portfolio : **syntaxe/ordre invalides non reproduits** (index valides, parents créés avant dépendants, FK présentes) — portaient sur un export.

## Migration `commerce.shop.v1.003_harden_commerce` (appliquée en dev)
CHECKs montants/quantités/commissions/devises/dates/statuts (offres, enchères, mises, panier, paiements, commandes) ; `payment_intents` : `provider`/`providerPaymentId` UNIQUE/`idempotencyKey` UNIQUE, `clientSecret` supprimé (jamais écrit par le code), statuts en CHECK ; table `payment_refunds` (FK, CHECK montant>0) ; commandes : `totalAmount/taxAmount >= 0`, `idempotencyKey` + UNIQUE partiel ; FK `cart_items.offerId → offers` ; `uniq_carts_user` pré-existant conservé (index unique, pas contrainte — correction d'une fausse conclusion intermédiaire), `idx_carts_user` redondant supprimé, `orders(userId,createdAt)` ajouté ; `DEFAULT now()` partout + trigger `set_updated_at` (5 tables).

## Code (contreparties applicatives exigées par la critique)
- `OrderService.createOrder` : clé explicite rejouée (pas de 2e commande/débit), `setOrderStatus` valide l'arête via `OrderStateMachine.allowsTransition` (nouveau helper).
- `OrderModel.idempotencyKey` + `findByIdempotencyKey` (Postgres + InMemory) ; `PaymentIntent` : `clientSecret` retiré, champs PSP ajoutés.
- Tests : rejouement idempotent, transition illégale rejetée (16/16 commerce verts).

## Décisions documentées (`docs/bacs/06-commerce.md` §7)
Mono-produit assumé (pas de `order_items`), NUMERIC vs cents (conversion boundary PSP), multi-offre autorisé, `carts.data` métadonnées, enchères mémoire (atomiques intra-processus, volatiles → chantier AUCTION-PERSIST créé au backlog), statuts hétérogènes conservés, pas de FK inter-BAC.

## Incidents de parcours (leçons)
- `RENAME TO` identique et `ADD CONSTRAINT` existant : Postgres refuse — régressions détectées par les tests de migration, corrigées.
- **Checksum guard** : édition d'une migration appliquée → blocage sain du runner ; récupération par annulation + fusion dans une migration non appliquée (v1.004 fusionnée dans v1.003, jamais deux migrations pending sur les mêmes resources `table:` — garde R9 légitime).
- **Rollback `--steps=N`** : l'ordre du ledger (`applied_at` TEXT) a surpris deux fois — toujours vérifier les ids rapportés avant de continuer ; ici aucune perte (tables vides, backup schéma en Temp).
- Preuves par violation : 10 contraintes prouvées, base nettoyée (0 ligne).

## Validation
- `migrate` final : v1.003 appliquée ; 113/113 tests verts (21 fichiers) ; ESLint propre ; dev server HTTP 200 post-restart.
- Reste ouvert : AUCTION-PERSIST, vérification Bearer MCP, `tools/list` registry-driven.

## Git State
- Ajout : migration commerce v1.003 (fusionnée). Modifiés : order.model/service/state-machine, postgres-order-repository, payment-intent, commerce.test.ts, bac-migrations.ts, 06-commerce.md, backlog.
- Aucun commit effectué.
