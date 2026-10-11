# Responsabilités — app subscription

| Champ | Valeur |
| --- | --- |
| Nom | `@apps/subscription` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Abonnements récurrents & entitlement |

## Raison d'être

`subscription` est le **bounded context des engagements récurrents**.

Il définit les plans d'abonnement, gère le cycle de vie des souscriptions et calcule les échéances et montants dus au titre d'un abonnement.

Il est responsable de la relation :

```
Plan
  ↓
Subscription
  ↓
Périodes / renouvellements
  ↓
Montants dus
  ↓
Billing / Payments
```

`subscription` ne facture pas et n'encaisse pas.

**Principe directeur : `subscription` décide ce qu'un souscripteur doit selon son engagement récurrent ; `billing` transforme ce dû en document financier et `payments` l'encaisse.**

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
- Définir les plans récurrents.
- Créer et gérer les souscriptions.
- Gérer les périodes d'abonnement.
- Gérer les renouvellements et échéances.
- Gérer les essais.
- Gérer les changements de plan.
- Gérer les changements de cycle de facturation.
- Gérer les prorata.
- Gérer les suspensions et résiliations.
- Gérer les reprises après suspension lorsque les règles métier le permettent.
- Calculer les montants dus par période.
- Gérer le metering lorsque la consommation influence l'engagement récurrent.
- Exposer les droits/entitlements découlant d'une souscription.
- Émettre les événements nécessaires à Billing, Payments, Notifications et aux systèmes consommateurs.

## Modèle métier

### 1. Plan

Le **Plan** définit le contrat récurrent disponible à la souscription.

Il peut notamment définir :

- identité du plan ;
- nom et description ;
- version ;
- cycle de facturation ;
- période ;
- prix de référence du plan ;
- devise ;
- règles de renouvellement ;
- période d'essai ;
- règles de prorata ;
- métriques facturables ;
- quotas ;
- entitlements ;
- règles de changement de plan ;
- règles de résiliation.

Le plan est une définition d'abonnement.

Il ne représente pas :

- une facture ;
- un paiement ;
- une commande ponctuelle ;
- une transaction financière.

#### Prix du plan

Le prix nécessaire au **calcul de l'engagement récurrent** appartient au domaine Subscription.

Cela ne contredit pas la règle Commerce :

- `portfolio` → aucun prix ;
- `commerce` → prix des offres ponctuelles/commerciales ;
- `subscription` → conditions tarifaires du contrat récurrent ;
- `billing` → document financier ;
- `payments` → encaissement.

Si un plan est lui-même vendu comme une offre commerciale, Commerce peut référencer le plan Subscription, mais ne devient pas propriétaire des règles de récurrence.

## 2. Subscription

La **Subscription** représente l'engagement récurrent d'un souscripteur envers un plan.

Elle porte notamment :

- `subscriptionId` ;
- `planId` ;
- `subscriberId` ;
- contexte de souscription ;
- statut ;
- date de début ;
- prochaine échéance ;
- période courante ;
- historique des changements ;
- trial ;
- état de suspension ;
- état de résiliation ;
- cycle de facturation ;
- configuration de metering ;
- entitlements actifs.

Une souscription peut évoluer de :

```
trial
  ↓
active
  ↓
past_due
  ↓
suspended
  ↓
cancelled
```

Les transitions exactes doivent être définies dans le domaine et non dispersées dans les controllers.

## 3. Périodes et renouvellements

`subscription` possède la notion de période contractuelle.

Il gère :

- ouverture de période ;
- échéance ;
- renouvellement ;
- changement de période ;
- prorata ;
- période d'essai ;
- suspension ;
- résiliation immédiate ou en fin de période ;
- changement de plan avec effet immédiat ou différé.

Le renouvellement doit produire un événement métier permettant à Billing/Payments de poursuivre le processus financier.

Exemple :

```
Subscription
    |
    | renewal.due
    v
Billing
    |
    | invoice / financial document
    v
Payments
    |
    | collection
    v
Subscription
    |
    | renewal.confirmed
    v
nouvelle période
```

Subscription orchestre son état contractuel mais ne réalise pas l'encaissement.

## 4. Metering

Le **metering** mesure une consommation qui influence les droits ou le montant dû d'une souscription.

Exemples :

- nombre d'utilisateurs ;
- nombre de requêtes ;
- stockage consommé ;
- minutes consommées ;
- événements traités ;
- unités utilisées.

Capabilities principales :

```
subscription.metered.record
```

Le metering doit être idempotent lorsque la source de consommation peut retransmettre un événement.

Une mesure peut notamment comporter :

- `subscriptionId` ;
- `metric` ;
- `quantity` ;
- `occurredAt` ;
- `idempotencyKey` ;
- métadonnées.

`subscription` calcule l'impact de cette consommation sur le contrat.

Il ne doit pas devenir un système générique d'analytics d'usage.

## 5. Prorata

Le prorata appartient à `subscription` lorsqu'il découle d'un changement du contrat.

Exemples :

- upgrade en milieu de période ;
- downgrade en milieu de période ;
- changement de cycle ;
- activation après période d'essai ;
- changement de quantité souscrite.

Subscription calcule :

```
ancien engagement
+
nouvel engagement
+
crédit éventuel
=
montant dû
```

Le résultat est transmis à Billing.

Subscription ne génère pas la facture.

## 6. Entitlements

Une souscription peut donner accès à des droits.

Exemples :

- fonctionnalité activée ;
- nombre maximal d'utilisateurs ;
- quota ;
- niveau de service ;
- capacité ;
- accès à une capability.

Les entitlements sont dérivés de la souscription.

Ils sont exposés via des capabilities plutôt que par accès direct aux données internes.

Exemple :

```
subscription.entitlement.check
subscription.entitlement.list
```

Le système consommateur ne doit pas connaître la structure interne de Subscription.

## Plans de capacité des Spaces

Les plans de capacité propres à `Spaces` ne doivent pas être confondus avec les plans Subscription.

Exemple :

```
Space
  capacité interne
      ≠
Subscription
  engagement commercial récurrent
```

Un Space peut avoir des capacités techniques ou opérationnelles indépendamment d'une souscription.

Si une souscription donne droit à une capacité Space :

```
Subscription
      |
      | entitlement
      v
Space
```

mais `subscription` ne devient pas propriétaire de la capacité du Space.

## Vente d'un abonnement

Lorsqu'un abonnement est commercialisé via Commerce :

```
Portfolio
    |
    | vendable éventuel
    v
Commerce
    |
    | offre commerciale
    v
Subscription
    |
    | contrat récurrent
    v
Billing
    |
    v
Payments
```

Commerce peut gérer :

- canal de vente ;
- offre commerciale ;
- promotion commerciale ;
- panier ;
- checkout.

Subscription gère :

- le plan ;
- l'engagement ;
- le cycle ;
- le prorata ;
- les échéances ;
- les entitlements.

Billing/Payments gèrent la matérialisation et l'encaissement.

## Coupons et promotions

Il faut distinguer deux concepts.

### Promotion commerciale

Une promotion générique :

- coupon ;
- code promotionnel ;
- réduction panier ;
- campagne commerciale ;

appartient à **Commerce**.

### Condition tarifaire d'un abonnement

Subscription peut gérer une règle contractuelle spécifique au plan :

- trial de 30 jours ;
- remise pendant les trois premiers cycles ;
- prix préférentiel du premier cycle ;
- engagement minimum ;
- tarif progressif.

La règle doit rester dans Subscription si elle fait partie du **contrat récurrent**.

Elle ne doit pas dupliquer le moteur générique de promotions de Commerce.

## Facturation

Subscription calcule les montants dus.

Il produit des événements ou intents du type :

```
subscription.charge.due
subscription.renewal.due
subscription.proration.calculated
```

Billing transforme ces informations en documents financiers.

Exemple :

```
Subscription
  amountDue = 49 EUR
        |
        v
Billing
  Invoice #INV-123
        |
        v
Payments
  Payment #PAY-456
```

Subscription ne possède pas :

- `invoice` ;
- `creditNote` ;
- `paymentIntent` ;
- `refund` ;
- `paymentMethod`.

## Paiement

Le paiement est une responsabilité externe.

Subscription ne :

- contacte pas directement un PSP ;
- ne stocke pas de données de carte ;
- ne capture pas de paiement ;
- ne rembourse pas ;
- ne gère pas les webhooks PSP comme source de vérité financière.

Elle consomme uniquement les événements/capabilities de Payments nécessaires à son cycle de vie.

## Dunning / relances

Le moteur de relance ne doit pas être dans le cœur de Subscription.

Subscription peut décider :

```
payment failed
    ↓
subscription becomes past_due
```

mais la stratégie de communication est externe :

```
Subscription
    |
    | payment overdue
    v
Billing / Payments
    |
    | dunning decision
    v
Notifications
```

Subscription conserve uniquement les décisions contractuelles :

- délai avant suspension ;
- état `past_due` ;
- date de suspension ;
- date de résiliation éventuelle.

Les emails, SMS, push et messages ne sont pas de sa responsabilité.

## Notifications

`subscription` ne possède pas :

- templates ;
- emails ;
- SMS ;
- push ;
- envoi de messages.

Il publie des événements métier :

```
subscription.trial.ending
subscription.renewal.upcoming
subscription.payment_overdue
subscription.suspended
subscription.cancelled
```

Notifications décide ensuite comment informer l'utilisateur.

## MRR / ARR

MRR/ARR ne doivent pas être des données transactionnelles fondamentales de Subscription.

Ils peuvent être calculés à partir :

- des souscriptions actives ;
- des plans ;
- des montants récurrents ;
- des périodes.

La recommandation est :

```
Subscription
     |
     | événements / projections
     v
Analytics / Reporting
     |
     +--> MRR
     +--> ARR
     +--> churn
     +--> expansion
     +--> contraction
```

Subscription peut exposer les données nécessaires au calcul mais ne doit pas maintenir `mrr` et `arr` comme source de vérité mutable.

## Données possédées — source de vérité

### Plans

- plans récurrents ;
- versions des plans ;
- cycles ;
- règles d'engagement ;
- règles d'essai ;
- règles de prorata ;
- règles contractuelles de tarification ;
- metering ;
- entitlements.

### Souscriptions

- souscriptions ;
- état ;
- périodes ;
- renouvellements ;
- échéances ;
- changements de plan ;
- suspension ;
- résiliation ;
- historique contractuel.

### Metering

- mesures liées aux souscriptions ;
- agrégats nécessaires au calcul de l'engagement ;
- déductions/consommations contractuelles.

### Décisions de facturation

- montants dus ;
- périodes facturées ;
- proratas ;
- échéances ;
- événements de renouvellement.

Ces données sont des **inputs pour Billing**, pas des factures.

## Références externes — par ID, jamais de jointure

- souscripteur → `Citadelle` ou `Space` par ID ;
- vendable → `Portfolio` par ID si le plan est associé à un vendable ;
- offre → `Commerce` par ID lorsqu'une souscription est issue d'une offre ;
- facture → `Billing` par ID ;
- paiement → `Payments` par ID ;
- entités/capacités Space → `Spaces` par ID.

Aucune jointure inter-applications.

## Interactions

`subscription` est monté sur `RuntimeKernel` via un conteneur enfant par tenant.

Les communications inter-applications se font exclusivement par :

- capabilities ;
- événements.

Aucun import direct inter-applications.

L'infrastructure est consommée exclusivement via des ports/adapters.

### Flux principal

```
Commerce
   |
   | subscribe
   v
Subscription
   |
   +---- entitlements ---> Spaces / autres consommateurs
   |
   +---- amountDue ------> Billing
   |
   +---- payment intent -> Payments
   |
   +---- events ---------> Notifications
```

## Invariants de frontières — ADR-0016

1. **Subscription = engagement récurrent**
   - Subscription possède la relation contractuelle récurrente.
2. **Plan ≠ offre commerciale**
   - un plan peut être référencé par une offre Commerce ;
   - Commerce possède l'offre.
3. **Subscription ≠ commande**
   - Commerce possède les commandes ;
   - Subscription possède l'engagement récurrent.
4. **Subscription ≠ facture**
   - Subscription calcule le dû ;
   - Billing produit les documents financiers.
5. **Subscription ≠ paiement**
   - Payments possède l'état financier.
6. **Promotion générique ≠ règle contractuelle**
   - promotions commerciales → Commerce ;
   - règles propres au plan → Subscription.
7. **MRR/ARR ≠ état transactionnel**
   - calculés par projection/analytics.
8. **Dunning ≠ notification**
   - Subscription décide de l'état contractuel ;
   - Notifications gère la communication.
9. **Entitlement ≠ capacité**
   - Subscription accorde un droit ;
   - le système cible possède la capacité réelle.
10. **Source de vérité de l'engagement récurrent**
    - Subscription est la source de vérité du cycle de vie contractuel.

## Écarts cible-vs-réel

### `subscription-billing-engine`

Le composant actuel mélange plusieurs responsabilités :

- calcul d'échéances ;
- relances ;
- notifications ;
- envoi d'emails ;
- logique financière.

#### Décision

Conserver dans Subscription :

- échéancier ;
- échéances ;
- renouvellement ;
- calcul du dû ;
- prorata ;
- décisions de suspension/résiliation ;
- événements contractuels.

Extraire :

- génération de factures → `Billing` (`BOUND-03`) ;
- paiement/encaissement → `Payments` (`BOUND-02`) ;
- dunning financier → `Billing`/`Payments` selon le besoin ;
- messages → `Notifications` (`BOUND-04`) ;
- `send_reminder_email` → `Notifications`.

`notificationMessage` ne doit pas être une propriété métier de Subscription.

## Découpe interne recommandée

Même si `@apps/subscription` reste une seule application, les domaines doivent être isolés :

```
subscription/
  domain/
    plan/
    subscription/
    period/
    renewal/
    metering/
    proration/
    entitlement/
  application/
    commands/
    queries/
    capabilities/
    events/
  infrastructure/
  presentation/
```

Les intégrations externes passent par des ports :

```
BillingPort
PaymentsPort
NotificationPort
CommercePort
EntitlementPort
```

## Découpe cible globale

| Domaine | Responsabilité | Source de vérité |
| --- | --- | --- |
| `portfolio` | Définition du vendable | Vendable |
| `commerce` | Offres, pricing ponctuel, promotions, panier, commandes | Vente |
| `subscription` | Plans, abonnements, renouvellements, metering, entitlements | Engagement récurrent |
| `inventory` | Stock et inventaire | Ressources physiques |
| `booking` | Capacités et réservations | Disponibilité réservée |
| `billing` | Factures, avoirs, comptes clients | Documents financiers |
| `payments` | Autorisation, capture, remboursement | Transactions financières |
| `notifications` | Email/SMS/push/messages | Communication |
| `analytics` | MRR/ARR, reporting, projections | Données analytiques |

## Exemple complet

```
Portfolio
  Vendable V100
       |
       v
Commerce
  Offre O500
  49 EUR/mois
       |
       v
Subscription
  Plan P100
  Monthly
  49 EUR
       |
       +---- Subscription S900
       |       |
       |       +-- period
       |       +-- renewal
       |       +-- metering
       |       +-- entitlements
       |
       +---- amountDue
                |
                v
             Billing
                |
                v
             Payments
```

Pour un changement de plan :

```
Subscription S900
      |
      | upgrade
      v
Proration
      |
      +---- amountDue ---> Billing
      |
      +---- payment -----> Payments
      |
      +---- entitlement -> nouveau niveau d'accès
```

## Frontières

- Aucun import depuis une autre app.
- Aucun accès infrastructure direct hors ports.
- Aucune route sans autorisation.
- Aucun paiement direct.
- Aucune facture dans Subscription.
- Aucun email/SMS/push dans Subscription.
- Aucun moteur générique de promotions dans Subscription.
- Aucun stockage de moyens de paiement.
- Aucun MRR/ARR mutable comme source de vérité.
- Aucun accès direct aux capacités internes de Spaces.
- Les références inter-applications sont uniquement par ID.
- Les communications inter-applications passent par capabilities/événements.

## Non-responsabilités

`subscription` ne :

- réimplémente pas le kernel ;
- réimplémente pas le gateway ;
- réimplémente pas les adapters ;
- ne gère pas les commandes ;
- ne gère pas le panier ;
- ne gère pas les promotions génériques de Commerce ;
- ne gère pas les factures ;
- ne gère pas les avoirs ;
- ne gère pas les paiements ;
- ne gère pas les moyens de paiement ;
- ne gère pas les relances de communication ;
- n'envoie pas d'emails/SMS/push ;
- ne possède pas les capacités physiques/techniques de Spaces ;
- ne gère pas l'inventaire ;
- ne gère pas les réservations Booking ;
- n'expose pas de secret.

## Critères de santé

- [ ] Conforme à `pnpm check:conformance`.
- [ ] Conforme à `pnpm check:manifests`.
- [ ] Tests de domaine verts (`*.test.ts`).
- [ ] OpenAPI généré sans erreur.
- [ ] Une souscription possède un cycle de vie explicite.
- [ ] Les plans sont versionnables.
- [ ] Les renouvellements sont idempotents.
- [ ] Le metering est idempotent.
- [ ] Les proratas sont déterministes et testés.
- [ ] Les entitlements sont dérivés de la souscription.
- [ ] Aucun paiement n'est implémenté directement dans Subscription.
- [ ] Aucune facture n'est générée directement dans Subscription.
- [ ] Les notifications sont émises sous forme d'événements/capabilities.
- [ ] MRR/ARR ne sont pas une source de vérité mutable du domaine.
- [ ] Les promotions génériques restent dans Commerce.
- [ ] Les règles tarifaires intrinsèques au contrat restent dans Subscription.
- [ ] Subscription peut être déclenchée depuis Commerce sans dépendance directe.

**Le point architectural le plus important est donc de ne pas faire de `subscription` un deuxième `commerce`.** Commerce vend l'abonnement comme une offre ; Subscription possède le **contrat récurrent** qui naît de cette vente. Ensuite, Billing et Payments matérialisent respectivement le dû et son encaissement.
