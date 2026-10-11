# Responsabilités — app booking

| Champ | Valeur |
| --- | --- |
| Nom | `@apps/booking` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Disponibilité, capacité & réservations |

## Raison d'être

`booking` est le bounded context de disponibilité temporelle et de réservation de capacités.

Il définit les ressources réservables, leurs calendriers et capacités, calcule les disponibilités, alloue les créneaux et gère le cycle de vie des réservations.

Principe directeur : Booking est la source de vérité de la disponibilité réservée.

Commerce peut demander :

« Cette offre est-elle disponible pour ce créneau et cette quantité ? »

Booking décide :

« Cette capacité peut-elle être allouée et réservée ? »

Booking ne possède pas :

- le vendable ;
- l'offre commerciale ;
- le prix ;
- la commande ;
- le paiement ;
- la facture.

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
- Gérer les ressources réservables.
- Gérer les calendriers et périodes d'ouverture.
- Définir les capacités disponibles.
- Générer et gérer les slots.
- Calculer la disponibilité.
- Appliquer les règles de réservation.
- Détecter et empêcher les conflits.
- Allouer et libérer des capacités.
- Créer, confirmer, modifier et annuler des réservations.
- Gérer les expirations de réservation.
- Gérer les listes d'attente.
- Gérer les règles de no-show et de cancellation lorsqu'elles sont propres au domaine Booking.
- Fournir des capacités de disponibilité aux systèmes consommateurs.
- Émettre les événements permettant à Commerce, Notifications, Analytics et autres systèmes de réagir au cycle de réservation.

## Modèle métier

### 1. Ressource réservable

Une ressource réservable représente quelque chose dont la capacité peut être allouée dans le temps.

Exemples :

- salle ;
- terrain ;
- véhicule ;
- prestataire ;
- guide ;
- consultation ;
- activité ;
- session ;
- équipement ;
- capacité d'une expérience.

Booking possède :

- l'identité interne de la ressource ;
- son calendrier ;
- sa capacité ;
- ses contraintes de réservation ;
- ses indisponibilités ;
- ses allocations.

La fiche descriptive de la ressource peut rester dans un autre bounded context.

Exemple :

```
Portfolio
  Vendable : "Visite guidée du désert"
       |
       v
Commerce
  Offre : 80 EUR
       |
       v
Booking
  Ressource : Guide A
  Session : 14:00-16:00
  Capacité : 8
```

### 2. Calendrier

Booking possède les informations temporelles nécessaires à la disponibilité :

- calendrier ;
- horaires ;
- périodes ouvertes ;
- périodes fermées ;
- exceptions ;
- indisponibilités ;
- jours fériés ou règles équivalentes lorsqu'ils influencent la disponibilité ;
- fuseau horaire de référence ;
- contraintes de réservation.

Le calendrier de Booking ne doit pas être confondu avec le calendrier éditorial de Portfolio.

### 3. Slot

Un slot est une fenêtre temporelle réservable.

Il peut porter :

- slotId ;
- ressource ;
- début ;
- fin ;
- capacité totale ;
- capacité restante ;
- statut ;
- règles applicables.

La capacité restante est une vue dérivée de l'allocation Booking, pas une copie d'un stock Commerce.

Exemple :

```
Slot
  14:00 → 16:00
  capacity = 10
  allocated = 6
  remaining = 4
```

### 4. Capacité

Booking possède la capacité réservable.

La capacité peut être :

- fixe ;
- variable ;
- partagée ;
- répartie entre plusieurs ressources ;
- dépendante d'une règle.

Exemples :

```
Guide
  capacity = 1

Excursion
  capacity = 12 participants

Salle
  capacity = 50 personnes
```

La capacité n'est pas du stock.

Elle représente une ressource temporelle réservée.

### 5. Disponibilité

Booking est la source de vérité de la disponibilité pour les ressources qu'il possède.

Une disponibilité peut dépendre de :

- calendrier ;
- capacité ;
- réservations existantes ;
- allocations ;
- contraintes ;
- temps de préparation ;
- temps de nettoyage ;
- ressources dépendantes ;
- règles de réservation.

Commerce ne doit jamais calculer lui-même :

```
availableSlots
```

à partir d'une copie locale.

Il demande à Booking.

### 6. Allocation

Une allocation représente une capacité réservée ou temporairement retenue.

Elle peut avoir :

- ressource ;
- slot ;
- quantité ;
- réservation associée ;
- état ;
- expiration.

Exemple :

```
Checkout Commerce
       |
       | hold 2 places
       v
Booking
       |
       +--> Allocation A
       |      quantity = 2
       |      expiresAt = ...
       |
       v
Reservation
```

Les allocations temporaires sont importantes pour éviter les doubles réservations pendant un checkout.

### 7. Réservation

La Reservation est l'engagement de réservation d'une capacité.

Elle possède notamment :

- reservationId ;
- ressource ;
- slot ;
- quantité ;
- réservataire ;
- statut ;
- dates ;
- références externes ;
- allocations ;
- politique d'annulation ;
- historique.

États possibles :

```
requested
   ↓
held
   ↓
confirmed
   ↓
completed
```

ou

```
held
   ↓
expired
```

ou

```
confirmed
   ↓
cancelled
```

Les transitions doivent être explicites dans le domaine.

### Réservation et commande Commerce

Une réservation peut être créée :

- directement depuis Booking ;
- depuis un checkout Commerce ;
- depuis une commande existante.

Lorsque la réservation provient de Commerce :

```
Commerce
  Order O123
      |
      | reservation request
      v
Booking
  Reservation R456
      |
      | reference
      v
Commerce
  Order O123
```

Booking référence la commande par ID.

Il ne duplique pas la commande.

### Relation avec les offres Commerce

Booking ne possède pas l'offre.

Une offre Commerce peut déclarer qu'elle nécessite une réservation :

```
Commerce Offer
  offerId = O100
  vendableId = V100
  bookingRequirement = B100
```

Le contrat de réservation peut préciser :

- type de ressource ;
- durée ;
- quantité ;
- fenêtre de réservation ;
- règles d'annulation.

Booking possède ensuite la capacité réelle.

Ainsi :

```
Portfolio
  Vendable
     ↓
Commerce
  Offer
     ↓
Booking
  Availability / Reservation
```

### Variantes et options

Les variantes et options descriptives appartiennent à Portfolio.

Commerce peut déterminer quelles variantes/options sont commercialement proposées.

Booking peut uniquement recevoir les informations nécessaires pour déterminer la capacité à réserver.

Exemple :

```
Portfolio
  Experience
    Variante:
      "Petit groupe"
    Option:
      "Guide privé"

Commerce
  Offer:
    price = 150 EUR

Booking
  Resource:
    privateGuide = required
    capacity = 1
```

Booking ne doit pas connaître le prix de l'option.

### Règles de réservation

Booking possède les règles qui déterminent si une réservation est techniquement possible.

Exemples :

- durée minimale ;
- durée maximale ;
- délai minimum avant réservation ;
- délai maximum avant réservation ;
- capacité maximale ;
- capacité minimale ;
- jours autorisés ;
- horaires autorisés ;
- durée tampon ;
- temps de préparation ;
- temps de nettoyage ;
- règles de conflit ;
- politique d'annulation ;
- règles de no-show.

Les règles purement commerciales :

- prix ;
- promotion ;
- coupon ;
- remise ;

restent dans Commerce.

### Waitlist

Booking possède les listes d'attente.

Une waitlist peut gérer :

- ressource ;
- slot ;
- demandeur ;
- quantité ;
- position ;
- timestamp ;
- priorité éventuelle ;
- état.

La politique par défaut est FIFO lorsqu'aucune règle spécifique ne s'applique.

Exemple :

```
Slot 14:00
capacity = 10
allocated = 10

Waitlist
  1. Client A
  2. Client B
  3. Client C
```

Lorsqu'une capacité se libère, Booking détermine le prochain candidat selon les règles de la waitlist.

Notifications gère ensuite la communication.

### Annulation et expiration

Booking possède le cycle de vie de la réservation.

Il peut décider :

- qu'une réservation expire ;
- qu'une réservation peut être annulée ;
- qu'une capacité est libérée ;
- qu'un no-show entraîne une conséquence sur la réservation.

Il ne doit pas décider d'un remboursement financier.

Exemple :

```
Reservation cancelled
       |
       +---- release capacity ---> Booking
       |
       +---- cancellation event -> Commerce
       |
       +---- refund request ----> Payments / Billing
```

Le remboursement est traité hors de Booking.

### Garantie / empreinte bancaire

L'ancienne notion d'empreinte bancaire doit être clarifiée.

Booking peut exprimer une exigence :

```
guaranteeRequired = true
```

ou :

```
guaranteePolicy = GUARANTEE_REQUIRED
```

Mais Booking ne doit pas posséder l'opération financière.

Le flux devient :

```
Booking
  Reservation
      |
      | guarantee required
      v
Commerce / Checkout
      |
      v
Payments
  preauthorization
```

Booking reçoit ensuite le résultat :

```
guarantee.authorized
guarantee.failed
guarantee.released
```

La préautorisation, capture ou libération financière appartient à Payments.

Une garantie de réservation est une contrainte métier de Booking ; l'opération financière correspondante appartient à Payments.

### Rappels

Booking détermine quand un rappel doit être déclenché.

Il ne l'envoie pas.

Exemple :

```
Reservation R123
  startAt = 2026-10-10T14:00
       |
       +--> reminder T-24
       +--> reminder T-1
```

Booking produit des événements :

```
booking.reminder.scheduled
booking.reminder.due
```

Notifications décide ensuite :

- email ;
- push ;
- SMS ;
- autre canal.

### Synchronisation iCalendar

Booking peut fournir une représentation iCalendar compatible RFC 5545 pour :

- export de calendrier ;
- synchronisation ;
- intégration avec des agendas externes.

La synchronisation ne doit pas transformer un calendrier externe en source de vérité de Booking sans contrat explicite.

La source de vérité de la disponibilité reste Booking.

Les calendriers externes peuvent fournir :

- indisponibilités ;
- événements bloquants ;
- synchronisation.

Mais leur rôle doit être explicitement défini par un adapter.

## Données possédées — source de vérité

### Ressources

- ressources réservables ;
- capacité ;
- contraintes ;
- calendrier opérationnel.

### Disponibilité

- slots ;
- périodes ouvertes ;
- indisponibilités ;
- allocations ;
- capacité restante dérivée.

### Réservations

- réservations ;
- statuts ;
- participants/réservataires référencés ;
- allocations ;
- expirations ;
- annulations ;
- confirmations.

### Waitlist

- listes d'attente ;
- positions ;
- demandes ;
- allocations issues de waitlist.

### Règles

- règles de réservation ;
- conflits ;
- durée ;
- fenêtres de réservation ;
- politiques d'annulation ;
- contraintes de capacité.

## Données explicitement exclues

Booking ne possède pas :

- vendables → Portfolio ;
- offres → Commerce ;
- prix → Commerce ;
- promotions → Commerce ;
- coupons → Commerce ;
- panier → Commerce ;
- commandes → Commerce ;
- paiements → Payments ;
- remboursements → Payments ;
- factures → Billing ;
- communications → Notifications ;
- fiche client → Citadelle ;
- fiche Space/prestataire → Spaces.

## Références externes — par ID, jamais de jointure

- client → Citadelle par ID opaque ;
- ressource parente → Space ou prestataire par ID ;
- vendable → Portfolio par ID lorsque nécessaire ;
- offre → Commerce par ID ;
- commande → Commerce par ID ;
- paiement/garantie → Payments par ID ;
- facture → Billing par ID ;
- notification → Notifications par ID/event.

Aucune jointure inter-applications.

## Interactions

`booking` est monté sur `RuntimeKernel` via un conteneur enfant par tenant.

Les communications inter-applications se font exclusivement par :

- capabilities ;
- événements.

Aucun import direct inter-applications.

L'infrastructure est consommée exclusivement via des ports/adapters.

### Flux Commerce → Booking

```
Commerce
   |
   | availability.check
   v
Booking
   |
   +--> available
   +--> unavailable
```

Puis pendant le checkout :

```
Commerce
   |
   | reservation.hold
   v
Booking
   |
   +--> allocation
   |
   v
Commerce
   |
   | payment
   v
Payments
   |
   | success
   v
Commerce
   |
   | reservation.confirm
   v
Booking
```

En cas d'échec :

```
Commerce
   |
   | checkout failed
   v
Booking
   |
   | release
   v
capacity restored
```

### Capabilities

Les capabilities principales sont :

```
booking.slot.create
booking.slot.list

booking.availability.check

booking.reservation.create
booking.reservation.read
booking.reservation.update
booking.reservation.cancel
booking.reservation.confirm

booking.allocation.hold
booking.allocation.confirm
booking.allocation.release

booking.waitlist.join
booking.waitlist.leave
booking.waitlist.list
```

Les noms exacts restent soumis au manifeste et à la convention de versionnement des capabilities.

### Événements

Exemples d'événements métier :

```
booking.slot.created
booking.availability.changed

booking.reservation.created
booking.reservation.held
booking.reservation.confirmed
booking.reservation.cancelled
booking.reservation.expired
booking.reservation.completed

booking.allocation.held
booking.allocation.confirmed
booking.allocation.released

booking.waitlist.joined
booking.waitlist.promoted

booking.reminder.due

booking.guarantee.required
```

Ces événements ne contiennent pas de données sensibles inutiles.

## Invariants de frontières — ADR-0016

1. Booking est la source de vérité de la disponibilité réservée.
2. Commerce demande ; Booking tranche.
3. **Slot ≠ offre** — Slot = capacité temporelle. Offer = proposition commerciale.
4. **Réservation ≠ commande** — Booking possède la réservation. Commerce possède la commande.
5. **Réservation ≠ paiement** — Booking peut nécessiter une garantie. Payments possède l'opération financière.
6. **Garantie ≠ paiement** — Booking exprime l'exigence. Payments réalise la préautorisation/capture/libération.
7. **Disponibilité ≠ stock** — Booking possède la capacité temporelle. Inventory possède le stock physique.
8. **Prix ≠ disponibilité** — Commerce possède le prix. Booking possède la capacité.
9. **Notification ≠ rappel** — Booking détermine quand un rappel est dû. Notifications détermine comment il est envoyé.
10. Booking ne possède jamais la fiche source — les vendables, clients, Spaces et commandes restent dans leurs bounded contexts respectifs.

## Relation avec Inventory

Booking et Inventory sont deux modèles différents.

**Inventory** répond à :

- Combien d'unités physiques sont disponibles ?

**Booking** répond à :

- Quelle capacité peut être allouée à ce moment ?

Exemple :

```
Inventory
  Kayak #42
  physicalStatus = available

Booking
  Kayak #42
  14:00 → 16:00
  reserved
```

Pour un service utilisant un équipement physique, Commerce peut orchestrer les deux :

```
Commerce
   |
   +---- Booking ------> capacité horaire
   |
   +---- Inventory ----> ressource physique
```

Booking ne doit pas absorber Inventory simplement parce qu'une réservation consomme parfois un stock.

## Découpe interne recommandée

Même si `@apps/booking` reste une seule application :

```
booking/
  domain/
    resource/
    calendar/
    slot/
    availability/
    allocation/
    reservation/
    waitlist/
    rules/
  application/
    commands/
    queries/
    capabilities/
    events/
  infrastructure/
  presentation/
```

Ports externes :

```
CommercePort
PaymentsPort
NotificationPort
CalendarSyncPort
```

## Découpe cible globale

| Domaine | Responsabilité | Source de vérité |
| --- | --- | --- |
| `portfolio` | Vendables | Définition produit/service |
| `commerce` | Offres, prix, promotions, commandes | Vente |
| `subscription` | Engagements récurrents | Abonnement |
| `booking` | Disponibilité temporelle & réservations | Capacité |
| `inventory` | Stock physique | Inventaire |
| `payments` | Autorisation, capture, remboursement | Transaction financière |
| `billing` | Factures, avoirs | Documents financiers |
| `notifications` | Email/SMS/push | Communication |
| `spaces` | Ressources/entités Space | Référentiel Space |

## Écarts cible-vs-réel

### Rappels

Les rappels actuels sont trop couplés au domaine :

- email ;
- push ;
- send_reminder.

#### Décision

Booking conserve :

- la date/heure à laquelle le rappel devient dû ;
- le type de rappel ;
- l'événement de rappel.

Notifications possède :

- templates ;
- canaux ;
- destinataires ;
- envoi ;
- retry ;
- préférences.

### Empreinte bancaire

Si Booking possède actuellement une logique d'empreinte bancaire :

#### Décision

Conserver uniquement :

- guaranteeRequired
- guaranteePolicy
- guaranteeStatus

et extraire l'opération financière vers Payments.

Aucune donnée de carte ou logique PSP dans Booking.

### Synchronisation iCalendar

La génération/export iCalendar peut rester dans Booking.

Les adapters externes doivent être derrière :

```
CalendarSyncPort
```

La synchronisation ne doit pas introduire de dépendance directe vers Google Calendar, Outlook ou un autre fournisseur.

## Frontières

- Aucun import depuis une autre app.
- Aucun accès infrastructure direct hors ports.
- Aucune route sans autorisation.
- Aucun prix dans Booking.
- Aucun stock physique dans Booking.
- Aucune promotion dans Booking.
- Aucune commande dans Booking.
- Aucun paiement dans Booking.
- Aucune facture dans Booking.
- Aucun envoi de notification dans Booking.
- Les références inter-applications sont uniquement par ID.
- Les communications inter-applications passent par capabilities/événements.
- Booking est la seule source de vérité de ses allocations et réservations.
- Commerce ne recalcule jamais la disponibilité Booking localement.

## Non-responsabilités

`booking` ne :

- réimplémente pas le kernel ;
- réimplémente pas le gateway ;
- réimplémente pas les adapters ;
- ne définit pas les vendables ;
- ne définit pas les offres commerciales ;
- ne fixe pas les prix ;
- ne gère pas les promotions ;
- ne gère pas le panier ;
- ne gère pas les commandes ;
- ne gère pas l'inventaire physique ;
- ne gère pas les paiements ;
- ne gère pas les remboursements ;
- ne génère pas les factures ;
- n'envoie pas d'emails/SMS/push ;
- ne possède pas les données clients ;
- n'expose pas de secret.

## Critères de santé

- [ ] Conforme à `pnpm check:conformance`.
- [ ] Conforme à `pnpm check:manifests`.
- [ ] Tests de domaine verts (`*.test.ts`).
- [ ] OpenAPI généré sans erreur.
- [ ] Booking est la source de vérité de ses disponibilités.
- [ ] Les allocations sont atomiques et idempotentes.
- [ ] Les réservations expirées libèrent correctement leur capacité.
- [ ] Les conflits de réservation sont impossibles ou explicitement détectés.
- [ ] Les opérations hold / confirm / release sont idempotentes.
- [ ] Commerce ne calcule pas directement les disponibilités Booking.
- [ ] Aucun prix n'est stocké dans Booking.
- [ ] Aucun paiement n'est effectué depuis Booking.
- [ ] Aucune donnée de carte n'est stockée dans Booking.
- [ ] Les rappels sont exprimés comme événements/planning et non comme envoi direct.
- [ ] Les notifications sont déléguées à Notifications.
- [ ] Les garanties financières sont déléguées à Payments.
- [ ] La synchronisation iCalendar passe par un port.
