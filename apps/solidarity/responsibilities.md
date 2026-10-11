# Responsabilités — app Solidarity

| Champ | Valeur |
|---|---|
| Nom | `@apps/solidarity` |
| Version | Voir package.json |
| Couche | Application BAC (Layer 7) — Coordination de crise et opérations de solidarité |
| Nature | Gestion des incidents, besoins humanitaires, ressources et opérations terrain |
| Référence fonctionnelle | Plateformes de coordination humanitaire, gestion de crise et logistique de distribution |
| Source de vérité | Solidarity pour le cycle opérationnel de solidarité |

## 1. Raison d'être

Solidarity est le système opérationnel de coordination de l'aide au sein de MosaiX. Il transforme des signalements de crise en besoins qualifiés, mobilise des ressources, coordonne les intervenants et suit les opérations jusqu'à la confirmation de la distribution.

L'application couvre le cycle complet :

Signalement → Qualification → Évaluation des besoins → Mobilisation des ressources → Affectation → Mission terrain → Distribution → Confirmation → Clôture et bilan.

Solidarity doit fonctionner dans des environnements dégradés : connectivité intermittente, ressources limitées, informations incomplètes, intervenants multiples et situations évoluant rapidement.

Il doit garantir la traçabilité des opérations, limiter l'exposition des données des bénéficiaires et rendre les états opérationnels suffisamment fiables pour soutenir la prise de décision.

Solidarity constitue la source de vérité des opérations de solidarité dans MosaiX. Il ne remplace ni les systèmes nationaux d'alerte, ni l'identité, ni les paiements, ni les autorités responsables de la gestion des crises.

> **Principe central : un besoin n'est pas résolu lorsqu'un don est promis, mais lorsque la quantité nécessaire a été effectivement fournie, ou que le besoin a été explicitement clôturé pour une raison documentée.** De même, un bénévole n'est pas une capacité mobilisable du seul fait de son inscription : seule une disponibilité confirmée, qualifiée et acceptée engage.

## 2. Responsabilités fonctionnelles

### 2.1 Incidents et signalements

- Enregistrer les signalements provenant des utilisateurs, des équipes terrain et des sources autorisées.
- Gérer les catégories d'incidents, leur localisation, leur gravité estimée et leur état de traitement.
- Distinguer un signalement brut d'un incident qualifié et confirmé.
- Permettre le rapprochement de signalements concernant un même événement sans supprimer leur provenance.
- Enregistrer les évaluations, les changements de statut et les décisions opérationnelles.
- Gérer les niveaux de priorité et les escalades selon des règles explicites.
- Conserver la provenance, l'horodatage et le niveau de confiance des informations.
- Permettre la clôture, la réouverture et la correction d'un incident selon les autorisations définies.

Les signalements constituent des observations. Ils ne doivent pas être présentés comme des faits confirmés tant qu'une procédure de qualification ne l'a pas établi.

Règle de déduplication : un **signalement** (`NeedReport`) est une observation d'une source ; un **besoin opérationnel** (`Need`) est la demande consolidée sur laquelle les équipes travaillent. Trois signalements de 500 L d'eau ne valent pas automatiquement 1 500 L. Le rapprochement considère localisation, catégorie, période, population et provenance. La fusion ne supprime jamais les signalements originaux (lien `reportIds` conservé) ; en cas de contradiction, elle propose une vérification au lieu de fusionner automatiquement.

### 2.2 Besoins et demandes d'aide

- Enregistrer les besoins exprimés ou identifiés sur le terrain.
- Catégoriser les besoins : eau, alimentation, hébergement, soins, transport, équipement, protection ou autres catégories configurées.
- Définir les quantités, unités, niveaux de priorité, délais et zones de couverture.
- Associer les besoins à un incident, une zone opérationnelle ou une opération de secours.
- Gérer le cycle de vie d'un besoin : déclaré, à qualifier, validé, recherché, partiellement couvert, couvert, livré, annulé ou expiré — avec retours arrière possibles (réouverture, réévaluation, invalidation).
- Distinguer les quantités demandées, engagées, affectées, expédiées, distribuées et restant à couvrir.
- Détecter les besoins en double et les risques de surallocation.
- Conserver l'historique des décisions de validation et des changements de quantité.

La couverture d'un besoin ne doit jamais être déduite uniquement de l'existence d'un don ou d'une mission. Elle doit s'appuyer sur des engagements et des distributions traçables.

**Compteurs obligatoires par `Need` (même unité, catégorie homogène) :**

- **Demandé** : quantité du besoin validé.
- **Réservé** : quantité affectée (`NeedAllocation` confirmée, non encore expédiée).
- **Expédié** : quantité partie (`Shipment` en cours / arrivé, non encore distribué).
- **Distribué** : quantité dont la remise est confirmée (`Distribution`). Seul compteur qui réduit le besoin.
- **Restant** : `demandé − distribué ± ajustements validés`. Jamais négatif sans correction explicite.

Exemple pédagogique (fictif) : besoin validé de **1 000 L**, **200 L** distribués et confirmés → couverture confirmée **20 %**, restant **800 L**. Si 500 L sont promis et 300 L en transit, la couverture affichée reste **20 %**. Interdit d'additionner des unités incompatibles (1 L d'eau ≠ 1 unité de médicament).

**Fraîcheur :** chaque `Need` porte `reportedAt`, `verifiedAt`, `updatedAt`, `reviewDueAt`, `expiresAt`. Distinguer **expiré**, **non vérifié récemment** et **satisfait**. Délais configurables par catégorie × priorité, jamais codés en dur. Un besoin expiré est marqué, réévalué ou clôturé avec motif — jamais supprimé silencieusement.

**Priorisation explicable (pas de score opaque) :** trois dimensions non fusionnées naïvement — (1) gravité humanitaire (conséquence de l'absence d'aide), (2) déficit opérationnel (quantité manquante réelle + horizon), (3) confiance dans l'information (source, corroboration, fraîcheur). Critères ordonnés et seuils documentés : urgence vitale ; délai avant rupture ; population concernée (sans écraser les petits groupes en danger grave) ; déficit réel ; vulnérabilité et isolement ; fiabilité et fraîcheur. Un signal potentiellement vital mais non vérifié **déclenche une vérification urgente**, il ne disparaît pas du classement. Le score n'ordonne que les besoins comparables ; toute dérogation humaine est justifiée et tracée (`NeedAssessment`).

### 2.3 Dons et contributions

- Enregistrer les intentions de don en nature, les offres de ressources et les engagements des contributeurs.
- Qualifier les ressources selon leur type, quantité, unité, état, disponibilité, localisation et contraintes d'utilisation.
- Gérer l'acceptation, le refus, la réservation, l'affectation et l'annulation d'une contribution.
- Associer les contributions aux besoins qu'elles peuvent couvrir.
- Suivre la réception physique, le contrôle, le stockage et la distribution des dons en nature.
- Prévenir les doubles affectations d'une même ressource disponible.
- Distinguer une intention, un engagement, une ressource effectivement reçue et une ressource distribuée.
- Préserver la traçabilité du contributeur par une référence opaque lorsque son identité complète n'est pas nécessaire au processus.

Les dons financiers restent hors du périmètre transactionnel de Solidarity. L'application peut enregistrer une intention ou une référence métier, mais elle ne confirme ni ne traite un paiement.

Cycle d'intention : `ResourceOffer` (promesse) ≠ `ResourceStock` (physique) ≠ `NeedAllocation` (affectation) ≠ `Distribution` (remise). Aucun compteur de couverture ne prend en compte une offre ou une allocation proposée.

### 2.4 Hubs, entrepôts et stocks

- Gérer les hubs logistiques, points de collecte, entrepôts et lieux de distribution.
- Définir les capacités, zones desservies, horaires opérationnels et contraintes de stockage.
- Suivre les entrées, sorties, réservations, transferts, pertes et ajustements de stock.
- Distinguer le stock physique, le stock réservé, le stock disponible et le stock inutilisable.
- Tracer les mouvements de ressources entre les lieux autorisés.
- Associer les stocks à des lots ou références logistiques lorsque nécessaire.
- Détecter les stocks insuffisants, les dépassements de capacité et les risques de rupture.
- Maintenir un historique auditable des mouvements et de leurs auteurs.

Les mouvements de stock doivent être cohérents et idempotents. Une livraison ou un transfert rejoué ne doit pas créer de stock supplémentaire ni provoquer une double sortie. Une allocation confirmée réserve le stock source ; le disponible ne peut pas être sur-alloué (protection concurrence via persistance, pas simple vérification applicative).

### 2.5 Missions et coordination terrain

- Créer des missions à partir de besoins validés ou d'objectifs opérationnels autorisés.
- Affecter des bénévoles, équipes, ressources et moyens logistiques.
- Définir les étapes, checklists, prérequis, responsabilités et fenêtres temporelles.
- Gérer les états de mission : planifiée, affectée, acceptée, en cours, suspendue, terminée, annulée ou en échec.
- Enregistrer les changements d'affectation et les motifs d'annulation.
- Gérer les confirmations de départ, d'arrivée, de prise en charge et de fin de mission lorsque le scénario le requiert.
- Permettre la remontée de preuves opérationnelles adaptées au contexte et aux exigences de confidentialité.
- Signaler les retards, les blocages et les missions nécessitant une intervention.
- Préserver l'historique des actions même lorsque plusieurs équipes se relaient.

Une mission terminée ne signifie pas automatiquement qu'un besoin est intégralement couvert. La confirmation de distribution reste un processus métier distinct.

### 2.6 Bénévoles et intervenants

Solidarity gère la **capacité opérationnelle** : qui peut intervenir, où, quand, avec quelles compétences, sous quelle responsabilité et dans quelles conditions de sécurité. Pas un simple annuaire.

- Référencer les acteurs à partir des identifiants fournis par Citadelle ou Spaces, selon les contrats disponibles.
- Gérer les affectations opérationnelles, disponibilités déclarées, compétences nécessaires et rôles de mission.
- Vérifier les prérequis avant l'affectation à une mission.
- Gérer les acceptations, refus, remplacements et désistements.
- Limiter la visibilité des informations personnelles au strict nécessaire.
- Conserver les traces des actions sensibles et des décisions d'affectation.

Solidarity ne devient pas la source de vérité de l'identité, des comptes ou des profils généraux des intervenants.

**Cycle de vie :** inscription (référencement + consentement) → qualification (compétences, langues, disponibilités, prérequis) → activation (vérification proportionnée, briefing, règles de sécurité) → disponibilité (créneaux, zones, déplacement, dernière confirmation) → affectation (proposition, acceptation explicite, anti-doubles) → intervention (briefing, `MissionCheckIn` départ/arrivée/étapes, incidents) → clôture (matériel restitué, `VolunteerDebrief`) → suivi (repos, retour d'expérience, soutien). Distinguer statut général (`actif` mais `en repos` possible) et statut sur mission.

**Profil minimal utile :** référence opaque ; compétences (déclarées vs vérifiées + échéances : logistique, secours, conduite, inventaire, évaluation, soutien psychosocial) ; disponibilités + dernière confirmation ; mobilité (zones, transport) ; capacités (personnes, équipement, véhicule) ; sécurité (briefings, restrictions, prérequis) ; engagement (en cours, historique pour charge/repos) ; contact opérationnel autorisé + secours. Interdits : pièces d'identité, coordonnées privées recopiées, données de santé détaillées. Une restriction médicale devient une **restriction opérationnelle** (`apte / restreint / inapte à tel type`), sans diagnostic.

**Matching bénévoles ↔ missions :** le moteur propose, le responsable autorisé confirme, le bénévole accepte ou refuse. Critères **obligatoires** (éliminatoires) : disponibilité créneau, compétences/qualifications requises, prérequis sécurité, charge maximale, restrictions opérationnelles, absence d'affectation incompatible. Critères **d'optimisation** (explicables) : adéquation compétences-mission, connaissance terrain, distance/durée (**jamais dominante** : un proche non qualifié ne passe pas devant un apte sur tâche critique), transport/équipement, équilibre des charges, continuité d'équipe. Chaque proposition expose son motif.

**Équipes (`VolunteerTeam`) :** identifiant, responsable, membres + rôles, compétences collectives, capacité, disponibilité, équipements/véhicules, historique. Réutilisables sans valoir disponibilité permanente : reconfirmation par membre et par mission.

**Statuts indépendants :** bénévole (`inscription incomplète / en attente / actif / indisponible temporaire / suspendu / inactif`) ; disponibilité (`disponible / à confirmer / affecté / en intervention / en repos / indisponible`) ; affectation (`proposée / acceptée / refusée / annulée / en cours / terminée / absence constatée / compte rendu en attente`). Une affectation annulée ne suspend pas le compte.

**Sécurité (invariant) :** pas d'affectation sans prérequis/briefing requis ; consignes + contact d'urgence + départ/destination/responsable définis ; validation transport/équipements ; suivi heures et rappels de repos ; mission suspendable en cas de danger ; incident via `VolunteerIncident` (accès restreint) ; jamais d'assimilation à un secouriste professionnel sur simple inscription ; lutte incendie, évacuation dangereuse et secours spécialisés **réservés aux habilités**, coordonnés par les services compétents. Pas de GPS continu par défaut ; une position n'est jamais présentée comme actuelle sans sa date.

### 2.7 Distributions et confirmation de réception

- Enregistrer les distributions effectuées à partir de ressources affectées à un besoin.
- Tracer les quantités prévues, préparées, remises, refusées, perdues ou restant à distribuer.
- Associer chaque opération à une mission, un besoin, un lieu et un identifiant de bénéficiaire pseudonymisé lorsque nécessaire.
- Permettre la confirmation par un intervenant autorisé ou par un mécanisme de validation adapté au contexte.
- Gérer les confirmations différées lorsque la connexion est indisponible.
- Prévenir les doublons de distribution dus aux répétitions de requêtes ou à la synchronisation hors ligne.
- Enregistrer les écarts entre quantités prévues et quantités réellement distribuées.
- Permettre les corrections explicites et auditées plutôt que l'altération silencieuse de l'historique.

La preuve de distribution doit être proportionnée au risque et au contexte. La collecte d'une signature, d'une photographie ou d'une géolocalisation ne doit jamais être systématique si une preuve moins intrusive suffit.

### 2.8 Matching géospatial et allocation des ressources

- Identifier les besoins et ressources compatibles selon leur type, quantité, priorité, disponibilité et localisation.
- Utiliser la distance géographique, notamment Haversine, comme un critère de classement parmi d'autres.
- Prendre en compte les capacités des hubs, les délais, les contraintes de transport et les zones opérationnelles.
- Proposer des affectations et rendre explicites les critères de classement.
- Distinguer une recommandation automatique d'une affectation effectivement validée.
- Permettre la validation ou la modification humaine des décisions sensibles.
- Éviter les allocations concurrentes incompatibles sur une même ressource.
- Recalculer les propositions lorsque les stocks, les besoins ou les conditions opérationnelles changent.

La distance à vol d'oiseau n'est pas une estimation suffisante du temps de trajet ni de l'accessibilité réelle. Le matching doit pouvoir intégrer des contraintes de terrain sans supposer qu'un service de calcul d'itinéraire est toujours disponible.

Trois états strictement distincts : **suggestion** (réversible, sans effet stock) → **allocation confirmée** (opérateur autorisé, réserve le stock) → **livraison confirmée** (seul effet sur le compteur `distribué`).

### 2.9 Fonctionnement hors ligne et synchronisation

- Permettre la consultation des données opérationnelles explicitement mises en cache pour une mission ou une zone.
- Mettre en file les actions autorisées réalisées hors connexion.
- Attribuer un identifiant stable à chaque opération locale.
- Synchroniser les opérations dès que la connectivité est rétablie.
- Dédupliquer les soumissions et rejouer les opérations de manière sûre.
- Détecter les conflits de modification et appliquer une politique explicite de résolution.
- Préserver la provenance, l'heure locale de saisie et l'heure de réception serveur.
- Ne pas considérer l'horloge d'un appareil comme une source temporelle faisant autorité.
- Exposer les états de synchronisation : en attente, synchronisé, en conflit, rejeté ou nécessitant une intervention.

Les conflits sur les stocks, les affectations et les distributions doivent être résolus par des règles métier contrôlées. Une stratégie générique de type « dernière écriture gagnante » ne suffit pas. Côté bénévoles : mission, consignes, checklist et contacts synchronisés consultables ; départ/arrivée/étapes, obstacles, incidents et distributions enregistrables localement puis réautorisés serveur.

### 2.10 Traçabilité et intégrité des opérations

- Maintenir un historique des changements métier importants.
- Relier les signalements, besoins, engagements, mouvements de stock, missions et distributions.
- Enregistrer l'acteur, le contexte, l'horodatage serveur et la référence de l'opération.
- Utiliser une structure de Merkle lorsque des preuves d'intégrité vérifiables sont nécessaires.
- Permettre la vérification de la cohérence d'un ensemble de preuves sans exposer davantage de données personnelles que nécessaire.
- Documenter la stratégie de canonicalisation, de hachage, de construction de l'arbre et de vérification des preuves.
- Définir explicitement le périmètre couvert par chaque racine ou preuve d'intégrité.
- Distinguer l'intégrité cryptographique des données de leur véracité factuelle.

Un arbre de Merkle peut démontrer que des données correspondent à un ensemble engagé, mais ne prouve pas, à lui seul, qu'une distribution a réellement eu lieu ou que les informations enregistrées sont vraies.

### 2.11 Rapports humanitaires et interopérabilité

- Produire des rapports opérationnels sur les incidents, les besoins, les ressources et les distributions.
- Exporter les données nécessaires aux formats humanitaires pris en charge, notamment HXL lorsque le contrat le prévoit.
- Faciliter les agrégations compatibles avec les besoins de reporting OCHA.
- Définir des correspondances explicites entre le modèle interne et les champs des formats externes.
- Distinguer les données brutes, les données qualifiées et les agrégats publiables.
- Appliquer des règles de minimisation, de pseudonymisation et de contrôle d'accès aux exports.
- Versionner les schémas d'export et préserver la traçabilité de leur génération.
- Ne pas prétendre qu'un export est officiellement conforme sans validation du schéma, des règles de qualité et du profil d'interopérabilité concerné.

Les rapports ne doivent pas exposer les identités des bénéficiaires ni les localisations sensibles lorsque ces informations ne sont pas nécessaires.

## 3. Architecture et responsabilités techniques

Solidarity respecte les conventions canoniques des applications MosaiX :

- `mosaix.json` : manifeste et métadonnées de l'application.
- `src/index.ts` : MANIFEST, ServiceProvider, factory `create*App` et réexports du domaine.
- `domain/` : entités, objets-valeurs, règles métier et invariants purs.
- `application/` : commandes, requêtes, handlers CQRS, capabilities et événements.
- `infrastructure/` : controllers, repositories et adapters via ports.
- `presentation/` : contrats et éléments de présentation.
- `frontend/src/index.ts` : contribution des slots UI de Solidarity.

Les règles métier relatives à l'allocation des ressources, aux stocks, aux missions et aux distributions doivent être indépendantes des frameworks, du transport et des détails de persistance.

### Initialisation

Au démarrage, Solidarity doit :

- Enregistrer ses capabilities versionnées via `provideCapability`.
- Enregistrer ses schémas d'événements via `registerEventSchema`.
- Construire ses services dans le conteneur enfant du tenant.
- Vérifier les ports requis et documenter les capacités disponibles en mode dégradé.
- Exposer uniquement les routes et slots UI autorisés par ses contrats.

### Persistance

- DatabasePort est prioritaire pour toute persistance métier durable.
- Le stockage en mémoire n'est autorisé qu'en l'absence d'adapter et dans les contextes explicitement compatibles.
- Le mode mémoire ne doit pas être présenté comme une source de vérité durable pour les opérations de terrain.
- Les écritures critiques doivent être transactionnelles lorsque le port le permet.
- Les mouvements de stock, réservations et confirmations de distribution doivent disposer de garanties contre les doubles exécutions.
- La publication d'événements après écriture doit être fiable ou récupérable, notamment en cas d'interruption.
- Les files hors ligne ne doivent pas être confondues avec un journal durable côté serveur.

## 4. Capabilities et événements

Les capacités inter-applications doivent être explicites, versionnées, autorisées et accompagnées de schémas validables.

### Capabilities principales

Les noms ci-dessous décrivent une cible fonctionnelle à confronter aux contrats réellement présents dans le dépôt.

- `solidarity.incident.create` — enregistrer un signalement ou incident.
- `solidarity.incident.update` — modifier un incident selon les permissions.
- `solidarity.incident.qualify` — qualifier ou confirmer un incident.
- `solidarity.need.create` — enregistrer un besoin.
- `solidarity.need.update` — mettre à jour son état ou ses quantités.
- `solidarity.need.verify` — tracer une vérification / évaluation.
- `solidarity.need.prioritize` — lecture ordonnée avec motifs explicables.
- `solidarity.need.close` / `solidarity.need.reopen` — clôture motivée / réouverture.
- `solidarity.donation.create` — enregistrer une intention de contribution.
- `solidarity.donation.commit` — confirmer un engagement de ressources.
- `solidarity.hub.manage` — gérer les métadonnées d'un hub autorisé.
- `solidarity.stock.move` — enregistrer un mouvement de stock.
- `solidarity.allocation.propose` / `solidarity.allocation.confirm` — suggestion vs affectation avec effet stock.
- `solidarity.shipment.dispatch` — expédition et suivi logistique.
- `solidarity.mission.create` — planifier une mission.
- `solidarity.mission.assign` — affecter des acteurs et ressources.
- `solidarity.mission.update` — mettre à jour l'état d'une mission.
- `solidarity.volunteer.register` — référencer un bénévole (ID opaque).
- `solidarity.volunteer.profile.read` — lecture du profil opérationnel autorisé.
- `solidarity.volunteer.availability.update` — déclarer / confirmer disponibilités.
- `solidarity.volunteer.skill.manage` — gérer compétences et qualifications.
- `solidarity.volunteer.team.manage` — gérer équipes, rôles, capacités.
- `solidarity.volunteer.matching.propose` — proposer candidats / équipes avec motifs.
- `solidarity.mission.assignment.create` / `solidarity.mission.assignment.respond` — proposer puis accepter / refuser explicitement.
- `solidarity.mission.checkin.record` — pointages départ / arrivée / étapes.
- `solidarity.volunteer.incident.report` — signaler un incident (accès restreint).
- `solidarity.distribution.confirm` — confirmer une distribution.
- `solidarity.matching.propose` — proposer des correspondances entre besoins et ressources.
- `solidarity.report.export` — générer un export autorisé.

Toute capability sensible doit définir les autorisations requises, le périmètre de tenant et, le cas échéant, le périmètre opérationnel ou géographique.

### Événements métier

Exemples d'événements à formaliser selon les fonctionnalités réellement prises en charge :

- `solidarity.incident.reported`, `solidarity.incident.qualified`, `solidarity.incident.closed`
- `solidarity.need.reported`, `solidarity.need.created`, `solidarity.need.updated`, `solidarity.need.verified`, `solidarity.need.priority.changed`, `solidarity.need.coverage.changed`, `solidarity.need.coverage.recalculated`, `solidarity.need.closed`, `solidarity.need.reopened`
- `solidarity.donation.offered`, `solidarity.donation.committed`, `solidarity.resource.available`
- `solidarity.hub.stock.changed`
- `solidarity.allocation.proposed`, `solidarity.allocation.confirmed`
- `solidarity.shipment.dispatched`
- `solidarity.mission.created`, `solidarity.mission.assigned`, `solidarity.mission.started`, `solidarity.mission.completed`
- `solidarity.mission.assignment.proposed`, `solidarity.mission.assignment.accepted`, `solidarity.mission.assignment.refused`, `solidarity.mission.checkin.recorded`
- `solidarity.volunteer.registered`, `solidarity.volunteer.activated`, `solidarity.volunteer.availability.updated`, `solidarity.volunteer.incident.reported`, `solidarity.volunteer.debrief.submitted`
- `solidarity.distribution.confirmed`
- `solidarity.sync.conflict.detected`
- `solidarity.report.exported`

Chaque événement doit définir un schéma versionné, un identifiant unique, un horodatage serveur, le tenant concerné et les références métier nécessaires. Événements versionnés et idempotents ; minimum de données personnelles ; consommateurs capables de dédupliquer les rejoués sans supposer un ordre global.

## 5. Interactions et dépendances

Solidarity s'exécute sur RuntimeKernel dans un conteneur enfant isolé par tenant.

- Communication inter-applications exclusivement via capabilities et événements.
- Accès à la persistance, au stockage et aux services techniques exclusivement via ports et adapters.
- Acteurs référencés par identifiants opaques provenant de Citadelle ou Spaces selon les contrats disponibles.
- Notifications produit déléguées au service responsable, sans transformer Solidarity en moteur de notifications.
- Paiements délégués à Payments lorsque cette application est disponible.
- Calcul d'itinéraire ou services géospatiaux externes utilisés uniquement via des contrats explicites, avec comportement dégradé documenté.

Aucune jointure directe ni lecture de base de données d'une autre application n'est autorisée.

## 6. Données possédées — source de vérité

Solidarity est responsable de ses données opérationnelles :

- Incidents, signalements (`NeedReport`), qualifications et historique des décisions (`NeedAssessment`).
- Besoins, demandes d'aide, priorités, compteurs (demandé / réservé / expédié / distribué / restant), fraîcheur et motifs de clôture.
- Intentions de don, engagements et suivi des contributions (`ResourceOffer`, `ResourceStock`).
- Hubs, entrepôts, emplacements et capacités logistiques.
- Stocks, réservations et mouvements de ressources.
- Missions, affectations (`MissionAssignment`), pointages (`MissionCheckIn`), checklists et comptes rendus (`VolunteerDebrief`).
- Références opérationnelles des bénévoles (`VolunteerProfile`, `VolunteerSkill`, `VolunteerAvailability`, `VolunteerCommitment`, `VolunteerTeam`) et incidents de sécurité (`VolunteerIncident`, accès restreint).
- Distributions, quantités remises et confirmations.
- Références pseudonymisées des bénéficiaires.
- Propositions de matching et décisions d'allocation.
- Files d'opérations hors ligne, clés de déduplication et conflits de synchronisation.
- Journaux d'audit métier et preuves d'intégrité.
- Paramètres et correspondances nécessaires aux rapports OCHA/HXL.

### Références externes

- Identité et acteurs : Citadelle ou Spaces, par identifiants opaques.
- Stockage de pièces justificatives : service de stockage via un port, si nécessaire.
- Paiements : futur service Payments.
- Notifications : service Notifications.
- Services cartographiques : adapters dédiés lorsque requis.

Les références externes ne doivent jamais servir à contourner les règles d'accès ou à reconstruire inutilement des données personnelles.

## 7. Frontières et invariants — ADR-0016

### 7.1 Source de vérité opérationnelle

Solidarity est responsable du suivi opérationnel de la solidarité. Il ne remplace pas :

- Les systèmes nationaux ou institutionnels d'alerte et de gestion de crise.
- La source de vérité de l'identité et des accès.
- Les services de paiement.
- Les autorités qui valident les décisions relevant de leur compétence.

Une alerte externe peut alimenter Solidarity par un contrat autorisé, mais Solidarity ne doit pas se présenter comme l'émetteur officiel de cette alerte.

### 7.2 Paiements — frontière Payments

Les dons financiers relèvent d'une séparation stricte :

- Solidarity peut enregistrer une intention de contribution financière.
- Solidarity peut conserver une référence métier opaque vers une opération de paiement.
- Payments demeure responsable de l'autorisation, de l'exécution, du statut financier et de la réconciliation des transactions.
- Solidarity ne doit jamais marquer un paiement comme réussi sur la seule base d'une déclaration du contributeur.
- La disponibilité ou l'affectation d'un don financier doit reposer sur une confirmation fiable de Payments et sur les règles métier applicables.

### 7.3 Données des bénéficiaires

Les bénéficiaires doivent être représentés par des références pseudonymisées.

- Ne pas stocker directement le nom, l'adresse personnelle, le numéro de téléphone ou les documents d'identité si ces données ne sont pas indispensables.
- Ne pas intégrer de données personnelles dans les identifiants, journaux, événements ou racines de Merkle.
- Restreindre les données de localisation et les preuves terrain selon les rôles et le besoin opérationnel.
- Documenter la finalité, la conservation, l'accès, l'effacement et les éventuelles exceptions légales.
- Éviter les pseudonymes déterministes dérivés directement d'une identité ou d'un numéro public sans protection cryptographique adaptée.
- Évaluer les risques de réidentification par croisement de données.
- Prévoir une procédure de traitement des demandes RGPD et des incidents de confidentialité.

La pseudonymisation réduit les risques mais ne rend pas les données anonymes au sens juridique.

### 7.4 Invariants opérationnels

- **Besoin ≠ allocation ≠ distribution** : seul `Distribution` réduit le besoin ; seule une clôture motivée le ferme.
- **Promesse ≠ livraison** : offre ou allocation proposée sans effet sur la couverture.
- **Pas de double promesse** : allocation confirmée = stock réservé, disponible non sur-allouable.
- **Fusion non destructive** : signalements conservés et liés ; contradiction → vérification.
- **Unités homogènes** : aucun agrégat inter-catégories sans méthode explicite.
- **Le matching propose, l'humain engage** : allocation = confirmation responsable + (côté bénévole) acceptation explicite.
- **Sécurité bénévole** : pas d'affectation sans prérequis/briefing ; missions dangereuses aux habilités ; mission suspendable ; incidents en accès restreint.
- **Vie privée** : identité par ID opaque ; pas de GPS continu par défaut ; position toujours datée.

## 8. Frontières de sécurité

- Aucune route sans autorisation explicite via les mécanismes prévus.
- Aucun accès infra direct hors ports.
- Aucun import direct depuis une autre application BAC.
- Isolation stricte des tenants et des périmètres opérationnels.
- Vérification des autorisations lors de chaque opération sensible, y compris lors de la synchronisation différée.
- Contrôle des quantités, unités, états et transitions métier.
- Idempotence sur les confirmations, réservations, distributions et mouvements de stock.
- Protection contre les affectations concurrentes incompatibles (ressources comme bénévoles).
- Journalisation des décisions sensibles sans duplication de données personnelles.
- Protection des preuves de distribution contre la falsification et la divulgation excessive.
- Validation des imports et exports, avec contrôle des formats et des volumes.
- Limitation des accès aux localisations sensibles.
- Gestion documentée des secrets, clés et droits techniques.
- Aucune copie d'identité, pièce, coordonnée privée ou donnée de santé détaillée ; aucune position présentée comme actuelle sans sa date.

Les opérations hors ligne doivent être réautorisées côté serveur à la synchronisation. Le fait qu'une action ait été permise localement ne garantit pas qu'elle le soit encore lorsque le serveur la reçoit.

## 9. Non-responsabilités

Solidarity ne :

- Réimplémente pas le kernel, le gateway ou les adapters.
- Remplace pas Citadelle ou Spaces pour l'identité.
- Émet pas d'alertes nationales faisant autorité.
- Traite pas les transactions financières.
- Devient pas un service général de notifications.
- Accède pas directement aux bases de données d'autres applications.
- Garantit pas la véracité factuelle d'un signalement par sa seule présence dans le système.
- Confond pas preuve cryptographique d'intégrité et preuve matérielle de distribution.
- Collecte pas systématiquement des données personnelles ou biométriques pour confirmer l'aide.
- Présente pas le matching géospatial comme une décision définitive sans validation métier lorsque celle-ci est requise.
- Traite pas un inscrit comme secouriste professionnel ni comme disponible permanent (y compris via l'appartenance à une équipe).
- Décide pas seul de l'ordre des interventions : il explique et propose, l'opérateur tranche.

## 10. Critères de santé et de qualité

### Architecture

- Conforme à `pnpm check:conformance` et `check:manifests`.
- Capabilities versionnées et enregistrées au démarrage.
- Schémas d'événements validés et enregistrés au démarrage.
- Aucun import direct inter-applications.
- Autorisations vérifiées sur toutes les routes et opérations sensibles.
- Isolation des tenants couverte par des tests.

### Cohérence opérationnelle

- Tests de domaine verts (`*.test.ts`).
- Transitions d'état des incidents, besoins, missions et distributions testées.
- Mouvements de stock et réservations idempotents.
- Détection des doubles affectations et surallocations (stocks comme bénévoles).
- Distinction vérifiée entre besoins engagés, couverts et effectivement distribués (cas 1 000 L / 200 L → 20 %, promesse + transit sans effet).
- Confirmation de distribution rejouée sans doublon.
- Synchronisation hors ligne testée avec conflits et reconnexions.
- Matching géospatial testé sur les cas limites et les données incomplètes.
- Matching bénévoles : refus d'un non qualifié même proche ; double affectation incompatible refusée ; annulation d'affectation sans suspension du compte.
- Besoins : fusion conserve les signalements ; expiré ≠ satisfait ; vital non vérifié → vérification urgente.

### Confidentialité et traçabilité

- Audit RGPD dédié à la pseudonymisation des bénéficiaires.
- Politique de conservation et de purge documentée.
- Tests d'accès et de réidentification indirecte.
- Journaux exempts de données personnelles superflues.
- Vérification des preuves de Merkle testée si cette fonctionnalité est activée.
- Limites des preuves cryptographiques documentées.

### Interopérabilité et exploitation

- OpenAPI généré sans erreur.
- Formats et correspondances d'export OCHA/HXL validés.
- Contrats d'intégration avec Payments documentés lorsqu'ils existent.
- Comportement sans adapter explicitement documenté.
- Gestion des erreurs et reprises opérationnelles testée.
- Métriques disponibles : besoins non couverts, ressources engagées, distributions confirmées, conflits de synchronisation, bénévoles disponibles par zone, missions sous-dotées, acceptations, heures/repos, incidents et comptes rendus en attente. Chaque besoin prioritaire et chaque proposition bénévole expose ses motifs. Pas de classement public des bénévoles.

## 11. Principe final

Solidarity doit permettre de savoir quel besoin existe, qui l'a qualifié, quelles ressources ont été engagées, qui intervient, ce qui a réellement été distribué et quelles preuves soutiennent cette conclusion.

La priorité est donnée à la sécurité des personnes, à la cohérence des stocks, à la traçabilité des décisions et à la résilience opérationnelle, même lorsque les réseaux ou les systèmes externes sont indisponibles.

Le besoin appartient au domaine opérationnel de Solidarity. L'identité appartient à Citadelle/Spaces. La transaction appartient à Payments. L'infrastructure appartient à MosaiX. La distribution doit rester vérifiable sans exposer inutilement les bénéficiaires.
