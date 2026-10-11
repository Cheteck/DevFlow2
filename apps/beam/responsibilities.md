# Responsabilités — app beam

| Champ | Valeur |
| --- | --- |
| Nom | `@apps/beam` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Messagerie temps réel |
| Nature | Messagerie privée, directe et de groupe |
| Référence fonctionnelle | Facebook Messenger — sans dépendance à son architecture interne |
| Source de vérité | Beam pour toutes les données et règles métier de messagerie |

## 1. Raison d'être

Beam est le service de messagerie privée de MosaiX. Il permet aux utilisateurs d'échanger des messages individuels ou collectifs, de partager des pièces jointes, de suivre l'activité des participants et de retrouver leurs conversations.

Beam s'inspire des fonctionnalités éprouvées de Facebook Messenger : conversations persistantes, synchronisation multi-appareils, indicateurs de livraison et de lecture, présence, saisie en cours, réponses contextuelles et échanges de médias.

Ces fonctionnalités doivent rester compatibles avec l'architecture MosaiX : capacités explicites, événements versionnés, isolation par tenant, autorisations systématiques et communication inter-applications par contrats.

**Principe directeur : Beam possède le cycle de vie des conversations et des messages. Il ne possède ni l'identité centrale des utilisateurs, ni le stockage physique des fichiers, ni la distribution transverse des notifications produit.**

## 2. Responsabilités fonctionnelles

### 2.1 Conversations

- Créer et gérer des conversations directes et de groupe.
- Garantir l'unicité logique d'une conversation directe selon les règles métier définies.
- Gérer les participants, leurs rôles, leurs droits et leur cycle de participation.
- Permettre l'ajout et le retrait de participants selon les permissions.
- Gérer le nom, l'avatar, les préférences et les métadonnées d'un groupe.
- Prendre en charge l'archivage, la mise en sourdine, l'épinglage et le masquage d'une conversation, selon leur portée fonctionnelle.
- Distinguer la suppression locale d'une conversation de la suppression effective des messages.
- Garantir qu'un utilisateur ne peut consulter que les conversations auxquelles il est autorisé à accéder.

### 2.2 Cycle de vie des messages

- Envoyer et recevoir des messages texte.
- Prendre en charge les réponses à un message, les modifications et les suppressions selon une politique explicite.
- Gérer les messages système propres à une conversation : arrivée ou départ d'un participant, modification des paramètres du groupe et autres événements conversationnels.
- Préserver l'ordre logique des messages dans une conversation.
- Assurer l'idempotence des commandes d'envoi afin d'éviter les doublons lors des reprises réseau.
- Distinguer l'état de traitement côté serveur de l'état de réception côté destinataire.
- Permettre la pagination par curseur et le chargement progressif de l'historique.
- Gérer les états d'échec et de reprise d'envoi sans créer de doublons.

Un message peut être associé à une réponse, une pièce jointe ou des métadonnées typées. Son contenu et son historique ne doivent jamais dépendre de l'état temporaire de l'interface.

### 2.3 Livraison et lecture

Beam distingue les états suivants :

- `pending` — En attente : le client n'a pas encore obtenu de confirmation du serveur.
- `accepted` — Accepté : le serveur a validé et persisté le message.
- `delivered` — Livré : le message a été reçu par un ou plusieurs appareils destinataires, selon la politique retenue.
- `read` — Lu : un participant a déclaré avoir consulté le message.
- `failed` — Échec : l'envoi n'a pas abouti et peut nécessiter une reprise.

Règles :

- Les transitions autorisées doivent être explicites et idempotentes.
- Une confirmation de lecture ne peut être enregistrée qu'au nom d'un participant autorisé.
- Pour les groupes, Beam doit définir si les accusés sont agrégés ou individualisés, comment ils sont synchronisés entre appareils et quelles informations sont exposées aux autres participants.

Les états de livraison et de lecture sont des données métier. Ils ne doivent pas être confondus avec une notification push.

### 2.4 Temps réel et synchronisation

- Distribuer les événements de conversation aux clients autorisés.
- Synchroniser les nouveaux messages, modifications, suppressions et changements de participation.
- Prendre en charge la reconnexion après une interruption réseau.
- Permettre la récupération des événements manqués à partir d'un curseur ou d'une version de synchronisation.
- Dédupliquer les événements rejoués.
- Préserver l'ordre logique par conversation sans supposer un ordre global entre toutes les conversations.
- Gérer les sessions et appareils multiples sans dépendre d'une connexion unique.
- Séparer l'état durable des messages des signaux éphémères tels que la saisie en cours.

La livraison temps réel est une optimisation de l'expérience. La persistance et la synchronisation doivent permettre de retrouver l'état correct même si un client était hors ligne.

### 2.5 Présence et activité

- Exposer la présence disponible lorsque les règles de confidentialité l'autorisent.
- Gérer les états en ligne, hors ligne et, si nécessaire, la dernière activité connue.
- Diffuser les indicateurs de saisie en cours avec une durée de vie limitée.
- Éviter de persister inutilement les signaux éphémères.
- Ne pas assimiler une connexion active à une disponibilité réelle de l'utilisateur.
- Appliquer les restrictions de visibilité et les règles de confidentialité propres au tenant et à l'utilisateur.

La présence constitue un indicateur best-effort : elle ne doit jamais servir de preuve d'identité, d'autorisation ou de livraison d'un message.

### 2.6 Pièces jointes et médias

- Associer des pièces jointes aux messages via des références opaques.
- Déléguer le stockage physique, l'upload et le téléchargement à `StoragePort`.
- Prendre en charge les uploads fragmentés lorsque l'adapter le permet.
- Contrôler les types de médias, les tailles, les permissions et l'état de disponibilité des fichiers.
- Éviter d'exposer des chemins internes, des secrets ou des URL d'accès permanentes.
- Permettre la révocation de l'accès à une pièce jointe selon les règles de conversation et de conservation.
- Prendre en compte le chiffrement de bout en bout lorsque les pièces jointes sont couvertes par ce mécanisme.

Beam conserve les métadonnées métier et les références de stockage, pas les fichiers binaires eux-mêmes.

### 2.7 Recherche et navigation

- Rechercher les conversations accessibles à l'utilisateur.
- Rechercher les messages selon les capacités autorisées par le modèle de chiffrement.
- Filtrer ou retrouver les conversations par participant, période et autres critères pris en charge.
- Utiliser la pagination par curseur pour les historiques volumineux.
- Appliquer les mêmes règles d'autorisation aux résultats, aux extraits et aux métadonnées.
- Ne pas prétendre effectuer une recherche en clair sur des messages chiffrés de bout en bout si le serveur ne dispose pas du contenu déchiffré.

### 2.8 Chiffrement et sécurité des échanges

- Encadrer la gestion des clés et les opérations cryptographiques nécessaires aux échanges chiffrés.
- Utiliser des mécanismes cryptographiques éprouvés et des formats de messages versionnés.
- Définir les responsabilités des clients et du serveur dans l'établissement des clés, leur renouvellement et la gestion des appareils.
- Ne jamais exposer de clé privée ni de secret cryptographique dans les réponses API, les journaux ou les événements.
- Prévoir les conséquences du changement d'appareil, de la révocation d'accès et de la perte de clés.
- Vérifier les autorisations avant toute opération de consultation, de modification, de suppression ou de téléchargement.

La présence d'ECDH et d'AES-GCM ne suffit pas, à elle seule, à garantir un chiffrement de bout en bout complet. Le protocole doit aussi spécifier l'authentification des clés, leur rotation, la gestion des appareils et les propriétés de sécurité attendues.

### 2.9 Commandes et automatisation

- Exécuter les commandes métier explicitement autorisées dans une conversation.
- Valider les paramètres, les permissions et le contexte avant toute exécution.
- Isoler les commandes des messages ordinaires.
- Éviter toute exécution implicite de contenu fourni par un utilisateur.
- Émettre des résultats et des événements structurés, versionnés et audités lorsque nécessaire.

## 3. Architecture et responsabilités techniques

Beam respecte les conventions canoniques des applications MosaiX :

- `mosaix.json` : manifeste et métadonnées de l'application.
- `src/index.ts` : `MANIFEST`, `ServiceProvider`, factory `create*App` et réexports du domaine.
- `domain/` : entités, objets-valeurs, règles métier et invariants purs.
- `application/` : commandes, requêtes, handlers CQRS, capabilities et événements.
- `infrastructure/` : controllers, repositories, adaptateurs et intégrations via ports.
- `presentation/` : contrats et éléments de présentation propres à l'application.
- `frontend/src/index.ts` : contribution des slots UI de Beam.

Les controllers doivent utiliser `Guard.authorize` et déléguer les règles métier à la couche applicative. Les repositories doivent privilégier la persistance durable dès qu'un adapter est fourni.

### Initialisation

Au démarrage, Beam doit :

- Enregistrer ses capabilities versionnées via `provideCapability`.
- Enregistrer ses schémas d'événements via `registerEventSchema`.
- Construire ses services dans le conteneur enfant du tenant.
- Vérifier la disponibilité des ports requis et appliquer les politiques de repli documentées.
- Exposer les routes et les slots UI conformément aux contrats de l'application.

### Persistance

- `DatabasePort` est la voie prioritaire de persistance.
- Le stockage en mémoire n'est autorisé qu'en l'absence d'adapter et dans les contextes compatibles avec cette limitation.
- Une instance utilisant le stockage en mémoire ne doit pas être présentée comme offrant une persistance durable.
- Les données d'une conversation doivent respecter les frontières de tenant.
- Les écritures critiques doivent éviter les doubles envois et les états partiellement validés.
- La publication d'événements après une écriture durable doit être fiable ou récupérable, notamment en cas d'interruption entre persistance et publication.

## 4. Capabilities et événements

Les opérations inter-applications passent exclusivement par des capabilities et des événements contractuels. Aucun import direct d'une autre application BAC n'est autorisé.

### Capabilities principales

Les capabilities existantes doivent être versionnées et accompagnées de schémas d'entrée et de sortie validables.

- `beam.conversation.create` — création d'une conversation.
- `beam.message.send` — envoi d'un message.
- `beam.conversation.read` — consultation autorisée d'une conversation.
- `beam.message.history` — récupération paginée de l'historique.
- `beam.message.edit` — modification autorisée d'un message, si activée.
- `beam.message.delete` — suppression selon la politique de conservation.
- `beam.receipt.update` — mise à jour d'un accusé de livraison ou de lecture.
- `beam.presence.read` — consultation autorisée de la présence.
- `beam.attachment.create` — association d'une pièce jointe.
- `beam.search.query` — recherche dans les données accessibles.

Cette liste décrit la cible fonctionnelle : toute capability supplémentaire doit être justifiée, versionnée et enregistrée au démarrage. Les noms définitifs doivent rester cohérents avec les conventions du dépôt.

### Événements métier

Exemples de contrats à formaliser selon les capacités réellement implémentées :

- `beam.conversation.created`
- `beam.conversation.updated`
- `beam.conversation.participant.added`
- `beam.conversation.participant.removed`
- `beam.message.accepted`
- `beam.message.updated`
- `beam.message.deleted`
- `beam.message.delivered`
- `beam.message.read`
- `beam.presence.changed`

Chaque événement doit définir une version de schéma, un identifiant unique, un horodatage, le tenant concerné et les références métier nécessaires. Les événements ne doivent contenir ni secret ni données privées superflues.

Les événements de saisie et certains signaux de présence peuvent être éphémères. Ils ne doivent pas être assimilés à des événements métier durables.

## 5. Interactions et dépendances

Beam s'exécute sur `RuntimeKernel` au moyen d'un conteneur enfant isolé par tenant.

- Communication inter-applications exclusivement via capabilities et événements.
- Accès aux données externes exclusivement via ports et adapters.
- Participants référencés par identifiants opaques fournis par Citadelle.
- Pièces jointes gérées par `StoragePort`.
- Événements techniques et mécanismes de transport fournis par l'infrastructure MosaiX.
- Aucune dépendance directe au stockage interne, au gateway ou aux repositories d'une autre application.

L'isolation par tenant doit s'appliquer aux commandes, aux requêtes, aux abonnements temps réel, aux événements rejoués et aux références de pièces jointes.

## 6. Données possédées — source de vérité

Beam est responsable du cycle de vie et de l'intégrité de ses données :

- Conversations directes et de groupe.
- Participants, rôles et paramètres de participation.
- Messages et métadonnées conversationnelles.
- Réponses, modifications et suppressions de messages.
- Accusés de livraison et de lecture.
- Préférences de conversation : archivage, sourdine et épinglage, si prises en charge.
- Références et métadonnées des pièces jointes.
- État de synchronisation et clés de déduplication nécessaires au fonctionnement.
- Présence et activité, selon la stratégie de stockage retenue.
- Index de recherche autorisés par le modèle de chiffrement.
- Métadonnées nécessaires au chiffrement, sans exposition des secrets.
- Commandes de bot et leurs résultats, si cette fonctionnalité est activée.

### Références externes — par ID, jamais de jointure

- Identité et participants : Citadelle, par identifiants opaques.
- Fichiers et médias : `StoragePort`.
- Transport et distribution des événements : infrastructure MosaiX.
- Notifications produit : service Notifications, une fois sa frontière contractuelle disponible.

Les références externes ne donnent pas le droit de lire directement les bases de données des applications concernées.

## 7. Frontières et invariants — ADR-0016

### 7.1 Périmètre strict

Beam est une messagerie privée, et non un flux social.

Il ne doit pas :

- Reproduire les responsabilités de Solara, notamment le feed social.
- Devenir un service de notifications système génériques.
- Implémenter un bus métier transversal.
- Contourner les contracts de MosaiX ou les capabilities des autres applications.
- Fournir un accès à une conversation sans autorisation explicite.

### 7.2 Notifications produit — BOUND-04

Cible : Beam ne distribue pas les notifications produit.

Beam peut émettre les événements métier nécessaires à l'observation d'un message ou d'une conversation. Un service Notifications distinct est responsable de la politique de notification produit, de ses canaux et de sa distribution.

## Écarts cible-vs-réel

- [ ] **Écart (cible vs réel)** : tables `beam_notifications` + `beam_push_subscriptions` — la notification transverse est absorbée. Geler toute extension notif ici ; extraction vers Notifications (BOUND-04).
  - Geler toute extension de `beam_notifications` et `beam_push_subscriptions`.
  - Identifier les responsabilités et dépendances actuellement portées par ces tables.
  - Définir un contrat de migration vers le service Notifications.
  - Préserver la compatibilité pendant la transition.
  - Retirer les responsabilités transverses de Beam lorsque le service cible est opérationnel.

La migration ne doit pas supprimer les accusés de lecture ou les états de livraison des messages : ceux-ci relèvent du domaine de messagerie et restent distincts des notifications push.

## 8. Frontières

- Aucun import depuis une autre app.
- Aucun accès infra direct hors ports.
- Aucune route sans autorisation.
- Aucun accès à un message sur la seule base de son identifiant : l'appartenance à la conversation et les permissions doivent être vérifiées.
- Aucun accès inter-tenant, y compris via les recherches, les accusés, les événements ou les fichiers.
- Aucun secret, jeton d'accès ou clé privée dans les réponses API, les journaux ou les événements.
- Validation systématique des entrées et des transitions d'état.
- Limitation de débit et protections contre les abus sur les opérations sensibles.
- Contrôle de taille, de type et d'accès pour les pièces jointes.
- Politique explicite de conservation, de suppression et de purge RGPD.
- Protection contre la réutilisation de commandes et la répétition de messages déjà acceptés.

## 9. Non-responsabilités

Beam ne :

- Réimplémente pas `RuntimeKernel`, le gateway ou les adapters.
- Gère pas la source de vérité de l'identité.
- Stocke pas les fichiers binaires en remplacement de `StoragePort`.
- Distribue pas les notifications produit transverses.
- Remplace pas Solara ou un autre flux social.
- Garantit pas une présence exacte ou continue de tous les utilisateurs.
- Présente pas le stockage en mémoire comme une persistance durable.
- Prétend pas assurer le chiffrement de bout en bout sans protocole complet et vérifiable.
- N'expose pas de secret.

## 10. Critères de santé

### Architecture

- [ ] Conforme à `pnpm check:conformance`.
- [ ] Conforme à `pnpm check:manifests`.
- [ ] Les capabilities et schémas d'événements sont versionnés et enregistrés au démarrage.
- [ ] Aucun import direct inter-applications.
- [ ] Les contrôles `Guard.authorize` couvrent toutes les routes concernées.
- [ ] Les tests valident l'isolation des tenants.

### Fonctionnel

- [ ] Création et gestion des conversations directes et de groupe.
- [ ] Envoi idempotent et persistance durable des messages.
- [ ] Pagination stable et reprise après déconnexion.
- [ ] Transitions de livraison et de lecture cohérentes.
- [ ] Gestion des modifications, suppressions et réponses selon la politique définie.
- [ ] Gestion autorisée des pièces jointes.
- [ ] Synchronisation multi-appareils testée.
- [ ] Présence et saisie en cours traitées comme des signaux distincts.
- [ ] Recherche conforme aux restrictions du modèle de chiffrement.

### Sécurité et données

- [ ] Tests de domaine verts (`*.test.ts`).
- [ ] Tests d'autorisation négatifs et anti-fuite inter-tenant.
- [ ] Tests de déduplication, de reconnexion et de rejeu d'événements.
- [ ] Politique de rétention et purge RGPD vérifiées.
- [ ] Absence de secrets dans les logs, événements et réponses.
- [ ] Modèle cryptographique documenté et testé si le chiffrement de bout en bout est activé.

### API et exploitation

- [ ] OpenAPI généré sans erreur.
- [ ] Contrats d'événements validés.
- [ ] Erreurs métier documentées et stables.
- [ ] Comportement sans adapter explicitement documenté.
- [ ] Les métriques distinguent les messages acceptés, livrés, lus et en échec.
- [ ] Les tables de notifications existantes disposent d'un plan de migration conforme à BOUND-04.

## 11. Principe final

Beam doit offrir une expérience de messagerie aussi fluide et fiable que les références du marché, sans sacrifier les garanties structurelles de MosaiX.

La conversation et le message appartiennent à Beam. L'identité appartient à Citadelle. Le fichier appartient au stockage. La notification produit appartient au service Notifications. Le kernel orchestre l'ensemble sans absorber leurs responsabilités.
