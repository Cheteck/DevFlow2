# Responsabilités — app portfolio

| Champ | Valeur |
|---|---|
| Nom | `@apps/portfolio` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — PIM / vendables |

## Raison d'être

`portfolio` est le PIM des vendables.

Il définit, structure, normalise et enrichit les informations intrinsèques d'un vendable : produit, service, expérience ou bien numérique découpé.

Il ne gère aucune donnée commerciale d'exécution.

Le périmètre de `portfolio` couvre notamment :
- l'identité et la description du vendable ;
- ses attributs et caractéristiques ;
- ses spécifications ;
- ses variantes, lorsqu'elles sont applicables ;
- ses options et configurations, lorsqu'elles sont applicables ;
- sa taxonomie ;
- ses médias ;
- son contenu localisé FR/EN/AR ;
- ses informations SEO et slug ;
- sa complétude ;
- les informations nécessaires à sa présentation et à sa recherche ;
- le workflow de proposition et de publication de la fiche ;
- les capabilities `portfolio.vendable.*`.

**Principe directeur :** `portfolio` décrit ce qui peut être vendu ; Commerce détermine comment, à quel prix et dans quelle quantité cela peut être vendu.

---

## Responsabilités

- Respecter le schéma canonique :
  - `mosaix.json` ;
  - `src/index.ts` (MANIFEST, ServiceProvider, factory `create*App`, re-exports domaine) ;
  - `domain/` : logique métier pure ;
  - `application/` : CQRS, capabilities et événements ;
  - `infrastructure/` : controllers avec `Guard.authorize`, repositories persistent-first ;
  - `presentation/`.
- Déclarer les capabilities versionnées et leurs schémas d'événements.
- Enregistrer les capabilities et schémas d'événements au boot (`provideCapability`, `registerEventSchema`).
- Contribuer les slots UI via `frontend/src/index.ts`.
- Persister via `DatabasePort` en priorité, avec fallback in-memory uniquement lorsqu'aucun adapter n'est fourni.
- Garantir la complétude et la cohérence des fiches vendables.
- Gérer les variantes, options et caractéristiques uniquement comme propriétés descriptives/configurables du vendable, sans leur attribuer de prix, de stock ou d'état d'inventaire.
- Fournir les informations nécessaires à la présentation, au référencement et à la recherche des vendables.

---

## Interactions

`portfolio` est monté sur `RuntimeKernel` via un conteneur enfant par tenant.

Les communications inter-applications se font exclusivement par :
- capabilities ;
- événements.

Aucun import direct inter-applications.

L'infrastructure est consommée exclusivement via des ports/adapters.

---

## Données possédées — source de vérité

### Fiche vendable
`portfolio` est source de vérité pour les informations intrinsèques du vendable :
- identité ;
- type/nature du vendable ;
- nom et descriptions ;
- attributs ;
- caractéristiques ;
- spécifications ;
- unités et valeurs descriptives ;
- taxonomie et catégorisation ;
- tags ;
- médias et références de médias ;
- SEO ;
- slug ;
- traductions FR/EN/AR ;
- statut éditorial ;
- complétude ;
- métadonnées nécessaires à la présentation et à la recherche.

### Variantes
Lorsque le vendable possède des variantes, `portfolio` peut gérer :
- l'identité de la variante ;
- ses attributs de différenciation ;
- ses caractéristiques ;
- ses spécifications ;
- ses médias ;
- ses contenus localisés ;
- ses métadonnées descriptives.

Une variante dans `portfolio` reste une définition descriptive.
Elle ne contient pas :
- de prix ;
- de stock ;
- de quantité disponible ;
- d'inventaire ;
- de réservation ;
- de coût ;
- de marge ;
- d'état commercial d'une offre.

### Options et configurations
Lorsque applicable, `portfolio` peut définir :
- les options disponibles ;
- les valeurs/options possibles ;
- les contraintes de compatibilité ;
- les caractéristiques résultant d'une configuration ;
- les informations descriptives nécessaires à la présentation.

Ces informations décrivent ce que le vendable peut proposer.
Elles ne déterminent pas :
- le prix ;
- le stock ;
- la disponibilité réelle ;
- les quantités réservables ;
- les règles de vente ;
- le panier ou la commande.

### Recherche et complétude
`portfolio` possède les données nécessaires pour :
- calculer la complétude des fiches ;
- indexer les informations descriptives ;
- permettre la recherche et les facettes ;
- identifier les fiches incomplètes ou incohérentes.

L'index de recherche ne doit pas devenir une source de vérité commerciale.

---

## Données explicitement exclues

`portfolio` ne possède et ne gère pas :
- prix de vente ;
- prix catalogue de référence lorsqu'il a une finalité commerciale ;
- promotions ;
- remises ;
- devis ;
- coûts ;
- marges ;
- stock ;
- inventaire ;
- quantité disponible ;
- quantité réservée ;
- mouvements de stock ;
- entrepôts ;
- emplacements de stock ;
- réapprovisionnement ;
- réservations ;
- disponibilité commerciale ;
- panier ;
- commandes ;
- lignes de commande ;
- paiements ;
- expédition.

Toute donnée dont la finalité principale est de répondre à « combien cela coûte ? », « combien est disponible ? » ou « puis-je effectivement l'acheter maintenant ? » appartient à Commerce ou à un autre bounded context commercial approprié.

---

## Références externes — par ID, jamais de jointure

Les autres applications référencent les vendables `portfolio` par ID.
Notamment :
- Commerce référence les vendables pour construire ses offres commerciales ;
- Solara référence les vendables dans ses publications ;
- Spaces référence les vendables dans ses catalogues.

`portfolio` ne récupère pas les données commerciales de ces applications pour enrichir ou calculer ses propres fiches.
Les médias sont référencés via `StoragePort` ; le CDN relève de la présentation.

---

## Frontière Vendable / Offre

### Vendable
Le vendable est la définition PIM de ce qui peut être proposé à la vente.
Exemples :
- « T-shirt modèle X » ;
- « Consultation 60 minutes » ;
- « Expérience randonnée désert » ;
- « Pack de ressources numériques ».

Le vendable peut posséder des variantes, options et caractéristiques.

### Offre
L'offre est l'objet commercial permettant effectivement de vendre un vendable.
Elle appartient à Commerce et peut notamment déterminer :
- le prix ;
- la devise ;
- la disponibilité ;
- le stock applicable ;
- les règles commerciales ;
- les conditions de vente ;
- les contraintes d'achat.

Une offre peut référencer un vendable `portfolio` sans que `portfolio` connaisse ou possède les données de cette offre.

---

## Invariants de frontière — ADR-0016

1. **Fiche ≠ offre.** `portfolio` décrit et normalise le vendable. Commerce porte l'offre commerciale.
2. **Vendable ≠ stock.** Un vendable peut exister sans stock. Le stock n'est jamais une propriété du vendable.
3. **Vendable ≠ prix.** Un vendable peut exister sans prix. Le prix de vente n'est jamais une propriété du vendable.
4. **Variante ≠ offre commerciale.** Une variante décrit une déclinaison du vendable. Son prix, son stock et sa disponibilité commerciale sont déterminés hors de `portfolio`.
5. **Option ≠ supplément tarifaire.** `portfolio` peut définir qu'une option existe. Toute tarification ou disponibilité associée à cette option relève de Commerce.
6. **Fiche ≠ achetabilité.** Une fiche peut être brouillon, publiée, archivée ou simplement informative. Sa présence dans `portfolio` ne signifie pas qu'elle est achetable.
7. **Aucune donnée commerciale dérivée dans le PIM.** `portfolio` ne recopie pas le prix, le stock ou la disponibilité depuis Commerce.

---

## Règle de décision pour les nouveaux champs

Avant d'ajouter un champ à `portfolio`, déterminer sa finalité :
- Si le champ décrit ce qu'est le vendable → `portfolio`.
- Si le champ décrit ses caractéristiques, variantes ou options → `portfolio`.
- Si le champ répond à *combien ça coûte ?* → Commerce.
- Si le champ répond à *combien est disponible ?* → Commerce / Inventory.
- Si le champ répond à *peut-on l'acheter maintenant ?* → Commerce.
- Si le champ répond à *combien a-t-on en stock ou où ?* → Inventory.
- Si le champ répond à *quelle offre commerciale appliquer ?* → Commerce.

En cas d'ambiguïté, le champ ne doit pas être ajouté à `portfolio` tant que sa responsabilité n'est pas explicitement attribuée à un bounded context.

---

## Wizards, imports et exports

Les `product-wizard` et outils d'import/export de `portfolio` peuvent créer et enrichir les données PIM.
Ils ne doivent pas :
- valider un prix de vente ;
- valider une quantité de stock ;
- créer ou modifier un inventaire ;
- calculer une valorisation de stock ;
- appliquer une règle commerciale.

Les imports historiques contenant des champs `price`, `stock` ou `inventory` doivent les ignorer, les rejeter ou les migrer vers les systèmes propriétaires concernés selon la stratégie de migration définie.

---

## Analytics

`portfolio` peut produire des analytics concernant ses propres données PIM, notamment :
- complétude ;
- qualité des fiches ;
- couverture des traductions ;
- qualité des attributs ;
- usage des taxonomies ;
- qualité des médias ;
- qualité de recherche.

Il ne calcule pas :
- chiffre d'affaires ;
- marge ;
- valorisation du stock ;
- rotation du stock ;
- taux de rupture ;
- revenu par produit ;
- performance commerciale fondée sur le prix ou les commandes.

Les analytics commerciaux appartiennent aux applications concernées.

---

## Alertes

`portfolio` peut générer des alertes liées à la qualité et à la complétude des données, par exemple :
- fiche incomplète ;
- traduction manquante ;
- caractéristique obligatoire absente ;
- média manquant ;
- taxonomie incohérente.

Les alertes de :
- restock ;
- rupture ;
- seuil de stock ;
- disponibilité commerciale ;
ne relèvent pas de `portfolio`.

---

## Écarts cible-vs-réel

### Décision d'architecture
L'écart identifié est tranché en faveur du PIM pur.

Les propriétés suivantes sont interdites dans le modèle métier de `portfolio` :
- `stock` ;
- `inventory` ;
- `pricing.basePrice` ;
- tout équivalent sémantique de prix commercial ;
- tout équivalent sémantique de disponibilité ou quantité commerciale.

En conséquence :
- `vendable.ts` doit être débarrassé de `stock`, `inventory` et `pricing.basePrice` ;
- `product-wizard` ne doit plus valider prix ou stock ;
- `shop-inventory-report` ne doit plus appartenir à `portfolio` ;
- les fonctionnalités de restock doivent être supprimées ou déplacées vers le bounded context responsable de l'inventaire ;
- les données commerciales historiques doivent être migrées vers Commerce/Inventory selon leur nature.

### Aucune « prix catalogue de référence » dans portfolio
Le concept de « prix catalogue de référence » n'est pas introduit dans `portfolio`.
Même s'il est présenté comme informatif, un prix reste une donnée commerciale et crée une ambiguïté entre fiche et offre.
Si un futur besoin nécessite un prix de référence non commercial, celui-ci devra faire l'objet d'un ADR spécifique démontrant qu'il ne constitue ni un prix de vente, ni une donnée d'offre, ni une donnée de tarification.

---

## Frontières

- Aucun import depuis une autre app.
- Aucun accès infrastructure direct hors ports.
- Aucune route sans autorisation.
- Aucune donnée de prix dans le domaine `portfolio`.
- Aucune donnée de stock ou d'inventaire dans le domaine `portfolio`.
- Aucune logique d'achetables/achetabilité dans le domaine `portfolio`.
- Aucune duplication de données commerciales provenant de Commerce ou Inventory.
- Les références inter-apps sont uniquement par ID et capabilities/événements.

---

## Non-responsabilités

`portfolio` ne :
- réimplémente pas le kernel ;
- réimplémente pas le gateway ;
- réimplémente pas les adapters ;
- ne gère pas les prix ;
- ne gère pas le stock ;
- ne gère pas l'inventaire ;
- ne gère pas les réservations ;
- ne gère pas les commandes ;
- ne gère pas les paiements ;
- ne gère pas les promotions ;
- ne gère pas la disponibilité commerciale ;
- n'expose pas de secret.

---

## Critères de santé

- [x] Conforme à `pnpm check:conformance`.
- [x] Conforme à `pnpm check:manifests`.
- [x] Tests de domaine verts (`*.test.ts`).
- [x] OpenAPI généré sans erreur.
- [x] Aucun champ `price`, `pricing`, `stock` ou `inventory` dans les entités métier de `portfolio`.
- [x] Aucun use-case `portfolio` ne dépend d'une donnée commerciale d'exécution.
- [x] `product-wizard` ne valide ni prix ni stock.
- [x] Les fonctionnalités d'inventaire/restock ont été supprimées ou déplacées.
- [x] Les variantes et options restent purement descriptives/configuratives.
- [x] Commerce peut référencer un vendable `portfolio` sans dépendance inverse.
- [x] Une fiche `portfolio` peut exister sans aucune offre commerciale associée.
