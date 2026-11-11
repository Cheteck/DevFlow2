# IJIDeals Échos — Roadmap d’évolution de l’écosystème

> **Document de référence évolutif**
>
> **Vision :** construire un écosystème numérique algérien composé d'applications interconnectées, reposant sur le framework MosaiX. IJIDeals Échos en est le portail et l'expérience intégrée de référence : commerce, identité, espaces, social, communication et services peuvent y fonctionner ensemble, tout en restant des domaines et applications composables.
>
> **Slogan historique de la marketplace :** « Le Shopping malin ».
>
> **Contexte géographique initial :** Algérie, avec un ancrage à Jijel et une ambition de couverture nationale.
>
> **Principe de gouvernance du document :** distinguer les décisions explicites, les orientations architecturales, les idées exploratoires et les réalisations effectivement confirmées. Une application citée dans cette roadmap n'est pas nécessairement développée, déployée ou prête pour la production.

---

## 1. Vision stratégique

IJIDeals ne doit pas être réduit à un site e-commerce multi-vendeur. La vision s'est élargie vers un écosystème d'applications qui partagent une identité, des espaces d'activité, des capacités et des services communs.

L'utilisateur peut agir :
- en son nom personnel ;
- au nom d'un Space qu'il possède ou dans lequel il dispose d'un rôle autorisé ;
- dans plusieurs contextes sans devoir changer d'identité ou recréer ses relations.

Un Space peut représenter une boutique, une organisation, une association, une école, une marque, une communauté, un créateur ou d'autres acteurs collectifs. Il devient le contexte opérationnel depuis lequel ses membres publient, vendent, communiquent et gèrent des activités.

### L'ambition

1. **Une identité cohérente** pour les utilisateurs et les organisations.
2. **Un contexte d'action unifié** : personne ou Space actif.
3. **Des applications spécialisées** qui partagent des fondations communes.
4. **Une expérience intégrée** où les activités commerciales, sociales et opérationnelles se renforcent mutuellement.
5. **Une architecture composable** : chaque application utilise uniquement les domaines et capacités dont elle a besoin.
6. **Un écosystème ouvert progressivement** à de nouveaux métiers, clients et services construits sur MosaiX.

### IJIDeals comme application de référence

La composition de référence exprimée dans les discussions est :

`Citadelle + Solara + Portfolio + Commerce = IJIDeals`

Cette formule est une simplification volontaire de l'expérience produit. La composition complète peut également mobiliser Spaces, Beam, Payments, Media, Notifications, Trust et d'autres capacités transversales selon les parcours activés.

**Priorité stratégique actuelle :** consolider les fondations MosaiX et réduire les écarts architecturaux avant de construire un Composer complet ou de multiplier les applications.

---

## 2. Relation entre MosaiX et IJIDeals

MosaiX et IJIDeals ont des responsabilités différentes.

| Élément | Responsabilité |
|---|---|
| **MosaiX** | Framework, contrats, SDK, runtime, BAC, plugins, infrastructure et outils développeur |
| **BAC MosaiX** | Propriétaire d'un domaine métier ou transverse, de ses invariants et de ses données |
| **Application** | Expérience cohérente composée de BAC, capacités, interfaces et configuration |
| **IJIDeals Échos** | Écosystème produit et expérience intégrée de référence |
| **Applications IJIDeals** | Interfaces spécialisées pour des usages précis : social, commerce, messagerie, gestion, etc. |
| **Space** | Acteur métier et contexte d'action, pas une application ni un simple compte boutique |

Une application IJIDeals ne doit pas réimplémenter ses propres fondations d'identité, d'autorisation, de messagerie, de médias ou de paiement si ces responsabilités sont déjà fournies par des BAC partagés.

### Architecture conceptuelle

```text
                   IJIDeals Ecosystem
                           │
                 IJIDeals Échos Shell
          Navigation · contexte actif · expérience
                           │
        ┌──────────────────┼────────────────────┐
        │                  │                    │
   Applications        Applications        Clients spécialisés
   Web intégrées       autonomes            Desktop / Mobile
        │                  │                    │
        └──────────────────┼────────────────────┘
                           │
                 Applications composées
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
  BAC métier         BAC transversaux      Capacités / Plugins
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                  MosaiX Application
                    Contract Runtime
                           │
            Ports · Adapters · Infrastructure
                           │
              DB · Cache · Queue · Media · IA
```

Cette architecture est une cible logique. Elle ne prescrit pas que chaque bloc soit un microservice ou un déploiement séparé.

---

## 3. Principes produit et métier

### 3.1 L'identité est unifiée, le contexte est explicite

Un utilisateur conserve une identité personnelle. Lorsqu'il agit pour une organisation, un commerce ou une communauté, il sélectionne ou utilise le Space approprié.

L'identité active doit être comprise par les différentes applications :
- Social : publier ou commenter comme personne ou comme Space, selon les permissions.
- Beam : initier et gérer des conversations comme personne ou comme Space.
- Commerce : administrer les offres, commandes et activités commerciales d'un Space.
- Booking : gérer ou effectuer des réservations selon le rôle et le contexte.
- Solidarity : agir comme citoyen, association ou organisme habilité selon le scénario.

Le contexte actif n'est pas une simple préférence d'interface. Il doit être vérifié côté serveur et associé à des permissions effectives.

### 3.2 Spaces est le modèle d'acteur collectif

Un Space peut avoir :
- une identité publique et une page ;
- un type et des métadonnées ;
- des membres et des rôles ;
- des paramètres et une configuration ;
- des capacités activables ;
- des publications et interactions ;
- des offres commerciales si les capacités correspondantes sont accordées ;
- des moyens de communication et des outils de gestion.

Types évoqués dans les discussions et documents : Community, Creator, Organization, Commerce, Event, AI Agent. Cette liste est indicative et doit être gouvernée par des types et modèles réellement nécessaires.

**Décision de modélisation importante :** ne pas créer une entité `Shop` distincte si un Space de type commerce remplit ce rôle. Le Space est l'acteur vendeur ; les fonctionnalités commerciales lui sont accordées sous forme de capacités.

### 3.3 Produit, offre et Space : le paradigme commercial

Le modèle distinctif est :

`Product → Offer → Space`

- **Product** : fiche canonique d'un produit ou d'un bien/service vendable ; ne porte pas le prix, le stock ou le vendeur.
- **Offer** : proposition commerciale d'un Space pour un Product ; porte prix, devise, stock, état, conditions et politique de livraison.
- **Space** : vendeur ou fournisseur responsable de l'offre.

Plusieurs Spaces peuvent proposer des offres différentes pour un même Product. Commerce peut agréger ces offres afin de comparer prix, disponibilité, confiance et livraison.

Ce modèle doit éviter de dupliquer la fiche produit pour chaque vendeur, tout en permettant des produits spécifiques, services, biens numériques et expériences.

### 3.4 Social et commerce doivent se renforcer sans se confondre

Les événements métiers, par exemple la publication ou la mise à jour d'une offre, peuvent alimenter le flux social et les mécanismes de découverte. Mais Social ne devient pas propriétaire des offres, et Commerce ne devient pas propriétaire du fil d'actualité.

Les échanges entre domaines passent par des contrats et événements, pas par des imports directs de logique métier.

---

## 4. Catalogue des applications et domaines

Les noms ci-dessous reprennent les projets et orientations évoqués dans les discussions. Les catégories « application », « BAC », « service transverse » et « client » ne sont pas interchangeables.

### 4.1 Applications et domaines fondamentaux

| Nom | Nature cible | Rôle |
|---|---|---|
| **Citadelle** | BAC plateforme / identité | Comptes, authentification, sessions, identité et contexte d'identification |
| **Spaces** | BAC métier + expérience de gestion | Organisations, boutiques, communautés, membres, rôles, capacités et pages publiques |
| **Portfolio** | BAC métier / PIM | Catalogue canonique de produits, services, biens numériques et expériences |
| **Commerce** | BAC métier | Offres, commandes, panier, checkout et processus transactionnels |
| **Solara / Solarar** | BAC social | Publications, commentaires, réactions, abonnements, flux, découverte et modération |
| **Beam** | BAC de communication | Messagerie instantanée 1:1 et de groupe, conversations et contenus partagés |
| **Booking** | BAC métier | Réservations, disponibilités et parcours de prise de rendez-vous ou de réservation |
| **Solidarity** | BAC métier / application spécialisée | Coordination de solidarité, crises, dons, alertes et évacuations |

**Solara / Solarar :** les deux graphies apparaissent dans les échanges et documents. « Solara » est retenu dans ce document comme forme de référence provisoire ; le nom définitif reste à confirmer.

### 4.2 Services et BAC transversaux

| Nom | Nature cible | Rôle |
|---|---|---|
| **Payments** | BAC/service transverse | Orchestration des paiements, statuts, moyens et intégrations de paiement |
| **Shifty** | Nom technique évoqué pour le backend paiement | Implémentation ou sous-système de paiement ; frontière exacte à confirmer |
| **Billing** | BAC/service transverse | Facturation et documents financiers liés aux opérations |
| **Subscription** | BAC métier/transverse | Plans, abonnements, renouvellements, périodes d'essai et états d'abonnement |
| **Inventory** | BAC métier | Stocks, mouvements et disponibilité opérationnelle |
| **Trust** | BAC transverse | Vérification, réputation, confiance, badges et signaux de risque |
| **Assets** | BAC/service plateforme | Fichiers, médias, stockage et gestion des ressources |
| **Notifications** | BAC/service transverse | Notifications in-app, push, email et événements destinés aux utilisateurs |
| **Discovery** | BAC/service transverse | Recherche, indexation, recommandations et découverte |
| **Imperia** | BAC plateforme / gouvernance | Gouvernance, configuration, politiques, topologie, supervision, audit et gestion des extensions |
| **AI Runtime / Intelligence Core** | Infrastructure transverse | Accès gouverné aux modèles et services d'intelligence artificielle |

Ces domaines ne doivent pas être tous développés comme applications visibles. Certains sont des services ou BAC internes consommés par plusieurs applications.

### 4.3 Applications spécialisées et clients

| Nom | Nature | Rôle cible |
|---|---|---|
| **IJIDeals Échos** | Application intégrée / shell | Expérience principale combinant identité, Spaces, social, catalogue et commerce |
| **Spaces Manager** | Application de gestion | Administration approfondie des Spaces, membres, capacités et paramètres |
| **Forge** | Client desktop Tauri | Gestion commerciale et point de vente, avec priorité offline-first |
| **Aqua** | Expérience média / vidéo | Expériences vidéo et intégration média ; ne doit pas créer une nouvelle source de vérité pour les contenus possédés par d'autres BAC |
| **Commerce** | Application métier possible | Interface spécialisée de vente, gestion des offres, commandes et opérations |
| **Portfolio** | Application métier possible | Gestion de catalogues et de fiches vendables |
| **Solara** | Application sociale possible | Expérience sociale spécialisée |
| **Beam** | Application de communication possible | Messagerie spécialisée |
| **Booking** | Application métier possible | Gestion et réservation |
| **Solidarity Desk** | Client de gestion spécialisé | Interface opérationnelle pour les associations et équipes de crise |

Les interfaces spécialisées peuvent être des surfaces autonomes ou des MFE intégrés. Leur existence ne doit pas conduire à dupliquer le domaine métier sous-jacent.

### 4.4 Applications desktop Space OS envisagées

Une vision de clients desktop spécialisés pour les responsables de Spaces a été explorée. Elle comprend notamment :

- **Desk** : cockpit général d'un Space.
- **Forge** : commerce, caisse et gestion commerciale offline-first.
- **Pulse** : suivi et indicateurs opérationnels.
- **Relay** : communication et coordination.
- **Dispatch** : opérations et distribution.
- **Studio** : création et gestion de contenus.
- **Booking Desk** : gestion des réservations.
- **Stock** : gestion de stock.
- **Procure** : achats et approvisionnement.
- **People** : membres, équipes et ressources humaines.
- **Event** : gestion d'événements.
- **Care** : suivi et support.
- **Solidarity Desk** : opérations de solidarité et de crise.

Des verticales spécialisées ont également été évoquées : Creator, Academy, Property, Restaurant, Salon et Service Desk.

**Statut :** vision exploratoire et portefeuille d'idées, pas une liste de produits à construire immédiatement. Le besoin réel doit être validé par les usages des Spaces.

---

## 5. Fiches fonctionnelles des applications majeures

### 5.1 Citadelle — identité et accès

**Mission :** fournir l'identité de référence de l'écosystème.

Responsabilités envisagées :
- comptes utilisateurs et profils d'identité ;
- authentification et sessions ;
- intégration avec les mécanismes d'identité de MosaiX ;
- résolution de l'identité personnelle ;
- établissement du contexte d'acteur sans confondre utilisateur et Space ;
- autorisations d'accès aux capacités selon les politiques du système.

Citadelle ne doit pas devenir le propriétaire des rôles métier internes à tous les domaines. Les responsabilités de gouvernance, de politique et de ressources doivent rester bien séparées.

### 5.2 Spaces — organisations et contexte opérationnel

**Mission :** permettre à une personne de créer et gérer des espaces collectifs qui agissent dans l'écosystème.

Fonctions envisagées :
- création et configuration d'un Space ;
- types, modèles et personnalisation ;
- profil public, identité visuelle et informations ;
- membres, invitations et rôles ;
- capacités et modules activables ;
- page publique et paramètres ;
- gestion de boutique lorsqu'il s'agit d'un Space commercial ;
- activités et statistiques adaptées au type de Space.

Les capacités doivent exprimer ce qu'un Space peut faire, par exemple `can_create_offer`, plutôt que de transformer chaque fonction en licence ou en produit autonome.

### 5.3 Portfolio — catalogue et PIM

**Mission :** gérer les objets vendables canoniques.

Le périmètre peut inclure :
- produits physiques ;
- services ;
- biens numériques ;
- expériences ;
- catégories, attributs et variantes ;
- médias et documents associés ;
- normalisation et qualité des fiches ;
- enrichissement et classification.

Portfolio est distinct de Commerce : une fiche produit n'est pas une offre commerciale et ne contient pas les conditions de vente propres à chaque Space.

### 5.4 Commerce — transactions et offres

**Mission :** gérer la relation commerciale entre les Products, les Offers, les acheteurs et les vendeurs.

Périmètre cible :
- création d'offres par les Spaces autorisés ;
- prix, devise, stock ou disponibilité ;
- conditions, état et politique de livraison ;
- agrégation et comparaison des offres ;
- panier et checkout ;
- commandes et lignes de commande ;
- statuts et cycle de vie de commande ;
- annulation, retours et remboursements selon les politiques ;
- promotions et coupons ;
- intégration avec Payments, Inventory, Notifications et Trust.

La marketplace ne doit pas confondre catalogue global, offre du vendeur, commande et paiement. Ce sont des objets métier distincts.

### 5.5 Solara — réseau social

**Mission :** créer la couche sociale et de découverte de l'écosystème.

Fonctions discutées :
- publications ;
- commentaires et réponses ;
- réactions ;
- abonnements / followers ;
- flux d'actualité ;
- découverte de contenus et d'acteurs ;
- modération ;
- publication en tant que personne ou Space selon les droits ;
- intégration des activités issues de Commerce, Booking ou d'autres domaines.

Solara doit rester acteur-agnostique : le contenu est publié par un acteur autorisé, qui peut être un utilisateur ou un Space. Les données métier restent détenues par leur BAC source.

### 5.6 Beam — messagerie

**Mission :** permettre les conversations privées et collectives entre utilisateurs et Spaces.

Fonctions cibles évoquées :
- conversations 1:1 et de groupe ;
- messages en temps réel ;
- pièces jointes et contenus partagés ;
- notifications ;
- contexte d'identité active ;
- intégrations de conversation avec les offres, commandes, réservations et services.

Beam est un domaine de communication ; il ne doit pas devenir le propriétaire des commandes ou des réservations partagées dans une conversation.

### 5.7 Booking — réservations

**Mission :** gérer les disponibilités et les réservations des Spaces qui proposent des services, événements ou ressources réservables.

Cas d'usage potentiels :
- rendez-vous ;
- réservation de services ;
- événements ;
- ressources ou créneaux ;
- gestion par un Space et réservation par un utilisateur ;
- notifications et échanges via Beam.

Le périmètre précis des calendriers, paiements, acomptes et annulations doit être défini par vertical métier.

### 5.8 Solidarity — solidarité et gestion de crise

**Mission :** organiser l'entraide et la coordination lors de situations d'urgence ou de besoins collectifs.

Cas d'usage discutés :
- signalement et suivi de crises ;
- campagnes de dons ;
- collecte et répartition de ressources ;
- coordination de bénévoles et associations ;
- alertes ;
- informations d'évacuation ;
- coordination territoriale.

L'idée a notamment été motivée par les incendies en Algérie en août 2026. La sécurité des informations, la vérification des signalements et la prévention des fausses alertes sont essentielles.

---

## 6. Modèle économique

### 6.1 Marketplace et vendeurs

Le modèle initial d'IJIDeals privilégie la monétisation par abonnements des vendeurs, plutôt qu'une dépendance exclusive à une commission sur chaque transaction.

Les orientations discutées comprennent :
- plan gratuit limité avec commission sur les ventes ;
- plans payants avec abonnement mensuel ;
- période d'essai ;
- plans vendeurs flexibles ;
- limites de fonctionnalités et de capacités selon le plan ;
- paiements d'abonnement éventuellement hors ligne selon les contraintes locales ;
- offres évolutives pour différents niveaux de vendeurs.

Les noms de niveaux explorés : Starter, Basic, Premium, Pro, Entreprise et Elite. La grille définitive, les prix et les droits précis ne sont pas confirmés.

Une hypothèse de limite initiale du plan gratuit a été évoquée : jusqu'à 5 produits. Elle doit être traitée comme une proposition de configuration à confirmer, pas comme une règle définitivement adoptée.

### 6.2 Fonctions de gestion et de croissance pour les vendeurs

Les besoins exprimés pour les vendeurs comprennent :
- gestion des produits et des offres ;
- gestion de stock ;
- gestion des ventes et commandes ;
- retours ;
- employés et membres d'équipe ;
- analyse des ventes ;
- discussion directe avec les clients ;
- ventes croisées ;
- promotions et coupons ;
- modes de livraison personnalisés ;
- systèmes de popularité ;
- tableau de bord personnalisable ;
- incitation à compléter le profil ;
- vérification de documents et attribution de badges.

Ces fonctions doivent être distribuées entre les domaines responsables : Spaces, Portfolio, Commerce, Inventory, Beam, Trust, Notifications et Analytics/Discovery.

### 6.3 Autres modèles de revenus possibles

Les discussions évoquent des possibilités de monétisation plus larges à mesure que l'écosystème mûrit :
- abonnements ou options avancées pour les Spaces ;
- applications métier spécialisées ;
- services premium et capacités additionnelles ;
- outils professionnels desktop ;
- services d'intelligence et d'automatisation ;
- à terme, composants ou extensions distribués dans un écosystème MosaiX.

Ces pistes ne doivent pas détourner le MVP marketplace de sa proposition de valeur principale.

---

## 7. Architecture d'expérience et de frontend

### 7.1 IJIDeals Échos Shell

Le Shell est une couche d'orchestration d'expérience, pas un domaine métier.

Responsabilités envisagées :
- navigation globale ;
- chargement des expériences et MFE ;
- gestion du contexte actif ;
- état global minimal nécessaire ;
- feature flags et rollout ;
- résolution des capacités d'affichage ;
- intégration de l'Event Bus côté interface ;
- points d'extension pour navigation et panneaux.

Le Shell ne doit pas contenir les règles métier de Commerce, Spaces ou Solara.

### 7.2 Microfrontends

La vision historique utilise une architecture MFE pour séparer les expériences :
- Shell ;
- Spaces ;
- Commerce ;
- Social/Solara ;
- Chat/Beam ;
- Notifications ;
- Search/Discovery ;
- Media ;
- Payments.

Les MFE doivent rester des surfaces de présentation et d'interaction alignées sur les contrats des domaines backend. Un MFE ne devient pas automatiquement un BAC.

### 7.3 Communication inter-applications

Les applications et MFE ne doivent pas partager arbitrairement leur état interne ou s'importer directement.

Les échanges doivent utiliser :
- contrats d'API explicites ;
- événements métier ;
- état global minimal exposé par le Shell ;
- commandes ou capacités exposées par les domaines.

Exemples d'événements discutés :
- `offer.created` ;
- `space.updated` ;
- `order.placed` ;
- changement d'authentification ou de contexte actif.

L'Event Bus frontend et l'Event Bus backend sont deux mécanismes distincts, même s'ils peuvent refléter certains événements métier.

### 7.4 Direction visuelle déjà évoquée

Une direction d'interface sombre a été explorée :
- fond proche de `#121212` ;
- surfaces proches de `#1E1E1E` ;
- accents bleus et violets ;
- navigation latérale repliable ;
- sélecteur de contexte / Space ;
- expériences spécialisées intégrées dans une coque commune.

Ces éléments sont des repères de design issus des travaux antérieurs, pas une charte finale figée.

---

## 8. Socle technique et décisions de plateforme

### 8.1 Stack actuelle de référence

- **IJIDeals :** full-stack Next.js.
- **Frontend :** Next.js App Router, avec architecture modulaire et MFE selon les besoins.
- **UI :** React, Tailwind CSS et composants adaptés à l'expérience.
- **État / données :** Zustand et TanStack Query ont été utilisés ou envisagés dans la documentation historique.
- **Validation :** Zod.
- **Temps réel :** WebSockets selon les besoins.
- **Backend métier et runtime :** MosaiX, selon ses contrats et ses capacités.
- **Données :** infrastructure abstraite via les ports et adapters MosaiX ; les choix concrets doivent être documentés par environnement.

**Décision à préserver :** IJIDeals n'est plus à traiter comme un projet Laravel. La référence actuelle est Next.js full-stack construit sur les fondations MosaiX.

### 8.2 Frontières entre Next.js et MosaiX

Il faut définir clairement qui possède chaque responsabilité :
- Next.js sert les surfaces web, navigation, rendu et interactions frontend.
- MosaiX fournit les contrats, domaines, règles métier, ports, adapters et runtime selon le modèle d'intégration retenu.
- Les appels backend doivent passer par des frontières explicites et autorisées.
- Les règles métier critiques ne doivent pas exister uniquement dans les Server Actions ou dans le navigateur.
- Les applications desktop peuvent consommer les mêmes contrats de domaine sans dupliquer les règles.

### 8.3 Sécurité et autorisations

- L'identité personnelle et le Space actif doivent rester distincts.
- Toute action au nom d'un Space doit être autorisée côté serveur.
- Les capacités d'un Space ne sont pas à elles seules des permissions utilisateur.
- Les politiques doivent tenir compte de l'acteur, de l'action, de la ressource et du contexte.
- Les opérations sensibles doivent être auditées.
- Les interfaces ne sont jamais une frontière de sécurité suffisante.

### 8.4 Données et propriété métier

Chaque BAC possède ses modèles et ses invariants :
- Citadelle : identité et sessions ;
- Spaces : Spaces, membres et relations ;
- Portfolio : objets vendables canoniques ;
- Commerce : offres, paniers, commandes et processus transactionnels ;
- Solara : publications et interactions sociales ;
- Beam : conversations et messages ;
- Booking : réservations ;
- Solidarity : campagnes et opérations de solidarité.

Les domaines communiquent par contrats et événements. Ils ne doivent pas faire de jointures ou mutations directes sur les tables d'un autre domaine.

---

## 9. Intelligence artificielle dans l'écosystème

Une couche d'intelligence transverse a été explorée sous les appellations **AI Runtime**, **IJIDeals Intelligence Core** et **Jev** (nom de travail mentionné dans une proposition antérieure).

### Orientation architecturale

- Les BAC conservent leurs règles métier et leurs invariants.
- L'intelligence fournit des capacités d'analyse, de classification, d'extraction, de recommandation ou de génération.
- Imperia gouverne les politiques et les extensions.
- Citadelle apporte l'identité et le contexte d'autorisation.
- Les décisions IA doivent pouvoir être vérifiées, auditées et, lorsque nécessaire, soumises à une validation humaine.
- Aucun BAC ne doit dépendre directement d'un fournisseur de modèle ou d'un nom de modèle.

### Cas d'usage envisagés

- Commerce : classification de produits, extraction de caractéristiques, score de qualité de fiche, score de risque vendeur.
- Beam : détection d'intention dans les messages et assistance à la gestion.
- Spaces : modération de contenus.
- Solidarity : aide au tri et à la qualification de signalements, avec prudence renforcée.
- Booking : assistance à la gestion et détection de situations nécessitant une revue.
- Solara : aide à la modération et à la découverte.

Des identifiants de capacités ont été proposés dans un document antérieur :
- `commerce.product.classify`
- `commerce.product.extract`
- `commerce.product.quality.score`
- `commerce.seller.risk.score`
- `beam.message.intent`
- `spaces.content.moderate`

Ils constituent des exemples de contrats proposés, pas une preuve de leur implémentation.

### Comptes IA et agents

Une idée exploratoire consiste à permettre à des comptes IA d'exister dans IJIDeals avec des attributs proches de comptes humains, capables de publier ou commenter et d'interagir avec d'autres agents.

Cette idée exige une distinction stricte entre :
- identité d'un agent ;
- propriétaire ou responsable humain ;
- capacités accordées ;
- actions automatisées ;
- transparence envers les utilisateurs ;
- limites de publication, de messagerie et de modération.

Un compte IA ne doit pas pouvoir se faire passer silencieusement pour un humain ni contourner les politiques des Spaces.

---

## 10. Extensions de l'écosystème et projets adjacents

Ces projets appartiennent à la vision élargie autour de MosaiX et peuvent utiliser certaines capacités d'IJIDeals, mais ne doivent pas être assimilés à des modules obligatoires de la marketplace.

### MosaiX Cloud

Plateforme de développement et d'exécution envisagée, comparable dans son ambition à une plateforme cloud pour développeurs :
- projets et dépôts ;
- build, preview et déploiement ;
- services managés ;
- exécution d'applications Next.js et d'applications MosaiX ;
- registre et déploiement de BAC.

### IJI Data

Vision d'infrastructure de données et de services numériques avec ancrage algérien :
- compute ;
- stockage ;
- bases de données ;
- réseau ;
- sauvegarde ;
- sécurité et reprise après sinistre.

MosaiX doit pouvoir s'appuyer sur ces infrastructures via ses ports et adapters, sans réinventer chaque couche d'infrastructure.

### Marketplace de BAC et composants

Vision d'un catalogue permettant de découvrir et réutiliser des BAC, plugins et composants compatibles MosaiX. Ce projet dépend de la maturité des contrats, du packaging, de la sécurité et du runtime.

### RAQIB

RAQIB est un opérateur IA destiné à aider à gérer MosaiX et IJIDeals sous l'autorité stratégique du fondateur. Il relève de l'exploitation et de l'orchestration de l'entreprise, et non d'une application utilisateur obligatoire de l'écosystème IJIDeals.

### Applications verticales supplémentaires

Les verticales envisagées peuvent couvrir formation, restauration, immobilier, salons, services, événements et autres métiers. Leur création doit réutiliser les BAC appropriés plutôt que multiplier les systèmes autonomes.

---

## 11. Roadmap de réalisation

Les étapes ci-dessous ordonnent les dépendances. Elles ne sont pas des dates de livraison. La priorité donnée à MosaiX est volontaire : l'écosystème ne doit pas construire son expansion sur des fondations runtime instables.

### Étape 0 — Clarifier le périmètre produit et stabiliser les décisions

**Objectif :** disposer d'une vision cohérente des domaines, applications, acteurs et responsabilités.

Chantiers :
- valider le vocabulaire officiel : IJIDeals, Échos, Spaces, Solara, Portfolio, Commerce, Beam ;
- distinguer BAC, application, MFE, client desktop et service transverse ;
- établir une carte de propriété des données ;
- établir la matrice des dépendances ;
- conserver la décision Next.js full-stack ;
- confirmer le modèle Space comme vendeur et acteur collectif ;
- classer les idées historiques en confirmé, exploratoire, reporté ou abandonné.

Critères de sortie :
- chaque domaine a un propriétaire et un périmètre ;
- aucun concept central ne possède deux sources de vérité ;
- la composition cible IJIDeals est documentée ;
- les décisions contradictoires ou obsolètes sont explicitement résolues.

**Statut prudent :** vision et nombreux domaines documentés ; consolidation du référentiel encore nécessaire.

### Étape 1 — Consolider les fondations MosaiX

**Objectif :** rendre les contrats, adapters, permissions, lifecycle et runtime assez fiables pour porter les applications.

Chantiers :
- réduire les gaps identifiés dans les audits MosaiX ;
- vérifier les fallbacks mémoire et la persistance ;
- stabiliser le contrat d'application et le cycle de vie des BAC ;
- appliquer réellement les capacités ;
- fiabiliser événements, outbox, erreurs et observabilité ;
- clarifier SDK et ports d'infrastructure.

Critères de sortie :
- les applications s'appuient sur des contrats stables ;
- les dépendances et capacités sont validées au runtime ;
- les adapters respectent leurs garanties ;
- les tests transversaux couvrent les scénarios d'échec.

**Priorité explicitement exprimée :** réduire les écarts des fondations avant de construire le Composer.

### Étape 2 — Stabiliser les fondations métier communes

**Objectif :** rendre fiables les domaines sur lesquels toutes les applications reposent.

Ordre de travail recommandé :
1. Citadelle / identité.
2. Spaces / acteurs, membres, rôles et contexte actif.
3. Portfolio / objets vendables.
4. Commerce / offres et commandes.
5. Assets / médias.
6. Notifications et événements transversaux.

Critères de sortie :
- les frontières de données sont respectées ;
- les parcours d'identité personnelle et d'action au nom d'un Space fonctionnent ;
- le paradigme Product → Offer → Space est appliqué ;
- les contrats sont consommables depuis les clients web.

### Étape 3 — Livrer le cœur IJIDeals marketplace

**Objectif :** produire une expérience de vente utilisable et cohérente.

MVP fonctionnel :
- inscription et authentification ;
- création et configuration d'un Space vendeur ;
- profil public du Space ;
- catalogue de produits ;
- création d'offres ;
- consultation et comparaison des offres ;
- panier et checkout selon les moyens de paiement disponibles ;
- création et suivi de commande ;
- notifications essentielles ;
- gestion initiale du stock et de la livraison.

Critères de sortie :
- un vendeur peut publier une offre ;
- un acheteur peut découvrir une offre et passer commande ;
- la commande référence correctement le Product, l'Offer, le Space et l'acheteur ;
- les états transactionnels sont traçables ;
- les parcours essentiels sont utilisables sur mobile.

### Étape 4 — Développer les capacités commerciales avancées

**Objectif :** rendre IJIDeals viable pour les vendeurs et les opérations quotidiennes.

Chantiers :
- plans vendeurs et abonnement ;
- période d'essai et plan gratuit ;
- commissions et limites fonctionnelles ;
- promotions et coupons ;
- livraison personnalisée ;
- gestion des retours ;
- employés et permissions de l'équipe ;
- statistiques et analyses de ventes ;
- ventes croisées ;
- popularité et réputation ;
- vérification documentaire et badges ;
- incitation à compléter les profils.

Critères de sortie :
- les plans et capacités sont appliqués côté backend ;
- les événements d'abonnement et de facturation sont traçables ;
- les vendeurs comprennent clairement leurs limites et avantages ;
- les opérations de vente, retour et stock sont cohérentes.

### Étape 5 — Construire l'expérience sociale Solara

**Objectif :** intégrer la découverte sociale au parcours marketplace.

Chantiers :
- profils personnels et pages de Spaces ;
- publications, commentaires, réactions ;
- abonnements ;
- flux et découverte ;
- publications au nom d'un Space ;
- activités commerciales dans le flux ;
- modération et signalement ;
- outils de visibilité pour les vendeurs et créateurs.

Critères de sortie :
- les utilisateurs peuvent interagir socialement ;
- les Spaces peuvent publier avec des permissions vérifiées ;
- les événements de Commerce peuvent être présentés sans transfert de propriété métier à Solara ;
- la modération dispose d'un processus clair.

### Étape 6 — Déployer Beam et les interactions entre applications

**Objectif :** relier les acteurs et les parcours commerciaux ou sociaux par la communication.

Chantiers :
- conversations 1:1 et groupes ;
- conversations utilisateur ↔ Space ;
- partage d'offres, produits et commandes ;
- notifications temps réel ;
- pièces jointes via Assets ;
- règles anti-spam et sécurité ;
- intégration de Beam dans les parcours Commerce, Booking et Spaces.

Critères de sortie :
- le contexte d'acteur est préservé dans les conversations ;
- les accès aux conversations sont vérifiés côté serveur ;
- les objets partagés restent détenus par leur domaine source.

### Étape 7 — Étendre l'écosystème métier

**Objectif :** introduire des usages qui dépassent la marketplace sans fragiliser son cœur.

Ordre indicatif :
- Booking ;
- Inventory avancé ;
- Trust et vérification ;
- Aqua / vidéo et médias enrichis ;
- Solidarity ;
- verticales spécialisées.

Critères de sortie :
- chaque nouveau domaine répond à un besoin utilisateur démontré ;
- les applications réutilisent identité, Spaces, notifications, médias et politiques ;
- aucun domaine n'est ajouté uniquement pour compléter un catalogue théorique.

### Étape 8 — Clients spécialisés et Space OS

**Objectif :** offrir des outils adaptés aux opérations quotidiennes des Spaces.

Chantiers :
- Spaces Manager ;
- Forge desktop Tauri ;
- POS et opérations offline-first ;
- synchronisation fiable et résolution de conflits ;
- autres clients Desk, Booking Desk, Stock, Procure, People, Studio, Dispatch.

Critères de sortie :
- les clients desktop réutilisent les contrats métier ;
- les opérations hors ligne sont explicites et synchronisées de manière contrôlée ;
- les conflits de stock, commandes et identités ne produisent pas de corruption silencieuse.

### Étape 9 — Intelligence et automatisation gouvernées

**Objectif :** ajouter des capacités IA mesurables aux domaines, sans déplacer leurs invariants vers les modèles.

Chantiers :
- AI Runtime provider-agnostic ;
- classification et extraction produit ;
- qualité catalogue ;
- modération ;
- détection de risques ;
- assistance à la communication ;
- validation humaine et audit ;
- comptes IA transparents si le besoin est confirmé.

Critères de sortie :
- chaque capacité IA a un contrat et une mesure de qualité ;
- les décisions critiques ont des garde-fous ;
- les BAC restent propriétaires des règles métier ;
- les modèles peuvent être remplacés sans réécrire les domaines.

### Étape 10 — Composition déclarative et ouverture de l'écosystème

**Objectif :** permettre de construire de nouvelles applications à partir de BAC et capacités sans modifier le noyau pour chaque produit.

Chantiers :
- application manifests ;
- résolution de dépendances ;
- composition dynamique ;
- CLI / Composer ;
- packaging et distribution ;
- registre de BAC et plugins ;
- politiques de confiance ;
- runtime profiles et déploiement hybride.

Critères de sortie :
- une application de référence peut être décrite par manifeste ;
- les BAC sont validés et activés par le runtime ;
- les incompatibilités sont détectées avant exécution ;
- les composants distribués sont inspectables et vérifiables.

---

## 12. Applications de référence pour valider l'écosystème

| Application | Composition indicative | Ce qu'elle prouve |
|---|---|---|
| **IJIDeals** | Citadelle + Spaces + Portfolio + Commerce + Solara, avec Beam et services transversaux | Marketplace sociale intégrée |
| **Spaces Manager** | Citadelle + Spaces + Trust + Notifications | Gestion multi-organisation |
| **Creator Platform** | Citadelle + Spaces + Portfolio + Solara + Beam + Media | Économie des créateurs |
| **LMS / Academy** | Citadelle + Spaces + Learning + Beam + Media + Booking selon besoin | Réutilisation des fondations hors commerce |
| **ERP léger** | Citadelle + Spaces + Commerce + Inventory + Billing + Workflow | Réutilisation des domaines opérationnels |
| **Solidarity** | Citadelle + Spaces + Solidarity + Notifications + Media + Trust | Coordination citoyenne et associative |
| **Forge** | Client desktop + Citadelle + Spaces + Commerce + Inventory + Payments | Client offline-first sur les mêmes domaines |

Ces compositions sont des références de conception. Elles ne signifient pas que toutes ces applications sont déjà assemblées ou en production.

---

## 13. Risques et décisions à surveiller

| Risque | Conséquence | Réponse |
|---|---|---|
| Confondre IJIDeals avec la seule marketplace | Réduire la vision d'écosystème | Préserver la distinction portail / applications / BAC |
| Construire trop d'applications simultanément | Dispersion et fondations fragiles | Prioriser les parcours marketplace et les fondations communes |
| Confondre Space et Shop | Multiplication inutile des entités | Space comme acteur vendeur, capacités commerciales |
| Mélanger Product et Offer | Données dupliquées et comparaison impossible | Maintenir Product → Offer → Space |
| Shell trop intelligent | Couplage et règles métier cachées | Shell d'orchestration, domaines propriétaires |
| MFE = microservice | Complexité d'exploitation | Séparer architecture frontend et architecture backend |
| Capacités non vérifiées côté serveur | Élévation de privilèges | Enforcement runtime et policy engine |
| IA propriétaire du métier | Invariants incohérents | IA comme service d'assistance gouverné |
| Offline-first sans stratégie de conflit | Corruption des données | Synchronisation, idempotence et résolution de conflits |
| Trop de verticales trop tôt | Coûts de maintenance | Valider les usages avant création |
| Monétisation trop complexe | Confusion vendeurs et friction d'adoption | Démarrer avec une grille simple et transparente |

---

## 14. État initial et niveau de certitude

Cette table est une synthèse prudente des informations retrouvées dans les discussions et documents. Elle ne constitue pas un audit du dépôt actuel.

| Domaine / projet | Niveau de définition dans les échanges | État de réalisation |
|---|---|---|
| IJIDeals Échos | Vision et documentation détaillées | État actuel à confirmer |
| Citadelle / Identity | Domaine et architecture discutés ; présent dans un audit MosaiX antérieur | État actuel à confirmer |
| Spaces | Modèle métier et rôle central explicités | État actuel à confirmer |
| Portfolio | Paradigme PIM / Product documenté | État actuel à confirmer |
| Commerce | Domaine transactionnel et modèle d'offre documentés | État actuel à confirmer |
| Solara / Solarar | Périmètre social documenté | État actuel à confirmer |
| Beam | Messagerie 1:1 et groupe documentée | État actuel à confirmer |
| Booking | Domaine et cas d'usage identifiés | Planification / état à confirmer |
| Solidarity | Vision fonctionnelle et contexte d'usage évoqués | Exploration / état à confirmer |
| Payments / Shifty | Orientation technique évoquée | Frontière et état à confirmer |
| Billing / Subscription | Modèle de revenus et plans vendeurs discutés | État à confirmer |
| Inventory | Domaine métier identifié | État à confirmer |
| Trust | Vérification, réputation et badges évoqués | État à confirmer |
| Assets / Notifications / Discovery | Services transversaux identifiés | État à confirmer |
| Imperia | Gouvernance plateforme documentée dans les travaux MosaiX | État actuel à confirmer |
| Aqua | Vision média/vidéo évoquée | Exploration / état à confirmer |
| Forge | Vision client desktop Tauri offline-first | Projet envisagé ; état à confirmer |
| Spaces Manager | Application de gestion identifiée | État à confirmer |
| AI Runtime / Intelligence Core | Architecture et cas d'usage proposés | Exploration / état à confirmer |
| Comptes IA | Idée exploratoire | Non confirmé |
| MosaiX Cloud / IJI Data | Vision d'écosystème adjacente | Exploration / planification |

---

## 15. Journal des décisions et évolutions

| Date | Information | Impact |
|---|---|---|
| 2026-06-27 | Documentation de requirements d'un système de plugins MFE, avec phases Foundation, Runtime, Consumer et Major Refactors | Historique de l'architecture d'extension ; à réconcilier avec le Plugin Runtime MosaiX actuel |
| 2026-09-26 | Vision en couches : MosaiX Core, BAC plateforme, BAC métier et applications First Tier | Clarification des responsabilités entre plateforme et produits |
| 2026-10-05 | Vision Space OS et applications desktop spécialisées | Extension de l'écosystème vers les outils opérationnels |
| 2026-10-06 | Proposition IJIDeals Intelligence Core / Jev et cas d'usage IA | Ajout d'une couche d'intelligence gouvernée |
| 2026-11-05 | Vision explicite d'un écosystème social, marketplace, Booking, Solidarity, unifié par l'identité personnelle ou Space | Consolidation de l'expérience multi-applications |
| 2026-11-05 | Composition cible exprimée : Citadelle + Solara + Portfolio + Commerce = IJIDeals | Formule de référence pour la composition de l'application |
| 2026-11-05 | Priorité explicite donnée à la réduction des gaps MosaiX avant le Composer | La roadmap IJIDeals dépend de la consolidation du framework |
| 2026-11-08 | Création de cette roadmap à partir des anciennes discussions et documents disponibles | Référentiel initial de l'écosystème |

---

## 16. Questions structurantes à résoudre

Ces questions sont ouvertes et doivent être tranchées progressivement à partir des usages et de l'architecture réelle.

1. Quel est le nom officiel de l'expérience intégrée : IJIDeals, IJIDeals Échos ou Échos ?
2. Solara ou Solarar : quelle graphie devient officielle ?
3. Quelle est la frontière exacte entre Citadelle et les mécanismes d'autorisation/policies de MosaiX et Imperia ?
4. Quelle partie du contexte actif est portée par le Shell et quelle partie est une vérité backend ?
5. Le panier est-il global à l'expérience ou strictement détenu par Commerce avec une façade globale ?
6. Comment gérer les commandes multi-vendeurs et leurs cycles de livraison, paiement et retour ?
7. Quel est le rôle précis de Shifty par rapport à Payments ?
8. Quels moyens de paiement et parcours de règlement sont réellement disponibles dans le contexte algérien ?
9. Quelle est la première grille tarifaire vendeurs et quelles capacités sont liées à chaque plan ?
10. Quel est le périmètre MVP exact de Solara, Beam et Booking ?
11. Quels cas d'usage Solidarity exigent des validations institutionnelles ou des mécanismes de vérification renforcés ?
12. Quelle stratégie de synchronisation offline-first sera retenue pour Forge ?
13. Quelles applications desktop répondent à une demande réelle et lesquelles restent des concepts ?
14. Quelle gouvernance encadre les comptes IA et leurs interactions publiques ?
15. À quel moment le registre de BAC et le Composer apportent-ils une valeur réelle sans détourner les ressources de MosaiX Core ?

---

## 17. Gouvernance de cette roadmap

Ce document est la référence évolutive de l'écosystème IJIDeals.

À chaque nouvelle information communiquée :
- intégrer les nouveaux produits, applications, BAC, capacités et changements de vision ;
- mettre à jour les responsabilités et dépendances ;
- distinguer **réalisé**, **en cours**, **planifié**, **exploratoire**, **bloqué**, **abandonné** et **à confirmer** ;
- ne jamais déclarer une capacité terminée sans confirmation explicite ou preuve vérifiable ;
- conserver l'historique des décisions importantes ;
- corriger les informations obsolètes au lieu de les juxtaposer ;
- vérifier la cohérence avec la roadmap MosaiX ;
- ne pas transformer automatiquement chaque idée en engagement de réalisation.

### Règle de dépendance

La roadmap IJIDeals dépend de MosaiX pour les fondations techniques. Lorsqu'une évolution touche le runtime, le SDK, les BAC, les capacités ou le système de plugins, il faut vérifier si la roadmap MosaiX doit également être mise à jour.

Inversement, une évolution métier IJIDeals peut révéler un besoin générique à remonter dans MosaiX, mais il ne faut pas généraliser prématurément une exigence propre à IJIDeals.

---

**Document vivant — version initiale : 1.0 — 8 novembre 2026**

**Principe final :** IJIDeals doit donner aux utilisateurs une expérience simple et cohérente, alors que MosaiX absorbe la complexité de composition, de sécurité, d'intégration et d'exécution. L'écosystème doit grandir par des applications utiles et des domaines bien séparés, pas par une accumulation de fonctionnalités sans frontières.
