# Responsabilités — app spaces

| Champ | Valeur |
| --- | --- |
| Nom | `@apps/spaces` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Entités, espaces & contexte d'action |

## Raison d'être

`spaces` est le bounded context des entités Space et de leur contexte d'action.

Un Space représente une entité organisationnelle, professionnelle, communautaire ou éditoriale pouvant :

- posséder une identité propre ;
- disposer d'une page et d'une présence publique ;
- activer des capabilities ;
- administrer une équipe ;
- déléguer des rôles ;
- agir dans les autres applications ;
- publier ou commercialiser des ressources appartenant aux BAC compétents.

Principe directeur : un Space est un acteur et un contexte d'action, pas un conteneur de toutes les données métier qu'il utilise.

Un Space peut être :

- vendeur dans Commerce ;
- opérateur de ressources dans Booking ;
- propriétaire de contenus dans Solara ;
- souscripteur ou bénéficiaire d'un abonnement dans Subscription ;
- propriétaire de ressources de marque/pages dans Spaces.

Mais la ressource métier reste toujours dans le bounded context qui en est responsable.

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
- Créer et gérer les Spaces.
- Gérer leur identité et configuration.
- Gérer les membres et rôles locaux.
- Gérer les demandes d'adhésion.
- Gérer les capabilities activées pour un Space.
- Gérer le contexte acting-as-space.
- Auditer toute action effectuée au nom d'un Space.
- Gérer le registre et la vérification de l'entité lorsque cette responsabilité relève de Spaces.
- Gérer les pages et ressources de marque dont Spaces est effectivement propriétaire.
- Exposer les références permettant aux autres BACs d'associer leurs propres ressources à un Space.

## Modèle métier

### 1. Space

Le Space est l'entité centrale.

Il représente un contexte organisationnel ou public pouvant être administré par plusieurs utilisateurs.

Il possède notamment :

- spaceId ;
- slug ;
- nom ;
- catégorie/type ;
- template ;
- ownerId ;
- configuration ;
- domaine ;
- navigation publique ;
- statut ;
- capabilities activées ;
- paramètres de visibilité.

Le Space peut avoir une présence publique sans être lui-même un compte utilisateur.

### 2. Space ≠ utilisateur

Un utilisateur appartient à Citadelle.

Un Space est une entité distincte.

```
Citadelle
  User A
     |
     | member
     v
Spaces
  Space X
```

Un utilisateur peut :

- être propriétaire ;
- administrer ;
- éditer ;
- modérer ;
- analyser ;

un ou plusieurs Spaces selon les règles d'accès.

Le Space ne remplace jamais l'identité utilisateur.

### 3. Space ≠ commerce

Un Space peut être un vendeur ou un contexte commercial.

Cela ne signifie pas que les offres commerciales appartiennent à Spaces.

Exemple :

```
Spaces
  Space X
     |
     | sellerId
     v
Commerce
  Offer O100
     |
     | vendableId
     v
Portfolio
  Vendable V100
```

La propriété reste :

- Space → identité/vendeur/contexte ;
- Commerce → offre, prix, promotion, commande ;
- Portfolio → vendable.

Spaces ne doit pas stocker :

- prix ;
- promotions ;
- panier ;
- commandes ;
- lignes de commande ;
- stock ;
- inventaire.

### 4. Ownership ≠ propriété métier

Un Space peut être le contexte ou l'acteur propriétaire fonctionnel d'une ressource sans être la source de vérité technique de cette ressource.

Exemple :

```
Space X
  |
  +-- commercialise --> Commerce Offer O100
  |
  +-- publie ---------> Solara Publication P200
  |
  +-- réserve ---------> Booking Reservation R300
```

Les objets restent dans leurs BAC respectifs.

Spaces ne doit pas reproduire leur modèle métier.

### 5. Références de ressources

Un Space peut référencer des ressources externes :

- offres ;
- publications ;
- commandes ;
- réservations ;
- abonnements ;
- autres objets métier.

La référence est uniquement :

```
resourceId
resourceType
```

ou via le contrat de capability approprié.

Spaces ne fait pas de jointure inter-applications.

### 6. Modules / capabilities

Un Space peut activer des modules fonctionnels.

Exemples :

- commerce
- booking
- subscription
- solara

L'activation d'un module signifie :

« Ce Space est autorisé/configuré pour utiliser cette capability. »

Elle ne signifie pas :

« Spaces implémente cette fonctionnalité. »

Par exemple :

```
Space X
  enabledCapabilities:
    - commerce.offer.manage
    - booking.reservation.manage
    - solara.publication.manage
```

Les capacités sont déclarées et implémentées par les BACs compétents.

### 7. Autorisation par capability

L'activation d'une capability dans Spaces ne suffit pas à elle seule à autoriser une opération.

Le système cible doit également appliquer ses propres règles d'autorisation.

Exemple :

```
User A
   |
   | acting-as
   v
Space X
   |
   | commerce.offer.create
   v
Commerce
   |
   +--> vérifie capability
   +--> vérifie rôle/permission
   +--> effectue l'opération
```

Spaces fournit le contexte d'identité et d'action.

Commerce reste responsable de l'autorisation métier de l'offre.

### 8. Équipes

Spaces possède les équipes locales.

Rôles de référence :

- owner ;
- administrator ;
- editor ;
- moderator ;
- analyst.

Les rôles peuvent être associés à des permissions/capabilities.

Exemple :

```
Space X
  |
  +-- User A : owner
  +-- User B : administrator
  +-- User C : editor
  +-- User D : analyst
```

Le rôle local ne doit pas être interprété automatiquement comme une permission universelle dans toutes les applications.

Chaque BAC conserve ses règles d'autorisation métier.

### 9. Demandes d'adhésion

Spaces possède :

- demandes d'adhésion ;
- invitations ;
- acceptations ;
- refus ;
- révocations.

Le processus doit permettre de déterminer :

- qui demande ;
- quel Space ;
- quel rôle demandé ;
- qui approuve ;
- quand ;
- selon quelles règles.

Les données utilisateur restent référencées vers Citadelle.

### 10. Audience / followers

Si le produit conserve la notion d'audience/followers, Spaces peut posséder :

- relation utilisateur → Space ;
- suivi ;
- désabonnement ;
- statut de suivi.

En revanche, Spaces ne doit pas devenir un système général de messaging ou de notification.

Les communications passent par Notifications.

### 11. Acting-as-space

acting-as-space est une primitive majeure de l'architecture.

Elle représente :

« L'utilisateur X agit actuellement au nom du Space Y avec le rôle Z dans le contexte C. »

Le contexte doit permettre de déterminer :

- actorUserId ;
- spaceId ;
- rôle effectif ;
- capability utilisée ;
- action ;
- timestamp ;
- résultat ;
- éventuellement ressource ciblée.

Exemple :

```
actorUserId = U123
spaceId     = S456
role        = administrator
capability  = commerce.offer.create
action      = createOffer
resourceId  = O789
```

### 12. Audit

Toute action significative effectuée acting-as-space doit pouvoir être auditée.

L'audit doit permettre de répondre à :

- qui a agi ?
- au nom de quel Space ?
- avec quel rôle ?
- avec quelle capability ?
- sur quelle ressource ?
- quelle action ?
- quand ?
- quel résultat ?

Exemple :

```
User U123
   |
   | acting-as Space S456
   |
   | create Commerce Offer O789
   v
Audit
   actor = U123
   subject = Space S456
   action = commerce.offer.create
   resource = O789
```

L'audit peut être conservé dans Spaces ou délégué à un service d'audit transverse si celui-ci existe.

Mais le contexte acting-as-space doit rester traçable.

### 13. Business Registry

business-registry doit rester limité au statut et à la vérification de l'entité.

Il peut gérer :

- déclaration ;
- vérification ;
- rejet ;
- révocation ;
- statut de vérification ;
- documents/références nécessaires à la vérification ;
- historique de décision.

Il ne doit pas gérer :

- commandes ;
- paiements ;
- prix ;
- stock ;
- offres ;
- factures ;
- réservations.

Exemple :

```
Space
  |
  v
Business Registry
  status = verified
```

Puis Commerce peut appliquer sa propre règle :

```
Space verified
      |
      v
Commerce
  seller eligibility = allowed
```

La vérification n'implémente donc pas directement le métier Commerce.

### 14. Pages et ressources propres

Spaces peut posséder ses propres ressources :

- page du Space ;
- branding ;
- logo ;
- couverture ;
- navigation ;
- thème ;
- ressources de présentation.

Ces ressources sont différentes des contenus métier des autres applications.

Par exemple :

```
Spaces
  Space page
  Branding
  Navigation

Solara
  Publication

Portfolio
  Vendable

Commerce
  Offer

Booking
  Reservation
```

### 15. Domaine et navigation publique

Spaces peut gérer :

- domaine personnalisé ;
- slug ;
- navigation ;
- structure publique ;
- pages propres au Space ;
- configuration de template.

Le domaine public ne donne pas à Spaces la propriété des données affichées.

Une page Space peut agréger des références :

```
Space Page
   |
   +--> Offer O1
   +--> Offer O2
   +--> Publication P1
   +--> Vendable V1
```

Mais les données restent dans les BACs propriétaires.

## Données possédées — source de vérité

### Identité Space

- Spaces ;
- slug ;
- catégorie/type ;
- template ;
- statut ;
- domaine ;
- navigation ;
- configuration publique.

### Équipe

- membres ;
- rôles locaux ;
- invitations ;
- demandes d'adhésion ;
- révocations.

### Capabilities

- capabilities activées ;
- configuration de module ;
- état d'activation.

### Business registry

- statut de vérification ;
- décisions ;
- historique de vérification.

### Acting-as-space

- contexte d'action ;
- délégation ;
- traces nécessaires à l'audit.

### Ressources propres

- pages ;
- branding ;
- médias de marque ;
- navigation.

### Audience

- followers ;
- relations de suivi ;
- préférences propres au suivi si applicables.

## Données explicitement exclues

Spaces ne possède pas :

- vendables → Portfolio ;
- offres → Commerce ;
- prix → Commerce ;
- promotions → Commerce ;
- stock → Inventory ;
- réservations → Booking ;
- commandes → Commerce ;
- abonnements → Subscription ;
- paiements → Payments ;
- factures → Billing ;
- publications → Solara ;
- données utilisateur → Citadelle.

Même lorsqu'un objet est associé à un Space, Spaces ne devient pas sa source de vérité.

## Références externes — par ID, jamais de jointure

- owner → Citadelle par ID opaque ;
- member → Citadelle par ID opaque ;
- vendable → Portfolio par ID ;
- offre → Commerce par ID ;
- commande → Commerce par ID ;
- réservation → Booking par ID ;
- abonnement → Subscription par ID ;
- publication → Solara par ID ;
- paiement → Payments par ID ;
- facture → Billing par ID.

Aucune jointure inter-applications.

## Interactions

`spaces` est monté sur `RuntimeKernel` via un conteneur enfant par tenant.

Les communications inter-applications se font exclusivement par :

- capabilities ;
- événements.

Aucun import direct inter-applications.

L'infrastructure est consommée exclusivement via des ports/adapters.

### Exemple : Space vendeur

```
User
  |
  | acting-as
  v
Spaces
  Space S1
     |
     | capability
     v
Commerce
  Offer O1
     |
     v
Portfolio
  Vendable V1
```

Spaces fournit le contexte.

Commerce crée l'offre.

Portfolio définit le vendable.

### Exemple : Space publiant

```
User
  |
  | acting-as Space S1
  v
Spaces
  |
  | solara.publication.create
  v
Solara
  Publication P1
```

La publication appartient à Solara.

Le Space est son contexte de publication.

### Exemple : Space opérateur de réservation

```
Space S1
   |
   | resourceId
   v
Booking
   |
   +--> Resource R1
   +--> Slots
   +--> Reservations
```

Booking possède la disponibilité et les réservations.

Spaces possède uniquement l'entité Space et ses droits/contexte.

## Invariants de frontières — ADR-0016

1. **Space ≠ utilisateur** — Citadelle possède l'identité utilisateur ; Spaces possède l'entité Space.
2. **Space ≠ commerce** — un Space peut vendre ; Commerce possède l'offre et la vente.
3. **Ownership ≠ propriété métier** — l'association à un Space ne déplace pas la source de vérité.
4. **Space ≠ vendable** — Portfolio possède le vendable.
5. **Space ≠ réservation** — Booking possède la réservation.
6. **Space ≠ abonnement** — Subscription possède l'engagement récurrent.
7. **Space ≠ paiement** — Payments possède la transaction financière.
8. **Capability activée ≠ capability implémentée** — Spaces active/configure ; le BAC compétent implémente.
9. **Acting-as-space toujours audité** — toute action au nom d'un Space doit conserver son contexte d'acteur.
10. **Autorisation distribuée** — Spaces valide l'appartenance et le contexte ; le BAC cible valide l'autorisation métier.

## Capabilities

Les capabilities principales peuvent inclure :

```
spaces.space.create
spaces.space.read
spaces.space.update
spaces.space.archive

spaces.member.invite
spaces.member.accept
spaces.member.remove
spaces.member.role.update

spaces.module.list
spaces.module.enable
spaces.module.disable

spaces.acting_as.start
spaces.acting_as.context

spaces.audit.read

spaces.business.verify
spaces.business.reject
spaces.business.revoke
```

Les capabilities métier d'autres applications ne sont pas réimplémentées dans Spaces.

## Événements

Exemples :

```
spaces.space.created
spaces.space.updated
spaces.space.archived

spaces.member.invited
spaces.member.joined
spaces.member.removed
spaces.member.role.changed

spaces.module.enabled
spaces.module.disabled

spaces.business.verification.requested
spaces.business.verified
spaces.business.rejected
spaces.business.revoked

spaces.acting_as.started
spaces.acting_as.ended
```

Les événements doivent éviter de transporter les données métier complètes des BACs externes.

## Découpe interne recommandée

```
spaces/
  domain/
    space/
    membership/
    role/
    capability/
    acting-as/
    audit/
    business-registry/
    audience/
    page/
    branding/
    navigation/
  application/
    commands/
    queries/
    capabilities/
    events/
  infrastructure/
  presentation/
```

Les ressources métier externes restent hors de ces agrégats.

## Découpe cible globale

| Domaine | Responsabilité | Source de vérité |
| --- | --- | --- |
| `citadelle` | Identités utilisateurs | User |
| `spaces` | Entités, équipes, contexte d'action | Space |
| `portfolio` | Vendables | Vendable |
| `commerce` | Offres, prix, promotions, commandes | Vente |
| `subscription` | Abonnements | Engagement récurrent |
| `booking` | Disponibilité & réservations | Capacité |
| `inventory` | Stock | Ressources physiques |
| `solara` | Publications/contenus | Publication |
| `payments` | Transactions financières | Paiement |
| `billing` | Documents financiers | Facture |
| `notifications` | Communication | Message |

## Écarts cible-vs-réel

### Business Registry

Vérifier que business-registry ne contient aucune logique :

- commande ;
- paiement ;
- prix ;
- offre ;
- stock ;
- réservation.

Il doit rester centré sur :

```
Entity
   |
   +--> verification requested
   +--> verified
   +--> rejected
   +--> revoked
```

### Templates / Pages

Les templates et pages ne doivent pas devenir des conteneurs de données métier.

Ils peuvent contenir :

- configuration ;
- layout ;
- références ;
- composition ;
- navigation.

Ils ne doivent pas dupliquer :

- prix Commerce ;
- stock Inventory ;
- caractéristiques Portfolio ;
- réservations Booking ;
- commandes Commerce.

### Acting-as-space

Si acting-as-space est actuellement dispersé dans plusieurs controllers, il doit être centralisé derrière un contrat commun permettant de transmettre :

- actor
- space
- role
- capability
- tenant
- correlationId

L'audit doit être systématique.

## Frontières

- Aucun import depuis une autre app.
- Aucun accès infrastructure direct hors ports.
- Aucune route sans autorisation.
- Aucun prix dans Spaces.
- Aucun stock dans Spaces.
- Aucune offre dans Spaces.
- Aucune commande dans Spaces.
- Aucun paiement dans Spaces.
- Aucune réservation dans Spaces.
- Aucun abonnement dans Spaces.
- Aucune publication Solara dans Spaces.
- Aucune duplication des données métier externes.
- Les références inter-applications sont uniquement par ID.
- Les communications inter-applications passent par capabilities/événements.
- acting-as-space est toujours autorisé et audité.
- Le BAC cible reste responsable de son autorisation métier.

## Non-responsabilités

`spaces` ne :

- réimplémente pas le kernel ;
- réimplémente pas le gateway ;
- réimplémente pas les adapters ;
- ne gère pas les vendables ;
- ne gère pas les offres ;
- ne gère pas les prix ;
- ne gère pas les promotions ;
- ne gère pas les commandes ;
- ne gère pas le stock ;
- ne gère pas les réservations ;
- ne gère pas les abonnements ;
- ne gère pas les paiements ;
- ne gère pas les factures ;
- ne gère pas les publications ;
- ne gère pas les données d'identité utilisateur ;
- n'expose pas de secret.

## Critères de santé

- [ ] Conforme à `pnpm check:conformance`.
- [ ] Conforme à `pnpm check:manifests`.
- [ ] Tests de domaine verts (`*.test.ts`).
- [ ] OpenAPI généré sans erreur.
- [ ] Un Space est distinct d'un utilisateur.
- [ ] Un Space peut avoir plusieurs membres avec des rôles différents.
- [ ] acting-as-space contient l'acteur, le Space et le contexte d'autorisation.
- [ ] Toute action acting-as-space significative est auditée.
- [ ] Les capabilities activées ne contiennent aucune implémentation métier d'un autre BAC.
- [ ] Aucun prix n'est stocké dans Spaces.
- [ ] Aucun stock n'est stocké dans Spaces.
- [ ] Aucune commande n'est stockée dans Spaces.
- [ ] Aucune réservation n'est stockée dans Spaces.
- [ ] Aucun paiement n'est stocké dans Spaces.
- [ ] Les ressources externes sont référencées par ID.
- [ ] Les pages/templates ne dupliquent pas les données métier des autres BACs.
- [ ] business-registry est limité à la vérification de l'entité.
- [ ] Les autorisations métier restent dans les BACs propriétaires.
