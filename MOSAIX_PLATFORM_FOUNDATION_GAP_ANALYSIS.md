# MosaiX Platform Foundation — Architecture Gap Analysis (Version Consolidée)

**Rôle :** Principal Platform Architect & Runtime Engineer
**Contexte :** Consolidation technique et faisabilité de l'autonomie des BACs sans microservices
**Date :** Novembre 2026
**Statut :** Analyse d'Écart Validée, Sans Concession & Pragmatique

---

## 1. Synthèse du Verdict Architectural

L'objectif de cette analyse consolidée est de lever toute ambiguïté entre **ce qui est simplement déclaré dans le code** et **ce qui constitue une garantie opérationnelle démontrée**.

### 1.1 Ce qui est réellement établi :
- **Application Contract :** À consolider. Les manifestes v2 et les contrats typés existent (`MosaixArtifactManifest`, `ApplicationManifest`), mais la distinction entre Artifact (empaquetage gouverné), BAC (contexte métier DDD) et Application (composition d'un tenant) doit être clarifiée.
- **RuntimeKernel :** Socle in-process solide. Le cycle de vie des modules, l'IoC hiérarchique, les permissions, l'exécution in-memory des capabilities et les schémas d'événements sont fonctionnels et testés.
- **SDK (`@mosaix/sdk`) :** Couplage important. La classe `MosaixApp` dépend directement d'une référence mémoire à la classe `RuntimeKernel`, empêchant l'usage du SDK hors du processus du noyau.
- **Runtime Independence :** Partiellement démontrée. Seul Citadelle possède un point d'entrée `start.ts`. Cela prouve la possibilité de booter le noyau avec un BAC, mais ne prouve pas son autonomie opérationnelle complète (persistance, communication cross-process, isolation d'erreurs).
- **Hybrid Runtime :** Non démontré. Le mode *Shared Runtime* est le seul opérationnel. Les modes *Isolated Runtime* (sous-processus/Docker) et *External Runtime* (réseau) sont des cibles architecturales non implémentées.

---

## 2. Traitement des 5 Risques & Clarifications Critiques

### 2.1 Un point d'entrée `start.ts` ne fait pas l'autonomie
Le fait que `apps/citadelle/src/start.ts` existe est une preuve de faisabilité syntaxique, mais ne constitue pas une garantie d'autonomie opérationnelle.
Pour qu'un BAC soit qualifié d'autonome, il doit prouver qu'il peut :
1. Démarrer sans importer un seul symbole de `src/shell/` ou du serveur HTTP global.
2. Initialiser l'ensemble de ses dépendances IoC sans fallback implicite silencieux.
3. Se connecter à sa base PostgreSQL et exécuter ses propres migrations de schéma (`citadelle.*`).
4. Échouer explicitement (fail-fast) si l'infrastructure requise est absente en production.
5. Être testable dans une suite de tests unitaire/intégration qui n'instancie jamais le monolithe.

### 2.2 Choix du BAC Pilote : Citadelle Confirmé, Abandon de Spaces
La mention antérieure de Spaces comme pilote immédiat était une erreur d'orientation.
- **Pourquoi Spaces n'est pas le bon pilote :** Spaces est un agrégateur marketplace qui dépend conceptuellement des offres et des propositions. Le tester avec `InMemorySpaceRepository` ne prouve qu'un démarrage bouchonné, sans valider la persistance réelle.
- **Confirmation de Citadelle comme unique pilote :**
  - Schéma PostgreSQL isolé et mature (`citadelle_users`, `citadelle_credentials`).
  - Domaine d'identité régalien : autonome par essence (ne dépend d'aucun autre BAC pour fonctionner).
  - Possède déjà la structure de démarrage qu'il suffit de durcir avec la persistance réelle.

### 2.3 Refus de la création prématurée de `@mosaix/ports-runtime`
Créer immédiatement un nouveau package `@mosaix/ports-runtime` violerait le principe de simplicité et la règle d'ingénierie proportionnelle.
- **Constat :** Les contrats nécessaires pour découpler le SDK (invocateur de capability, bus d'événements) existent déjà partiellement sous forme de types dans `@mosaix/contracts`.
- **Décision :** Aucun nouveau package n'est créé. L'inversion de dépendance doit d'abord se faire en extrayant une simple interface TypeScript interne dans le SDK avant d'envisager une nouvelle abstraction de package.

### 2.4 Fiabilité des Événements : Bus Mémoire vs Messagerie de Production
Le bus d'événements mémoire actuel (`packages/core/src/event-bus.ts`) fournit une validation de schéma et une gestion des réessais/DLQ en mémoire.
**Limites observées :**
- **Pas de persistance :** En cas de redémarrage du processus, les événements en file et la DLQ sont perdus.
- **Absence d'Outbox Transactionnelle :** Les événements métier ne sont pas émis dans la même transaction SQL que les mutations de tables de données.
- **Idempotence non garantie :** Les consommateurs actuels ne dédupliquent pas systématiquement les messages.
- **Garantie actuelle :** Suffisante pour une coordination locale au sein du Monolithe Modulaire (Shared Runtime), mais insuffisante pour découpler des processus indépendants.

### 2.5 Sécurité du Contexte d'Exécution : Identité et Tenant
Le runtime ne fournit pas de véritable sandboxing physique (le flag `isolation: "sandbox"` n'est pas appliqué par le Kernel).
Il est donc impératif de garantir que :
- L'identité de l'appelant (`callerApp`), le `tenant` et les rôles ne soient pas forgés par le code client du BAC.
- Le `RuntimeKernel.executeCapability()` valide cryptographiquement ou contextuellement l'identité injectée avant toute évaluation des règles RBAC/ABAC.

---

## 3. Résolution des Contradictions Identifiées

| Contradiction / Problème | Fait Observé | Résolution & Décision Architecturales |
|---|---|---|
| **4 imports Shell interdits** | Présents dans `commerce`, `imperia` et `solara` (`getGlobalPluginEngine`) | **Priorité 1 absolue :** Supprimer ces imports et injecter le moteur de plugin via le conteneur IoC du BAC. |
| **11 BACs vs 1 point d'entrée** | Seul Citadelle a un `start.ts` ; les autres sont câblés statiquement dans `src/start.ts` | **Priorité 2 :** Valider Citadelle de bout en bout avant de dupliquer des scripts de démarrage sur les 10 autres. |
| **Pilote Citadelle vs Spaces** | Incohérence dans le précédent document | **Citadelle est l'unique pilote retenu.** |
| **Shared Runtime "100% opérationnel"** | Fonctionne en dev/test, mais dépend d'une initialisation globale dans `src/start.ts` | Reconnaître que le Shared Runtime est opérationnel pour le monolithe assemblé, mais que l'assemblage dynamique par tenant reste théorique. |
| **Stratégie PostgreSQL** | Schémas isolés (`CANONICAL_BAC_SCHEMAS`), mais fallbacks en mémoire omniprésents | Imposer en mode production le fail-fast : refus du démarrage si le `DatabasePort` PostgreSQL n'est pas fourni. |

---

## 4. Les Quatre Chantiers Opérationnels (Roadmap d'Ingénierie)

```
[Chantier 1 : Éliminer les Dépendances Interdites]
  - Supprimer les imports de src/shell/plugin-engine-bootstrap.js dans Commerce, Imperia, Solara.
  - Ajouter une règle ESLint / boundaries interdisant tout import depuis apps/ vers src/.

[Chantier 2 : Valider l'Autonomie Réelle de Citadelle]
  - Exécuter le MosaiX Independent BAC Test sur Citadelle.
  - Connecter Citadelle à PostgreSQL (schéma citadelle) dans son start.ts sans aucun fallback.
  - Prouver l'exécution des migrations et d'une capability dans un processus Node.js autonome.

[Chantier 3 : Standardiser le Bootstrap des BACs]
  - Définir le contrat de factory standard : create<Bac>App(kernel, tenant, { databasePort }).
  - Appliquer ce standard aux 10 autres BACs de manière progressive.

[Chantier 4 : Réduire le Couplage SDK / Kernel]
  - Remplacer la dépendance directe du SDK envers la classe concrète RuntimeKernel par une
    interface légère d'invocateur, préparant les futurs modes sans sur-architecturer.
```

---

## 5. Le Test Décisif : "MosaiX Independent BAC Test"

Le critère objectif validant qu'un BAC est devenu une application autonome est l'exécution avec succès du protocole suivant :

### Protocole de Test
1. **Isolation de Processus :** Lancer le BAC dans un sous-processus Node.js indépendant (`child_process.spawn("node", ["apps/citadelle/dist/start.js"])`).
2. **Arrêt du Shell :** Le serveur global `src/start.ts` doit être **complètement éteint**.
3. **Configuration & IoC :** Le BAC charge sa configuration d'environnement et instancie son propre conteneur IoC enfant sans référence au Shell.
4. **Persistance & Schéma :** Le BAC se connecte à PostgreSQL, vérifie ou applique ses migrations dans le schéma `citadelle`.
5. **Capability Execution :** Le BAC exécute une capability d'authentification (`citadelle.auth.login`) avec validation Zod et vérification de permission locale.
6. **Événements :** Le BAC émet un événement typé conforme à son schéma.
7. **Arrêt Propre :** Le processus s'arrête avec le code de sortie `0` et libère ses connexions de base de données.

---

*Ce document remplace toute interprétation antérieure et fixe la ligne de conduite d'ingénierie de la plateforme MosaiX.*
