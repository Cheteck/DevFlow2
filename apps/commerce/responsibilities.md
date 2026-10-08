# Responsabilités — app commerce

| Champ | Valeur |
|---|---|
| Nom | `@apps/commerce` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Vente, offres, checkout & commandes |

## Raison d'être

`commerce` est le bounded context de vente.

Il transforme les vendables définis par `portfolio` en offres commerciales achetables pour les différents canaux et entités externes, notamment Spaces.

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

**Principe directeur :** `portfolio` définit le vendable ; `commerce` définit l'offre et orchestre sa vente.

---

## Responsabilités

- Respecter le schéma canonique :
  - `mosaix.json` ;
  - `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine) ;
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
- Permettre à des entités externes, notamment Spaces, de publier ou exposer des offres de vendables `portfolio`.

---

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

`commerce` ne modifie pas la définition du vendable. Il le référence par ID.

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
L'offre est l'unité commerciale centrale de `commerce`.
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

#### Offres pour les entités externes
`commerce` doit permettre à une entité externe de commercialiser un vendable sans en devenir propriétaire dans Portfolio.

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

Spaces ne devient pas propriétaire du vendable.
Il peut devenir vendeur, opérateur, canal ou contexte de distribution, selon le modèle métier retenu.

#### Référence vendeur
Le vendeur est référencé par ID (`sellerId`, `spaceId`). `commerce` ne possède pas la fiche complète du vendeur et n'effectue aucune jointure directe avec Spaces.

### 3. Pricing
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

Le prix appartient à l'offre, jamais au vendable Portfolio.

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

**Règle :** Aucun champ de type `price`, `basePrice`, `salePrice`, ou `currency` commerciale ne doit être ajouté au modèle `portfolio`.

### 4. Promotions
Les promotions appartiennent à `commerce` (promotions, coupons, codes promo, limites d'utilisation, cumul). Les règles de promotion ne doivent pas être stockées dans `portfolio`.

### 5. Stock et inventaire
#### Responsabilité fonctionnelle
Le stock et l'inventaire sont nécessaires à la vente, mais ils ne sont pas des propriétés du vendable. Le stock représente une ressource opérationnelle associée à une offre ou à une référence commerciale via `InventoryPort`.

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

#### Découpe recommandée
À court terme, `commerce` expose le contrat de disponibilité et encapsule un `InventoryPort`. Le domaine Commerce ne transforme pas `stockQuantity` en propriété intrinsèque de `Offer` mais utilise `InventoryPort`.

Extraction future vers `@apps/inventory` si nécessaire sans modifier le modèle Portfolio.

### 6. Disponibilité
- **Produit physique :** dépend de `Inventory`.
- **Service / expérience :** dépend de `Booking`.
- **Bien numérique :** dépend des règles de l'offre.

Le checkout demande au système propriétaire (`Inventory` pour le stock, `Booking` pour les capacités).

### 7. Variantes et options commerciales
Portfolio définit descriptivement la variante ou option. `commerce` leur associe une interprétation commerciale (prix, supplément, disponibilité, quantité max, restriction commerciale).

### 8. Panier, Checkout, Commandes & Fulfillment
- **Panier :** appartient à `commerce` (offres, variantes, options, quantités, prix calculés, promotions, vendeur).
- **Checkout :** orchestré sous forme de saga avec compensation.
- **Commandes :** appartient à `commerce` (snapshot commercial suffisant pour garantir l'intégrité historique).
- **Fulfillment :** orchestré via `FulfillmentPort`.

---

## Interactions & Dépendances Fonctionnelles

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

---

## Données possédées — source de vérité

- **Offres :** offres commerciales, rattachement vendeur, rattachement Space, état commercial, configuration commerciale, références de vendables/variantes/options.
- **Pricing :** prix, devise, règles de prix, paliers, prix calculés, snapshots de prix des commandes.
- **Promotions :** promotions, coupons, règles d'éligibilité, périodes, limites, règles de cumul.
- **Vente :** paniers, checkout, commandes, lignes de commande, état commercial des commandes.
- **Orchestration :** réservations de ressources via ports, orchestration du paiement, orchestration du fulfillment, compensations de saga.

---

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

---

## Références externes — par ID, jamais de jointure

- `vendable` → Portfolio par ID ;
- `variante/options` → Portfolio par ID ;
- `vendeur / Space` → Spaces par ID ;
- `acheteur` → Citadelle par ID opaque ;
- `inventaire` → Inventory par référence ;
- `réservation` → Booking par référence ;
- `paiement` → Payments par ID ;
- `facture` → Billing par ID ;
- `fulfillment` → système de fulfillment par ID.

Aucune jointure inter-applications.

---

## Invariants de frontières — ADR-0016

1. **Vendable ≠ offre.** `portfolio` définit le vendable ; `commerce` définit l'offre.
2. **Offre ≠ stock.** Une offre peut référencer une ressource d'inventaire ; le stock n'est pas une propriété du vendable.
3. **Prix = propriété de l'offre.** Aucun prix dans `portfolio`.
4. **Promotion = propriété de Commerce.** Aucune promotion dans `portfolio`.
5. **Commande ≠ paiement.** Commerce orchestre ; Payments possède l'état financier.
6. **Commande ≠ facture.** Commerce possède la transaction commerciale ; Billing possède les documents financiers.
7. **Disponibilité ≠ toujours stock.** Inventory tranche pour les ressources stockées ; Booking tranche pour les capacités réservables.
8. **Offre externe ≠ propriété du vendable.** Un Space peut commercialiser un vendable sans en devenir propriétaire dans Portfolio.
9. **Aucune duplication du PIM.** Commerce référence le vendable et ne recopie pas ses informations descriptives comme source de vérité.

---

## Écarts cible-vs-réel

- **Paiement :** Extraction vers Payments (BOUND-02). En attendant : conserver `PaymentPort`, isoler les adapters, aucune nouvelle logique financière dans Commerce.
- **Billing :** Extraction vers Billing (BOUND-03). Commerce conserve uniquement les références aux documents financiers.
- **Stock / inventaire :** Isoler via `InventoryPort`. Supprimer les accès directs au stock dans les agrégats d'offre lorsque possible ; empêcher toute propagation du modèle d'inventaire vers `portfolio`.

---

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

---

## Non-responsabilités

`commerce` ne :
- réimplémente pas le kernel ;
- réimplémente pas le gateway ;
- réimplémente pas les adapters ;
- ne définit pas les vendables ;
- ne gère pas le PIM ;
- ne possède pas les caractéristiques descriptives des vendables ;
- ne possède pas les traductions des vendables ;
- ne gère pas directement l'inventaire physique si Inventory est séparé ;
- ne tranche pas les réservations de Booking ;
- ne possède pas l'état financier du paiement ;
- ne génère pas les factures ;
- n'expose pas de secret.

---

## Critères de santé

- [x] Conforme à `pnpm check:conformance`.
- [x] Conforme à `pnpm check:manifests`.
- [x] Tests de domaine verts (`*.test.ts`).
- [x] OpenAPI généré sans erreur.
- [x] Une offre peut référencer un vendable `portfolio` par ID.
- [x] Plusieurs offres peuvent référencer le même vendable.
- [x] Une offre peut appartenir à un Space différent du propriétaire du vendable.
- [x] Les prix sont exclusivement portés par Commerce.
- [x] Les promotions sont exclusivement portées par Commerce.
- [x] Aucun prix n'existe dans `portfolio`.
- [x] Aucun stock n'existe dans `portfolio`.
- [x] `InventoryPort` isole le domaine du stock.
- [x] `BookingPort` isole les disponibilités réservables.
- [x] `PaymentPort` isole Payments.
- [x] `BillingPort` isole Billing.
- [x] Le checkout est orchestré par une saga avec compensation.
- [x] Commerce ne fait aucune jointure inter-applications.
- [x] Les données du vendable ne sont pas dupliquées comme source de vérité dans Commerce.
