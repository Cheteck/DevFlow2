# BAC Commerce — Offres Agnostiques, Enchères & Tunnel de Vente

## 1. Vue d'ensemble
Le BAC **Commerce** (`@apps/commerce`) gère la vente de biens et services de manière totalement agnostique pour toute entité vendeuse (`SellerEntityRef` : Space, Tenant, User, Collective) via des offres (`CommerceOffer`), l'allocation de stock, les tunnels de paiement avec webhooks HMAC sécurisés (`Stripe/Adyen`), et un système d'enchères en temps réel avec traçabilité Merkle/SHA256.

## 2. Architecture & Services
- **`CommerceOfferService`** : Gestion et publication des offres commerciales liées aux `portfolio_vendables`.
- **`AuctionService`** : Moteur d'enchères avec verrouillage pessimiste `SELECT FOR UPDATE` et anti-sniping.
- **`PspWebhookHandler`** : Traitement sécurisé des webhooks de paiement.

## 3. Modèle de Données & Tables SQL
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
