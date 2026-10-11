# BAC Commerce — Offres Agnostiques, Enchères & Tunnel de Vente

## 1. Vue d'ensemble
Le BAC **Commerce** (`@apps/commerce`) gère la vente de biens et services de manière totalement agnostique pour toute entité vendeuse (`SellerEntityRef` : Space, Tenant, User, Collective) via des offres (`CommerceOffer`), l'allocation de stock, les tunnels de paiement avec webhooks HMAC sécurisés (`Stripe/Adyen`), et un système d'enchères en temps réel avec traçabilité Merkle/SHA256.

## 2. Architecture & Services
- **`CommerceOfferService`** : Gestion et publication des offres commerciales liées aux `portfolio_vendables`.
- **`AuctionService`** : Moteur d'enchères avec verrouillage pessimiste `SELECT FOR UPDATE` et anti-sniping.
- **`PspWebhookHandler`** : Traitement sécurisé des webhooks de paiement.

## 3. Modèle de Données & Tables SQL (schéma isolé `commerce.*` depuis v1.002, préfixes débruités)
- `commerce_offers` : `(id, seller_type, seller_id, vendable_id FK, price_in_cents, currency, status, stock_allocation, commission_rate_bps, created_at)`
- `commerce_orders` : `(id, buyer_id, offer_id FK, total_amount, currency, status, created_at)`
- `commerce_payment_intents` : `(id, order_id FK, amount, currency, status, client_secret, metadata)`
- `commerce_auctions` & `commerce_auction_bids` : Gestion des enchères et des historiques de mises vérifiables par hachage SHA256.

## 4. Capacités & API Endpoints
- `commerce.offer.create` — Publication d'une offre commerciale sur un vendable.
- `POST /commerce/orders` — Passage de commande et initialisation du paiement.
- `POST /api/psp/webhook` — Réception des statuts de paiement sécurisés.

## 5. Contributions UI & Slots
- Catalogue e-commerce, panier d'achat, tunnel de paiement et salle d'enchères en direct.

## 6. Frontières normatives (cf. `apps/commerce/responsibilities.md`, `apps/portfolio/responsibilities.md`)
- `portfolio` définit le vendable (PIM) ; `commerce` définit l'offre et orchestre sa vente. Aucun prix, stock, promotion ou inventaire dans `portfolio`.
- `stock_allocation` est une **référence d'allocation commerciale**, pas une propriété du vendable ; le stock physique est isolé derrière `InventoryPort` (extraction future vers `@apps/inventory` si la complexité l'exige).
- Un Space peut vendre un vendable sans en devenir propriétaire : il devient vendeur/contexte de distribution (`sellerId`/`spaceId` par ID, sans jointure).
- Paiement et facturation sont en extraction future (`BOUND-02` Payments, `BOUND-03` Billing) : en attendant, `PaymentPort` + adapters isolés, aucune nouvelle logique financière dans Commerce.
- Disponibilité ≠ toujours stock : `Inventory` tranche pour le stocké, `Booking` pour le réservable.

## 7. Décisions de modélisation vérifiées (v1.002/v1.003, base live)
- **Schéma isolé** : 8 tables sous `commerce.*` (noms débruités) ; les remarques de syntaxe/ordre portaient sur un export, pas sur nos migrations compilées (index valides, parents créés avant dépendants, FK présentes).
- **Monnaie** : totaux commande en `NUMERIC(12,2)` (`totalAmount`/`taxAmount` ≥ 0), prix unitaires en centimes entiers ; conversion au boundary PSP via `Money` VO (`DATA-06`), jamais de float ambigu en base.
- **Commandes mono-produit** : `vendableId` requis, `lineItems` JSON = instantané complémentaire (pas de table `order_items` — le code est mono-produit ; multi-produit = décision produit + ADR avant tout schéma).
- **Idempotence** : `idempotencyKey` + UNIQUE partiel, appliqué dans `OrderService.createOrder` (rejouement → commande d'origine, pas de double débit) ; transitions via `OrderStateMachine` (`setOrderStatus` valide l'arête, états terminaux bloqués).
- **Multi-offre autorisée** : pas d'unicité `(vendableId,sellerId)` — même produit vendu par N Spaces à N prix (modèle validé).
- **Paniers** : `carts.data` = métadonnées uniquement (jamais d'articles dupliqués) ; `UNIQUE(userId)` réel (index unique, pas contrainte).
- **Enchères** : moteur 100 % mémoire (`AuctionService`, exécution synchrone donc atomique intra-processus, volatil + mono-instance) ; tables `auctions`/`auction_bids` = cible de persistance (chantier AUCTION-PERSIST) ; anti-sniping = prolongation à chaque offre dans la fenêtre (`extensionsCount` tracé) ; audit `sha256(bidId:auctionId:bidderId:amount:timestamp:prevHash)`, origine `GENESIS`.
- **Paiements** : `clientSecret` supprimé (jamais écrit par le code) ; `provider`/`providerPaymentId` (UNIQUE)/`idempotencyKey` (UNIQUE) ; table `payment_refunds` (une ligne par remboursement, chaîne `received ≥ refunded` en CHECK) ; statuts `PaymentIntentStatus` en CHECK.
- **Statuts par table conservés** (conventions hétérogènes héritées : `Pending…` commandes, minuscules enchères, MAJUSCULES offres) — renommage refusé (rupture code+données sans bénéfice).
- **Pas de FK inter-BAC** (références par ID, jamais de jointure) ; `cart_items.offerId` → `offers(id)` seule FK ajoutée (même BAC).
