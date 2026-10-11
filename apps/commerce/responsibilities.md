# Responsabilités — app commerce

| Champ | Valeur |
| --- | --- |
| Nom | `@apps/commerce` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Vente, offres, checkout & commandes |

## Raison d'être

`commerce` est le **bounded context de vente**.

Il transforme les vendables définis par `portfolio` en **offres commerciales achetables** pour les différents canaux et entités externes, notamment `Spaces`.

Il gère le cycle commercial depuis la définition de l'offre jusqu'à la commande :

- offres de vendables ;
- rattachement vendeur ;
- pricing ;
- promotions ;
- disponibilité commerciale ;
- panier ;
- checkout ;
- commandes ;
- orchestration du fulfillment ;
- intégration avec les systèmes de paiement, booking et inventaire.

`commerce` ne possède pas la définition intrinsèque du vendable. Il la référence depuis `portfolio`.

**Principe directeur : `portfolio` définit le vendable ; `commerce` définit l'offre et orchestre sa vente.**

## Responsabilités

- Respecter le schéma canonique :
  - `mosaix.json` ;
  - `src/index.ts` (`MANIFEST`, `ServiceProvider`, factory `create*App`, re-exports domaine) ;
  - `domain/` : logique métier pure ;
  - `application/` : CQRS, capabilities et événements ;
  - `infrastructure/` : controllers avec `Guard.authorize`, repositories persistent-first ;
  - `presentation/`.
- Déclarer les capabilities versionnées et les schémas d'événements.
- Enregistrer les capabilities et schémas d'événements au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persister via `DatabasePort` en priorité, avec fallback in-memory uniquement lorsqu'aucun adapter n'est fourni.
- Gérer les offres commerciales de vendables `portfolio`.
- Gérer les prix et règles de tarification.
- Gérer les promotions et coupons.
- Gérer la disponibilité commerciale et les réservations de quantité lorsque celles-ci relèvent du stock.
- Gérer panier, checkout et commandes.
- Orchestrer les intégrations avec Payments, Booking, Inventory/Fulfillment et Billing via ports/capabilities/événements.
- Permettre à des entités externes, notamment `Spaces`, de publier ou exposer des offres de vendables `portfolio`.

## Modèle métier

### 1. Vendable

Le vendable est défini par `portfolio`.

Exemples :

- produit physique ;
- service ;
- expérience ;
- bien numérique ;
- variante d'un produit ;
- configuration ou option d'un vendable.

`commerce` ne modifie pas la définition du vendable.

Il le référence par ID.

```
Portfolio
   |
   | vendableId
   v
Commerce
   |
   +--> Offre
```

### 2. Offre commerciale

L'**offre** est l'unité commerciale centrale de `commerce`.

Une offre rend un vendable exploitable commercialement pour un vendeur, un canal ou un contexte donné.

Une offre peut notamment porter :

- `offerId` ;
- `vendableId` ;
- `sellerId` ;
- `spaceId` lorsque le vendeur/contexte est un Space ;
- état de publication commerciale ;
- conditions de vente ;
- pricing ;
- devise ;
- règles de disponibilité ;
- règles de promotion ;
- configuration commerciale ;
- références vers les systèmes d'inventaire ou de booking ;
- contraintes d'achat ;
- métadonnées du canal.

Une offre peut référencer :

- un vendable ;
- une variante du vendable ;
- une configuration du vendable ;
- des options du vendable.

Elle ne duplique pas la fiche PIM.

## Offres pour les entités externes

`commerce` doit permettre à une entité externe de **commercialiser un vendable sans en devenir propriétaire dans Portfolio**.

Exemple :

```
Portfolio
  Vendable V123
       |
       +------------------+
       |                  |
       v                  v
Commerce               Commerce
Offre O001             Offre O002
Space A                Space B
29 EUR                 35 EUR
```

Le même vendable peut donc être proposé :

- par plusieurs Spaces ;
- avec des prix différents ;
- avec des promotions différentes ;
- avec des conditions commerciales différentes ;
- avec des disponibilités différentes ;
- dans des canaux différents.

`Spaces` ne devient pas propriétaire du vendable.

Il peut devenir **vendeur, opérateur, canal ou contexte de distribution**, selon le modèle métier retenu.

### Référence vendeur

Le vendeur est référencé par ID.

Exemples :

- `sellerId` ;
- `spaceId`.

`commerce` ne possède pas la fiche complète du vendeur.

Il ne doit pas effectuer de jointure directe avec `Spaces`.

## Pricing

Le pricing appartient à `commerce`.

Il comprend notamment :

- prix de base de l'offre ;
- devise ;
- prix par quantité ;
- paliers ;
- tarification conditionnelle ;
- prix promotionnel ;
- règles de tarification ;
- arrondis ;
- taxes si elles sont explicitement de la responsabilité de Commerce.

Le prix appartient à **l'offre**, jamais au vendable Portfolio.

```
Vendable
  └── "T-shirt X"

Offer A
  ├── seller = Space A
  ├── price = 29 EUR
  └── promotion = -10%

Offer B
  ├── seller = Space B
  ├── price = 32 EUR
  └── promotion = aucune
```

### Règle

Aucun champ de type :

- `price` ;
- `basePrice` ;
- `salePrice` ;
- `currency` commerciale ;

ne doit être ajouté au modèle `portfolio`.

## Promotions

Les promotions appartiennent à `commerce`.

`commerce` gère notamment :

- promotions ;
- coupons ;
- codes promotionnels ;
- périodes de validité ;
- conditions d'éligibilité ;
- restrictions par offre ;
- restrictions par vendeur ;
- restrictions par canal ;
- limites d'utilisation ;
- règles de cumul ;
- calcul du prix après promotion.

Une promotion peut cibler :

- une offre ;
- un vendeur ;
- un Space ;
- une catégorie commerciale ;
- un panier ;
- un client ;
- une période.

Les règles de promotion ne doivent pas être stockées dans `portfolio`.

## Stock et inventaire

### Responsabilité fonctionnelle

Le stock et l'inventaire sont nécessaires à la vente, mais ils ne sont **pas des propriétés du vendable**.

Le stock représente une ressource opérationnelle associée à une offre ou à une référence commerciale.

Exemple :

```
Portfolio
  Vendable V123
       |
       v
Commerce
  Offer O123
       |
       v
Inventory
  SKU / stock item
       |
       +-- warehouse A : 15
       +-- warehouse B : 8
```

### Découpe recommandée

À court terme, `commerce` peut exposer le contrat de disponibilité et encapsuler un `InventoryPort`.

Cependant, le modèle d'inventaire doit être isolé du domaine `Offer`.

Le domaine Commerce ne doit donc pas transformer :

```
stockQuantity
```

en propriété intrinsèque de :

```
Offer
```

mais plutôt utiliser une abstraction :

```
InventoryPort
```

pour :

- vérifier la disponibilité ;
- réserver une quantité ;
- libérer une réservation ;
- confirmer une consommation ;
- annuler une réservation.

### Extraction future

Si l'inventaire devient complexe, il pourra être extrait vers :

```
@apps/inventory
```

sans modifier le modèle Portfolio.

Cette application pourrait alors posséder :

- stock ;
- mouvements ;
- lots ;
- emplacements ;
- entrepôts ;
- réservations ;
- ajustements ;
- inventaires physiques ;
- transferts ;
- seuils de réapprovisionnement.

`commerce` resterait consommateur de ces capacités.

## Disponibilité

La disponibilité dépend de la nature du vendable.

### Produit physique

La disponibilité peut dépendre de `Inventory`.

### Service / expérience

La disponibilité peut dépendre de `Booking`.

### Bien numérique

La disponibilité peut être intrinsèque ou découler des règles de l'offre.

`commerce` ne doit donc pas coder une hypothèse unique :

```
available = stock > 0
```

Le checkout doit demander au système propriétaire :

- `Inventory` pour les ressources stockées ;
- `Booking` pour les capacités réservables ;
- éventuellement un autre provider pour un type de disponibilité spécifique.

## Variantes et options commerciales

Les variantes et options sont définies descriptivement par `portfolio`.

`commerce` peut leur associer une **interprétation commerciale**.

Exemple :

```
Portfolio
  Produit T-shirt
    Variante:
      couleur = rouge
      taille = XL

Commerce
  Offre:
    variante = V_RED_XL
    prix = 35 EUR
    inventoryRef = SKU-123
```

Ainsi :

- `portfolio` définit la variante ;
- `commerce` définit son offre ;
- `inventory` détermine sa disponibilité physique.

Même principe pour les options.

Une option peut avoir dans Commerce :

- un supplément ;
- une règle de disponibilité ;
- une quantité maximale ;
- une restriction commerciale.

Mais sa définition descriptive reste dans `portfolio`.

## Panier

`commerce` possède le panier.

Le panier référence :

- offres ;
- variantes ;
- options sélectionnées ;
- quantités ;
- prix calculés ;
- promotions appliquées ;
- vendeur ;
- contexte de vente.

Le panier ne doit pas copier la fiche complète du vendable.

## Checkout

`commerce` orchestre le checkout sous forme de saga avec compensation.

Le checkout peut notamment :

1. valider les offres ;
2. recalculer les prix ;
3. appliquer les promotions ;
4. vérifier la disponibilité ;
5. réserver le stock ou la capacité ;
6. initier le paiement via `Payments` ;
7. confirmer les réservations ;
8. créer la commande ;
9. déclencher le fulfillment ;
10. compenser les étapes précédentes en cas d'échec.

Commerce orchestre.

Il ne doit pas devenir propriétaire des domaines spécialisés.

## Commandes

`commerce` possède :

- commandes ;
- lignes de commande ;
- état commercial de la commande ;
- informations nécessaires à l'exécution ;
- références vers les offres ;
- prix effectivement appliqués ;
- promotions effectivement appliquées ;
- quantités commandées ;
- références de fulfillment.

Une ligne de commande doit conserver un **snapshot commercial suffisant** pour garantir l'intégrité historique de la commande.

La commande ne doit toutefois pas devenir une copie du PIM.

## Fulfillment

`commerce` orchestre le fulfillment mais ne doit pas nécessairement posséder toute sa logique opérationnelle.

Il peut référencer :

- fulfillment ;
- shipment ;
- delivery partner ;
- tracking.

Si la complexité augmente, le fulfillment/logistique peut devenir un bounded context séparé.

## Enchères

Les enchères peuvent rester dans `commerce` uniquement si elles constituent un mode de vente.

Le modèle doit alors rester séparé du pricing classique.

Si les enchères deviennent un domaine important avec :

- enchères ;
- lots ;
- participants ;
- bids ;
- règles de clôture ;
- anti-sniping ;
- settlement ;

il est préférable de prévoir un futur `Auction` bounded context.

## Avis vérifiés

Les avis ne devraient pas être une responsabilité cœur de `commerce`.

Si le plugin actuel `commerce-reviews` existe, il peut rester branché sur Commerce via des références de commande/achat vérifié.

À terme, un bounded context `Reviews` dédié est préférable.

Commerce doit uniquement fournir les informations permettant de vérifier qu'un achat a eu lieu.

## Interactions

`commerce` est monté sur `RuntimeKernel` via un conteneur enfant par tenant.

Les communications inter-applications se font exclusivement par :

- capabilities ;
- événements.

Aucun import direct inter-applications.

L'infrastructure est consommée exclusivement via des ports/adapters.

### Dépendances fonctionnelles

```
Portfolio
    |
    | vendableId
    v
Commerce
    |
    +---- Pricing
    |
    +---- Promotions
    |
    +---- InventoryPort ------> Inventory
    |
    +---- BookingPort --------> Booking
    |
    +---- PaymentPort --------> Payments
    |
    +---- BillingPort --------> Billing
    |
    +---- FulfillmentPort ----> Fulfillment
```

Les flèches représentent des contrats/capabilities, pas des imports directs.

## Données possédées — source de vérité

### Offres

- offres commerciales ;
- rattachement vendeur ;
- rattachement Space ;
- état commercial ;
- configuration commerciale ;
- références de vendables ;
- références de variantes/options.

### Pricing

- prix ;
- devise ;
- règles de prix ;
- paliers ;
- prix calculés ;
- snapshots de prix des commandes.

### Promotions

- promotions ;
- coupons ;
- règles d'éligibilité ;
- périodes ;
- limites ;
- règles de cumul.

### Vente

- paniers ;
- checkout ;
- commandes ;
- lignes de commande ;
- état commercial des commandes.

### Orchestration

- réservations de ressources via ports ;
- orchestration du paiement ;
- orchestration du fulfillment ;
- compensations de saga.

## Données qui ne sont pas possédées

`commerce` ne possède pas :

- la définition du vendable → `portfolio` ;
- les caractéristiques descriptives → `portfolio` ;
- les traductions du vendable → `portfolio` ;
- le stock physique si `Inventory` est séparé ;
- les mouvements d'inventaire ;
- les emplacements physiques ;
- les réservations de capacité → `Booking` ;
- les autorisations/captures financières → `Payments` ;
- les factures et avoirs → `Billing` ;
- la fiche vendeur → `Spaces` ;
- les données acheteur → `Citadelle`.

## Références externes — par ID, jamais de jointure

- vendable → `Portfolio` par ID ;
- variante/options → `Portfolio` par ID ;
- vendeur / Space → `Spaces` par ID ;
- acheteur → `Citadelle` par ID opaque ;
- inventaire → `Inventory` par référence ;
- réservation → `Booking` par référence ;
- paiement → `Payments` par ID ;
- facture → `Billing` par ID ;
- fulfillment → système de fulfillment par ID.

Aucune jointure inter-applications.

## Invariants de frontières — ADR-0016

1. **Vendable ≠ offre**
   - `portfolio` définit le vendable.
   - `commerce` définit l'offre.
2. **Offre ≠ stock**
   - une offre peut référencer une ressource d'inventaire ;
   - le stock n'est pas une propriété du vendable.
3. **Prix = propriété de l'offre**
   - aucun prix dans `portfolio`.
4. **Promotion = propriété de Commerce**
   - aucune promotion dans `portfolio`.
5. **Commande ≠ paiement**
   - Commerce orchestre ;
   - Payments possède l'état financier.
6. **Commande ≠ facture**
   - Commerce possède la transaction commerciale ;
   - Billing possède les documents financiers.
7. **Disponibilité ≠ toujours stock**
   - Inventory tranche pour les ressources stockées ;
   - Booking tranche pour les capacités réservables.
8. **Offre externe ≠ propriété du vendable**
   - un Space peut commercialiser un vendable sans en devenir propriétaire dans Portfolio.
9. **Aucune duplication du PIM**
   - Commerce référence le vendable et ne recopie pas ses informations descriptives comme source de vérité.

## Exemple de cycle complet

```
Portfolio
  Vendable V100
      |
      v
Commerce
  Offre O900
    seller = Space-42
    price = 49 EUR
    promotion = SUMMER10
      |
      +---- Inventory
      |       stock = 12
      |
      +---- Checkout
              |
              +---- Payments
              |
              +---- Order
              |
              +---- Fulfillment
```

Pour un autre Space :

```
Portfolio
  Vendable V100
      |
      +----------------------+
      |                      |
      v                      v
Offer O900               Offer O901
Space-42                 Space-77
49 EUR                   55 EUR
-10%                     aucune promo
```

Un seul vendable peut donc avoir plusieurs offres commerciales indépendantes.

## Architecture interne recommandée

Même si tout reste dans `@apps/commerce` dans un premier temps, les domaines doivent être séparés :

```
commerce/
  domain/
    offer/
    pricing/
    promotion/
    cart/
    checkout/
    order/
    fulfillment/
    auction/
  application/
    capabilities/
    commands/
    queries/
    sagas/
  infrastructure/
  presentation/
```

Et les responsabilités susceptibles d'être extraites doivent être encapsulées derrière des ports :

```
PricingPort
PromotionPort
InventoryPort
BookingPort
PaymentPort
BillingPort
FulfillmentPort
```

Cette découpe permet de faire évoluer les bounded contexts sans changer les contrats de `portfolio`.

## Découpe cible recommandée

| Domaine | Responsabilité | Cible |
| --- | --- | --- |
| `portfolio` | Définition des vendables | **PIM** |
| `commerce` | Offres, vente, panier, checkout, commandes | **Core commerce** |
| `inventory` | Stock, inventaire, mouvements, réservations de stock | **À extraire si nécessaire** |
| `booking` | Capacités et réservations | **Déjà séparé** |
| `payments` | Autorisation, capture, remboursement | **À extraire** |
| `billing` | Factures, avoirs, documents financiers | **À extraire** |
| `fulfillment` | Préparation, expédition, livraison | **À extraire si nécessaire** |
| `reviews` | Avis vérifiés | **À extraire si nécessaire** |
| `auction` | Enchères | **À extraire si le domaine devient important** |

### Décision

Ne pas créer immédiatement une app `inventory` uniquement pour déplacer trois champs de stock.

En revanche, faire dès maintenant de `InventoryPort` une frontière stricte dans Commerce.

Cela permet :

```
Aujourd'hui

Commerce
 ├── Offer
 ├── Pricing
 ├── Promotion
 ├── Inventory adapter
 ├── Cart
 ├── Checkout
 └── Order
```

puis demain :

```
Commerce                         Inventory
 ├── Offer                       ├── Stock
 ├── Pricing                     ├── Inventory
 ├── Promotion                   ├── Movement
 ├── Cart                        ├── Reservation
 ├── Checkout  <---- Port ----> ├── Warehouse
 └── Order                       └── Adjustment
```

sans modifier `Portfolio`.

## Écarts cible-vs-réel

### Paiement

Écart existant :

- `commerce_payment_intents` ;
- `refund` ;
- `satim-payment-port` ;
- `DemoPaymentPort` ;
- webhooks `payment_intent.succeeded`.

#### Décision

Extraction vers `Payments` (`BOUND-02`).

En attendant :

- conserver `PaymentPort` ;
- isoler les adapters ;
- aucune nouvelle logique financière dans Commerce ;
- Commerce orchestre uniquement.

### Billing

Extraction vers `Billing` (`BOUND-03`).

Commerce conserve uniquement les références aux documents financiers.

### Stock / inventaire

#### Décision

Le stock ne doit plus être modélisé comme une propriété du vendable.

Il doit être associé à une référence commerciale/inventaire.

À court terme :

- isoler via `InventoryPort` ;
- supprimer les accès directs au stock dans les agrégats d'offre lorsque possible ;
- empêcher toute propagation du modèle d'inventaire vers `portfolio`.

À moyen terme :

- extraction vers `@apps/inventory` si les besoins de warehouse, mouvements, lots, réservations ou multi-sites le justifient.

### Pricing / promotions

Le pricing et les promotions restent dans Commerce.

Ils constituent le cœur de la notion d'**offre commerciale** et sont directement nécessaires au checkout.

Ils ne doivent pas être déplacés dans `portfolio`.

## Frontières

- Aucun import depuis une autre app.
- Aucun accès infrastructure direct hors ports.
- Aucune route sans autorisation.
- Aucun prix dans `portfolio`.
- Aucun stock dans `portfolio`.
- Aucune promotion dans `portfolio`.
- Aucun inventaire dans `portfolio`.
- Aucune duplication de la fiche PIM.
- Les références inter-apps sont uniquement par ID.
- Les communications inter-apps passent par capabilities/événements.
- Les systèmes spécialisés sont consommés via des ports.
- Commerce ne possède pas l'état financier de Payments.
- Commerce ne possède pas les documents de Billing.

## Non-responsabilités

`commerce` ne :

- réimplémente pas le kernel ;
- réimplémente pas le gateway ;
- réimplémente pas les adapters ;
- ne définit pas les vendables ;
- ne gère pas le PIM ;
- ne possède pas les caractéristiques descriptives des vendables ;
- ne possède pas les traductions des vendables ;
- ne gère pas directement l'inventaire physique si `Inventory` est séparé ;
- ne tranche pas les réservations de Booking ;
- ne possède pas l'état financier du paiement ;
- ne génère pas les factures ;
- n'expose pas de secret.

## Critères de santé

- [ ] Conforme à `pnpm check:conformance`.
- [ ] Conforme à `pnpm check:manifests`.
- [ ] Tests de domaine verts (`*.test.ts`).
- [ ] OpenAPI généré sans erreur.
- [ ] Une offre peut référencer un vendable `portfolio` par ID.
- [ ] Plusieurs offres peuvent référencer le même vendable.
- [ ] Une offre peut appartenir à un Space différent du propriétaire du vendable.
- [ ] Les prix sont exclusivement portés par Commerce.
- [ ] Les promotions sont exclusivement portées par Commerce.
- [ ] Aucun prix n'existe dans `portfolio`.
- [ ] Aucun stock n'existe dans `portfolio`.
- [ ] `InventoryPort` isole le domaine du stock.
- [ ] `BookingPort` isole les disponibilités réservables.
- [ ] `PaymentPort` isole Payments.
- [ ] `BillingPort` isole Billing.
- [ ] Le checkout est orchestré par une saga avec compensation.
- [ ] Commerce ne fait aucune jointure inter-applications.
- [ ] Les données du vendable ne sont pas dupliquées comme source de vérité dans Commerce.
