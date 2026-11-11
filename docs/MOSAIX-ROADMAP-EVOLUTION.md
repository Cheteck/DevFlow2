# MosaiX — Roadmap d’évolution

> **Document de référence évolutif**
>
> **Vision cible :** MosaiX est un framework, un runtime et une plateforme de développement composable permettant de construire, assembler, exécuter, étendre et exploiter des applications numériques à partir de Bounded Application Contexts (BAC), de capacités, de plugins et de contrats explicites.
>
> **Principe directeur :** MosaiX doit évoluer d'une base logicielle modulaire bien structurée vers un véritable environnement d'exécution applicatif. Il ne suffit pas de pouvoir réutiliser des packages ou d'isoler des domaines : il faut pouvoir décrire une application, résoudre ses dépendances, activer ses capacités, choisir son mode d'exécution et garantir son fonctionnement sans couplage arbitraire au code de l'application hôte.
>
> **Règle de statut :** aucune capacité n'est considérée comme terminée sans preuve ou confirmation explicite. Les audits et documents antérieurs sont des instantanés, pas une vérité garantie sur l'état actuel du dépôt.

---

## 1. Vision et positionnement

MosaiX doit devenir une infrastructure logicielle réutilisable pour concevoir des applications et plateformes très différentes sans reconstruire leurs fondations à chaque projet.

Exemples de compositions possibles :

- **Marketplace :** Identity + Spaces + Portfolio + Commerce + Social + Messaging.
- **LMS :** Identity + Spaces + Learning + Messaging + Media.
- **ERP :** Identity + Spaces + Inventory + Commerce + Workflow.
- **Creator Platform :** Identity + Spaces + Portfolio + Social + Media + Messaging.
- **Plateforme métier spécialisée :** BAC métier dédié + capacités transversales + plugins adaptés.

L'ambition n'est pas de transformer chaque BAC en microservice. Un BAC doit d'abord être une unité de domaine autonome, contractualisée et composable. Son mode d'exécution pourra ensuite varier selon les besoins.

### Ce que MosaiX doit être

1. **Un framework** : contrats, primitives, ports, adapters, outils et conventions.
2. **Un Application Contract Runtime** : interprétation et exécution de définitions d'applications déclaratives.
3. **Un environnement de composition** : assemblage de BAC, capacités, plugins et dépendances.
4. **Un runtime adaptable** : exécution partagée, isolée ou externe selon le profil requis.
5. **Une plateforme développeur** : SDK, CLI, outils de diagnostic, génération, validation et déploiement.
6. **Un écosystème extensible** : plugins, packages et, à terme, catalogue de BAC réutilisables.

### Ce que MosaiX ne doit pas devenir

- Un monolithe géant contenant les règles métier de toutes les applications.
- Un simple catalogue de packages sans runtime cohérent.
- Un orchestrateur dynamique qui charge du code arbitraire sans contrats ni frontières de sécurité.
- Une architecture microservices prématurée où chaque BAC devient un service réseau.
- Un framework dépendant d'un fournisseur cloud ou d'une technologie d'infrastructure unique.

---

## 2. Modèle conceptuel de référence

Les concepts doivent rester distincts et avoir chacun une responsabilité claire.

| Concept | Responsabilité |
|---|---|
| **MosaiX Core** | Noyau technique et cycle de vie du runtime |
| **Application** | Produit exécutable composé de BAC, capacités, plugins et configuration |
| **BAC** | Unité autonome de domaine, propriétaire de son modèle métier et de ses données |
| **Capability** | Contrat fonctionnel exposé par un BAC ou un composant |
| **Plugin** | Extension branchée sur des points d'extension définis |
| **Package** | Unité de distribution de code ou de bibliothèque, sans nécessairement avoir de cycle de vie |
| **Port** | Contrat abstrait vers une dépendance externe ou une infrastructure |
| **Adapter** | Implémentation concrète d'un port |
| **Runtime Profile** | Mode d'exécution choisi pour une application ou un BAC |
| **SDK** | Interface développeur stable vers les services et capacités MosaiX |
| **Control Plane** | Gestion de la configuration, du déploiement, de la topologie et de l'administration |

### BAC : de contexte métier à unité installable

Un BAC ne doit pas être assimilé automatiquement à un microservice ou à un plugin.

Son évolution cible peut suivre ce chemin :

1. Module métier isolé dans un monorepo.
2. Unité déclarative avec manifeste, contrats et dépendances explicites.
3. Unité découvrable, validable et activable par le runtime.
4. Unité distribuable et versionnée.
5. Unité installable dans une application MosaiX.
6. Unité exécutable selon un profil partagé, isolé ou externe.

Le passage à une unité installable ne doit pas imposer de transformer immédiatement son exécution en processus séparé. Le contrat doit être indépendant du mode d'hébergement.

---

## 3. Principes architecturaux non négociables

### 3.1 Contrats avant conventions implicites

- Chaque BAC expose un manifeste versionné et validé par schéma.
- Les dépendances, capacités, permissions, points d'extension et exigences d'infrastructure sont explicites.
- Les contrats publics sont séparés des détails d'implémentation.
- Les changements incompatibles suivent une politique de versionnement.

### 3.2 Frontières de domaine strictes

- Un BAC possède son modèle métier et ses données.
- Aucun BAC ne doit importer directement les détails internes d'un autre BAC.
- Les interactions passent par des contrats publics, commandes, événements ou ports autorisés.
- Les règles de dépendance sont contrôlées automatiquement en CI.

### 3.3 Le runtime reste l'autorité

- Un manifeste déclare une intention ; il ne prouve pas qu'une capacité est autorisée.
- Le runtime valide les dépendances et les permissions avant activation.
- Le Gateway et les points d'entrée doivent faire respecter les capacités réellement actives.
- Les états de cycle de vie sont explicites, observables et idempotents.
- Les erreurs doivent produire un comportement défini : blocage, dégradation, repli ou désactivation.

### 3.4 Infrastructure interchangeable, mais pas abstraite à l'excès

- Les domaines dépendent de ports, pas de drivers concrets.
- Les adapters doivent être conformes à leurs contrats.
- Les fallbacks en mémoire ne doivent jamais masquer silencieusement l'absence de persistance en production.
- Les profils de déploiement déclarent clairement les garanties disponibles.

### 3.5 Simplicité opérationnelle

- Monorepo et monolithe modulaire tant que la séparation physique n'apporte pas de bénéfice mesurable.
- Ne pas introduire de bus distribué, de service distant ou de runtime secondaire sans besoin concret.
- Un mécanisme unique doit avoir une source de vérité unique.
- Préférer une architecture évolutive et testable à une architecture théoriquement universelle.

---

## 4. Architecture cible — vue d'ensemble

```text
                         MOSAIX PLATFORM
                               │
                  Developer Experience / Control Plane
                    CLI · SDK · Studio · Registry
                               │
                   APPLICATION CONTRACT RUNTIME
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        Application A    Application B    Application C
          Marketplace         LMS               ERP
              │                │                │
        Composition       Composition       Composition
         Manifest          Manifest          Manifest
              │                │                │
       ┌──────┼──────┐   ┌─────┼─────┐    ┌─────┼─────┐
       BACs  Plugins  Caps  BACs Plugins Caps   BACs Plugins
              │                │                │
              └────────────────┼────────────────┘
                               │
                    Runtime & Lifecycle Layer
              Discovery · Validation · Resolution
               Activation · Isolation · Recovery
                               │
                     Capability / Contract Layer
                 Commands · Events · APIs · Policies
                               │
                       Infrastructure Ports
                               │
                        Adapter Implementations
             Database · Cache · Queue · Media · Auth
                               │
                  Shared / Isolated / External
                       Execution Profiles
```

Cette vue représente une cible conceptuelle. Elle ne signifie pas que toutes ces couches doivent être construites simultanément ni qu'elles doivent devenir des services séparés.

---

## 5. Roadmap hiérarchique

Les étapes sont ordonnées par dépendances architecturales. Elles ne sont pas des échéances calendaires. Une étape peut être partiellement engagée, mais ne devient acquise que lorsque ses critères de sortie sont vérifiés.

### Étape 0 — Assainir et stabiliser les fondations

**Objectif :** rendre les primitives existantes fiables, cohérentes et suffisamment stables pour servir de socle au runtime.

**Chantiers**
- Cartographier les packages, ports, adapters, primitives, BAC et dépendances réelles.
- Réconcilier les contrats dupliqués et les responsabilités qui se chevauchent.
- Clarifier la frontière entre Core, SDK, packages transversaux et runtime.
- Enforcer les règles de dépendances et l'absence de cycles.
- Vérifier l'inversion des dépendances entre domaines et infrastructure.
- Éliminer les fallbacks mémoire silencieux lorsqu'une persistance est requise.
- Définir les garanties minimales de chaque adapter.
- Stabiliser les contrats fondamentaux avant tout gel d'API.
- Définir les règles de compatibilité, dépréciation et versionnement.

**Point de vigilance connu**
- Un problème `InMemoryGuard` a été signalé : certains adapters peuvent encore utiliser un stockage en mémoire lorsque le stockage persistant est absent. Il faut vérifier chaque adapter et chaque chemin de construction, et pas seulement le chemin nominal.

**Critères de sortie**
- Les frontières de packages sont contrôlées par des tests et la CI.
- Les adapters persistants échouent explicitement si leur dépendance obligatoire est absente.
- Les fallbacks sont opt-in, visibles et interdits dans les profils qui exigent une persistance.
- Les contrats partagés ont un propriétaire et une source de vérité.
- Les tests d'intégration couvrent les adapters supportés.
- Les décisions d'architecture et les packages candidats au gel d'API sont documentés.

**Statut de référence :** fondations déjà largement structurées selon les audits disponibles ; stabilisation et vérification exhaustive encore à confirmer. Le gel d'API ne doit pas être déclaré acquis sans preuve.

### Étape 1 — Définir et stabiliser l'Application Contract Runtime

**Objectif :** donner à MosaiX un contrat d'application explicite et un runtime dont le comportement est prévisible.

**Chantiers**
- Définir `ApplicationDefinition` et son schéma versionné.
- Définir le contrat d'un BAC : identité, version, manifeste, dépendances, capacités, permissions, providers, migrations et points d'entrée.
- Distinguer découverte, validation, résolution, chargement, initialisation, activation, désactivation et déchargement.
- Définir les états et transitions autorisés.
- Rendre les opérations idempotentes.
- Définir le comportement des dépendances manquantes, incompatibles ou cycliques.
- Définir le modèle de configuration et la résolution des paramètres.
- Définir les erreurs runtime normalisées et les diagnostics.
- Fournir des tests de conformité réutilisables.

**Critères de sortie**
- Une application peut être décrite par un contrat versionné et validé.
- Le runtime rejette les manifests invalides avant toute activation.
- Les dépendances sont résolues de façon déterministe.
- Les transitions de cycle de vie sont testées, y compris les échecs.
- Le redémarrage et la réactivation ne produisent pas de doublons ou d'états incohérents.
- Le runtime ne dépend pas des détails internes d'un BAC.

### Étape 2 — Passer de BAC déclarés à BAC composables au runtime

**Objectif :** permettre au runtime de découvrir, valider et activer les BAC requis par une application sans assemblage manuel dans un entrypoint central.

**Chantiers**
- Mettre en place un `BAC Registry` ou mécanisme de découverte équivalent.
- Résoudre le graphe de dépendances et les contraintes de versions.
- Étendre le cycle de vie des plugins aux BAC sans confondre leurs contrats.
- Charger les `AppServiceProvider` à partir d'un mécanisme d'enregistrement sûr et explicite.
- Enregistrer services et routes dans des conteneurs et routeurs maîtrisés.
- Prévoir activation partielle, désactivation et arrêt propre.
- Introduire des tests de composition avec des BAC fictifs.
- Supprimer progressivement les imports et enregistrements statiques devenus inutiles.

**Critères de sortie**
- Ajouter un BAC à une composition ne nécessite pas de modifier manuellement le root d'assemblage.
- Les dépendances circulaires sont détectées avant activation.
- Un BAC défaillant ne compromet pas les composants indépendants au-delà de la politique définie.
- Le runtime sait expliquer pourquoi un BAC est actif, bloqué ou désactivé.
- Les tests démontrent plusieurs compositions différentes à partir de manifests.

**Réserve importante :** le chargement dynamique ne doit pas signifier l'exécution arbitraire de code non fiable. La découverte, la provenance, la validation et les permissions de chargement doivent être traitées comme des sujets de sécurité.

### Étape 3 — Faire respecter les capacités et les politiques de bout en bout

**Objectif :** transformer les capacités déclaratives en véritables frontières d'exécution.

**Chantiers**
- Construire un registre central des capacités actives.
- Relier les capacités déclarées aux routes, commandes, événements et opérations concernées.
- Introduire des guards/middlewares au niveau des points d'entrée.
- Distinguer capacité disponible, activée, autorisée et effectivement accessible à un acteur.
- Définir une politique fail-closed pour les opérations sensibles.
- Clarifier les responsabilités entre Identity, Security, Policy Engine et Gateway.
- Ajouter des contrôles de permissions au niveau des opérations métier, pas uniquement dans l'interface.
- Tracer les refus et les décisions de politique.

**Critères de sortie**
- Une capacité désactivée ne peut pas être invoquée via une route, une commande ou un autre chemin d'exécution.
- Une permission UI ne remplace jamais une autorisation backend.
- Les décisions d'accès sont testées sur les chemins positifs et négatifs.
- Les politiques sont cohérentes quel que soit le point d'entrée.
- Les refus sont explicables et auditables.

### Étape 4 — Unifier le système d'extension et le Plugin Runtime

**Objectif :** fournir un système d'extension cohérent, déterministe et gouverné, sans confondre plugins, packages et BAC.

**Chantiers**
- Clarifier les contrats `Package`, `Plugin`, `BAC` et `Capability`.
- Séparer les responsabilités Registry, Runtime et Graph Resolver.
- Définir la classification des plugins : core, domain, feature, integration, ou catégories équivalentes justifiées.
- Définir les dépendances, priorités, versions et conflits.
- Formaliser les hooks, slots et points d'extension.
- Définir les règles de résolution déterministes.
- Définir les modèles d'échec et de dégradation par type d'extension.
- Prévoir activation, désactivation, réactivation et absence de retry dangereux.
- Fournir une compatibilité transitoire avec les systèmes historiques uniquement si nécessaire.
- Construire un tableau de bord de diagnostic et d'état.

**Critères de sortie**
- Un seul système de référence gère les extensions concernées.
- Les cycles, conflits et incompatibilités sont détectés.
- Les règles de priorité et de résolution sont documentées et testées.
- Un plugin ne peut pas introduire librement de logique métier qui devrait appartenir à un package ou à un BAC.
- La panne d'une extension suit une stratégie prévisible.
- Les migrations des anciens mécanismes sont terminées ou explicitement maintenues avec un périmètre limité.

### Étape 5 — Faire du BAC une unité installable et distribuable

**Objectif :** permettre de réutiliser et installer des BAC sans imposer un modèle microservices.

**Chantiers**
- Définir un format de package BAC et son manifeste.
- Définir le versionnement et les plages de compatibilité du runtime et du SDK.
- Définir les dépendances obligatoires et optionnelles.
- Définir les migrations et stratégies de mise à niveau.
- Définir les permissions et capacités requises à l'installation.
- Définir provenance, signature ou mécanisme de confiance des artefacts.
- Construire des commandes d'installation, de validation, de mise à jour et de retrait.
- Gérer les conflits de versions et les dépendances transitives.
- Fournir des BAC d'exemple et des tests de conformité.

**Critères de sortie**
- Un BAC peut être packagé et installé dans une application compatible.
- Le runtime peut vérifier son manifeste et ses dépendances avant installation ou activation.
- Une mise à jour incompatible est bloquée ou accompagnée d'une migration explicite.
- Un BAC peut être retiré sans laisser de ressources orphelines non maîtrisées.
- Le mode d'installation est indépendant du mode d'exécution.

### Étape 6 — Construire les Runtime Profiles : Shared, Isolated, External

**Objectif :** faire évoluer MosaiX vers une plateforme hybride capable de choisir le niveau d'isolation adapté à chaque application ou BAC.

**Profils cibles**
- **Shared Runtime :** plusieurs composants cohabitent dans un même processus/runtime. Profil par défaut lorsque la confiance, la charge et les exigences d'isolation le permettent.
- **Isolated Runtime :** exécution dans un processus, conteneur ou environnement isolé avec limites de ressources et frontières renforcées.
- **External Runtime :** exécution distante ou gérée par un environnement externe, accessible via un contrat réseau stable.

**Chantiers**
- Définir un `Runtime Profile Contract`.
- Définir les capacités supportées et les garanties de chaque profil.
- Séparer le contrat d'un BAC de son hébergement.
- Définir les protocoles d'appel et de communication entre runtimes.
- Définir identité de workload, authentification mutuelle et autorisations inter-runtimes.
- Gérer timeouts, retries, idempotency keys, erreurs réseau et versionnement.
- Définir observabilité, quotas, isolation des ressources et politiques de déploiement.
- Construire un premier cas d'usage partagé, puis un cas isolé avant d'étendre le modèle externe.

**Critères de sortie**
- Un même contrat fonctionnel peut être exécuté dans au moins deux profils sans réécriture du domaine.
- Les limites de sécurité et de disponibilité de chaque profil sont documentées.
- Les erreurs réseau et les indisponibilités sont gérées explicitement.
- Les communications inter-runtimes sont authentifiées et autorisées.
- Le coût opérationnel supplémentaire est justifié par un besoin mesurable.

**Règle de prudence :** ne pas distribuer tous les BAC. Le profil partagé doit rester le chemin le plus simple ; l'isolation est une décision motivée par la sécurité, la charge, la disponibilité ou le cycle de déploiement.

### Étape 7 — Livrer un SDK MosaiX cohérent et une Developer Experience complète

**Objectif :** rendre MosaiX simple à utiliser pour les développeurs, sans exposer inutilement la complexité interne du runtime.

**Chantiers**
- Définir le périmètre du SDK public et ses niveaux de stabilité.
- Exposer des ports et contrats utiles plutôt que des détails internes.
- Fournir des helpers pour configuration, identité d'exécution, événements, commandes, logs, cache, persistance et validation.
- Proposer un bootstrap standard et des conventions de projet.
- Construire une CLI pour créer, inspecter, tester, composer, packager et exécuter.
- Fournir un générateur de BAC et de plugins.
- Fournir un environnement local reproductible.
- Définir des exemples minimaux et des applications de référence.
- Construire une documentation orientée tâches et contrats.
- Prévoir des outils de diagnostic des dépendances et de conformité.

**Critères de sortie**
- Un développeur peut créer un BAC fonctionnel à partir d'un template officiel.
- Le SDK masque les détails non nécessaires sans enfermer les applications dans une abstraction rigide.
- Les commandes CLI produisent des résultats déterministes et des erreurs actionnables.
- Les exemples sont testés en CI.
- Les API publiques ont une politique de compatibilité.

### Étape 8 — Control Plane, MosaiX Studio et exploitation de plateforme

**Objectif :** fournir les outils de gestion et d'exploitation nécessaires à une plateforme MosaiX utilisée par plusieurs applications et équipes.

**Chantiers**
- Gestion des applications, BAC, versions, plugins et runtime profiles.
- Inspection de la topologie et des dépendances.
- Gestion des configurations et secrets via des mécanismes dédiés.
- Déploiement, activation, désactivation et rollback contrôlés.
- Supervision des runtimes et des workloads.
- Logs, traces, métriques et événements corrélés.
- Diagnostic des erreurs de composition et d'activation.
- Gestion des migrations et de l'état des applications.
- Interface d'administration et, si justifié, MosaiX Studio pour composer visuellement une application.
- Gouvernance multi-tenant et séparation des responsabilités.

**Critères de sortie**
- Une application peut être diagnostiquée de la définition jusqu'à son exécution.
- Les changements de configuration et de topologie sont traçables.
- Les déploiements disposent de contrôles de santé et de stratégies de retour arrière.
- Les secrets ne sont pas exposés dans les manifests ou les logs.
- Les opérations critiques sont autorisées, auditées et récupérables.

### Étape 9 — Écosystème, registre et marketplace de composants

**Objectif :** permettre à des équipes internes ou externes de publier, découvrir et réutiliser des composants MosaiX.

**Chantiers**
- Registre de packages, BAC et plugins.
- Métadonnées, catégories, recherche et documentation.
- Provenance, signature, politique de confiance et analyse de dépendances.
- Compatibilité entre versions de runtime, SDK et composants.
- Processus de publication et de retrait.
- Évaluation de qualité, conformité et maintenance.
- Modèle de distribution privé, public ou auto-hébergé.
- Éventuel modèle économique autour des composants et services.

**Critères de sortie**
- Les composants publiés sont vérifiables et compatibles avec un contrat connu.
- Les utilisateurs peuvent inspecter provenance, permissions et dépendances avant installation.
- Le retrait d'un composant vulnérable ou abandonné est possible.
- Le registre ne devient pas une autorité implicite de confiance.

---

## 6. Architecture du SDK MosaiX — orientation

Le SDK doit être la façade développeur stable de MosaiX, et non un barrel qui réexporte indistinctement tous les packages internes.

Il doit offrir des contrats lisibles et des points d'extension explicites, tout en permettant au runtime de remplacer les implémentations.

### Domaines fonctionnels possibles

- **Application API** : contexte d'application, configuration et cycle de vie.
- **BAC API** : contrats, providers, capacités et intégration au runtime.
- **Command API** : enregistrement et exécution de commandes.
- **Event API** : publication, souscription et contrats d'événements.
- **Infrastructure API** : ports DB, cache, queue, media, mail et clock.
- **Security API** : identité d'exécution, policies et autorisations.
- **Observability API** : logs, traces, métriques et corrélation.
- **Plugin API** : hooks, slots, lifecycle et dépendances.
- **Testing API** : harness, adapters de test et conformance suites.

### Règles de conception

- Séparer API publique, runtime interne et adapters.
- Ne pas exposer les conteneurs internes comme API universelle si une façade plus stable suffit.
- Ne pas créer un second système d'injection de dépendances.
- Garder les packages du SDK petits et cohérents.
- Définir clairement ce qui est stable, expérimental ou interne.

---

## 7. Stratégie de validation et de maturité

Chaque package, BAC, plugin et runtime profile doit posséder un niveau de maturité explicite.

| Niveau | Signification | Exigence minimale |
|---|---|---|
| **Skeleton** | Structure initiale | Contrat et intention documentés |
| **Experimental** | Exploration active | Tests ciblés, API susceptible d'évoluer |
| **Stable** | Utilisable dans des applications | Contrats testés, compatibilité maîtrisée |
| **Production** | Prêt pour exploitation critique | Tests de résilience, sécurité, observabilité et migration |

Un niveau de maturité ne doit pas être attribué uniquement parce qu'un package compile ou possède des tests unitaires.

### Matrice de tests transversaux

- Tests de contrats pour chaque port et adapter.
- Tests de conformité pour chaque BAC.
- Tests de cycle de vie et d'idempotence.
- Tests de composition avec graphes valides et invalides.
- Tests de permissions sur tous les points d'entrée.
- Tests d'isolation et de fuite entre tenants ou BAC.
- Tests de panne, reprise, timeout et indisponibilité.
- Tests de migration et de compatibilité de versions.
- Tests de build et d'intégration sur les applications de référence.

---

## 8. Applications de référence pour prouver MosaiX

MosaiX ne doit pas être validé uniquement par des tests isolés. Il doit démontrer qu'il permet réellement de construire des applications différentes.

### Application A — IJIDeals

Composition indicative :
- Citadelle / Identity
- Spaces
- Portfolio
- Commerce
- Solara
- Beam
- composants métier additionnels selon les besoins

### Application B — LMS

Composition indicative :
- Identity
- Spaces
- Learning
- Beam
- Media
- Booking ou calendrier selon les besoins

### Application C — ERP léger

Composition indicative :
- Identity
- Spaces
- Commerce
- Inventory
- Workflow
- Reporting

### Application D — Creator Platform

Composition indicative :
- Identity
- Spaces
- Portfolio
- Solara
- Beam
- Media

**Test décisif :** ces applications doivent pouvoir être assemblées à partir de définitions déclaratives et de composants conformes, sans modifier le noyau MosaiX pour chaque nouveau produit.

---

## 9. Risques et anti-patterns à surveiller

| Risque | Conséquence | Réponse attendue |
|---|---|---|
| Runtime trop ambitieux trop tôt | Complexité et ralentissement du socle | Livrer par contrats et preuves |
| BAC transformé automatiquement en microservice | Coûts réseau et exploitation prématurés | Séparer unité de domaine et mode d'exécution |
| SDK fourre-tout | Couplage et API instable | Façades ciblées et niveaux de stabilité |
| Fallback mémoire silencieux | Perte de données et tests trompeurs | Fail-fast ou fallback explicitement configuré |
| Capacités uniquement déclaratives | Contrôle d'accès contournable | Enforcement aux points d'exécution |
| Chargement dynamique non maîtrisé | Exécution de code non fiable | Provenance, validation, permissions et isolation |
| Deux systèmes de plugins concurrents | Duplication et comportements divergents | Une source de vérité et migration progressive |
| Control Plane prématuré | Surcoût avant stabilisation du runtime | Priorité aux contrats et CLI |
| Généralisation excessive | Abstractions difficiles à utiliser | Valider sur plusieurs applications réelles |
| Gel d'API trop tôt | Verrouillage de mauvais contrats | Freeze seulement après critères de maturité |

---

## 10. Ordre de priorité recommandé

La séquence recommandée est :

1. **Fiabiliser les fondations** : dépendances, adapters, persistance, contrats et tests.
2. **Stabiliser l'Application Contract Runtime** : définition d'application, manifests, lifecycle.
3. **Activer la composition dynamique des BAC** : discovery, résolution et activation.
4. **Appliquer les capacités et politiques de bout en bout**.
5. **Unifier et stabiliser le Plugin Runtime**.
6. **Définir le packaging installable des BAC**.
7. **Introduire les Runtime Profiles** de façon progressive.
8. **Consolider le SDK et la CLI**.
9. **Construire le Control Plane et les outils Studio**.
10. **Ouvrir l'écosystème et le registre de composants**.

Cet ordre n'interdit pas de développer des outils en parallèle, mais il évite de construire une expérience de plateforme au-dessus de contrats et d'un runtime encore instables.

---

## 11. Tableau de suivi de référence

> Les statuts ci-dessous constituent une base prudente à réviser à partir du dépôt et des preuves fournies. « À confirmer » ne signifie ni absent ni terminé.

| Étape | Sujet | Statut initial |
|---|---|---|
| 0 | Fondations et fiabilité | En consolidation / à vérifier |
| 1 | Application Contract Runtime | En évolution / à confirmer |
| 2 | Composition dynamique des BAC | Écart identifié dans un audit antérieur / à vérifier |
| 3 | Enforcement des capacités | Écart identifié dans un audit antérieur / à vérifier |
| 4 | Plugin Runtime unifié | Travaux de conception documentés / exécution à confirmer |
| 5 | BAC installables et distribuables | Vision cible / planifié |
| 6 | Runtime Profiles hybrides | Vision cible / planifié |
| 7 | SDK et Developer Experience | En évolution / périmètre à confirmer |
| 8 | Control Plane et Studio | Vision cible / planifié |
| 9 | Registre et marketplace | Vision cible / planifié |

### Journal des évolutions

| Date | Évolution | Impact sur la roadmap | Statut |
|---|---|---|---|
| 2026-11-08 | Création de cette roadmap de référence à partir des éléments de vision et des audits disponibles | Structuration des étapes 0 à 9 | Document initial |

---

## 12. Règles de gouvernance de cette roadmap

- Ce document est la référence évolutive de la vision MosaiX.
- Chaque nouvelle réalisation communiquée doit être intégrée à la roadmap.
- Chaque changement de vision doit entraîner une réévaluation des étapes, dépendances et priorités.
- Distinguer systématiquement : **réalisé**, **en cours**, **planifié**, **bloqué**, **abandonné**, **à confirmer**.
- Ne jamais déclarer une étape terminée sur la seule base d'une intention, d'un plan ou d'un rapport d'architecture.
- Une réalisation est acquise lorsqu'elle est confirmée par l'utilisateur ou démontrée par des éléments vérifiables : code, tests, CI, documentation technique ou déploiement.
- Lorsqu'une information contredit un ancien audit, privilégier la preuve la plus récente et consigner la correction.
- Éviter les dates artificielles : la progression dépend des critères de sortie.
- Toute nouvelle abstraction doit résoudre un problème observé et être validée sur au moins un cas d'usage réel.
- Préserver la cohérence entre MosaiX Core, SDK, BAC, plugins, runtimes et Control Plane.

---

## 13. Questions architecturales à trancher au fil de l'évolution

Ces questions sont volontairement ouvertes ; elles ne doivent pas bloquer la stabilisation des fondations.

1. Quel est le contrat minimal universel d'un BAC, indépendamment de son runtime ?
2. Le manifeste d'application référence-t-il des BAC, des capacités, des plugins, ou des ensembles versionnés de ces composants ?
3. Où se situe exactement la frontière entre Application Runtime et Platform Control Plane ?
4. Quels composants doivent être partagés dans un runtime commun et lesquels exigent une isolation ?
5. Quel mécanisme de découverte et de chargement est compatible avec les environnements de déploiement visés ?
6. Quelle part du SDK doit être stable pour les développeurs externes ?
7. Comment garantir la compatibilité des migrations de données lorsqu'un BAC évolue ?
8. Quel est le modèle de confiance et de signature pour les BAC et plugins distribués ?
9. Comment une application peut-elle fonctionner en mode dégradé si un BAC optionnel ou un adapter devient indisponible ?
10. Quelles preuves permettront d'affirmer que MosaiX est devenu une véritable plateforme composable plutôt qu'un monorepo modulaire ?

---

**Document vivant — version initiale : 1.0 — 8 novembre 2026**

**Règle finale :** MosaiX doit devenir plus simple à utiliser à mesure que son runtime devient plus puissant. La sophistication doit rester dans le framework ; le développeur doit surtout déclarer ce dont son application a besoin, et MosaiX doit garantir que cette composition est valide, autorisée, exécutable et observable.
