# Responsabilités — app inventory

| Champ | Valeur |
| --- | --- |
| Nom | `@apps/inventory` |
| Version | `voir package.json` |
| Couche | Application BAC (Layer 7) — Stock, niveaux & réapprovisionnement |

## Raison d'être

`inventory` est le bounded context des ressources physiques stockées.

Il suit les niveaux de stock, les réservations de quantités et les signaux de réapprovisionnement, sans jamais porter de prix : la valorisation monétaire appartient à Commerce/Billing, qui possèdent les prix.

**Principe directeur : `inventory` répond à « combien en avons-nous, où, et quelle quantité est disponible ? » — jamais « combien cela coûte ? ».**

## Responsabilités

- Respecter le schéma canonique (`mosaix.json`, `src/index.ts`, `domain/`, `application/`, `infrastructure/`, `presentation/`).
- Déclarer les capabilities versionnées et les schémas d'événements ; les enregistrer au boot.
- Suivre les positions de stock (`sku`, quantité disponible, seuil) fournies par les systèmes détenteurs via un port (`StockSource`).
- Enregistrer les visites en rupture et les souscriptions d'alerte restock.
- Produire des rapports de niveaux et des demandes de réapprovisionnement (quantités uniquement).
- Émettre `inventory.stock.depleted` / `inventory.restock.requested` à destination de Commerce et Notifications.

## Données possédées — source de vérité

- positions de stock (`sku`, `onHand`, `reorderPoint`) ;
- visites en rupture ;
- souscriptions d'alerte restock ;
- alertes quantitatives (`out_of_stock`, `critical_low`, `reorder_recommended`).

## Données explicitement exclues

- prix, devise, valorisation, marge, revenu manqué estimé → Commerce/Billing ;
- offres, commandes → Commerce ;
- envoi de notifications → Notifications.

## Frontières

- Aucun import depuis une autre app.
- Aucun accès infrastructure direct hors ports.
- Aucune route sans autorisation.
- Aucun prix dans Inventory.
- Les références inter-apps sont uniquement par ID et capabilities/événements.

## Critères de santé

- [ ] Conforme à `pnpm check:conformance` + `check:manifests`.
- [ ] Tests de domaine verts (`*.test.ts`).
- [ ] Aucun champ prix/marge/valorisation dans le domaine.
- [ ] Le rapport ne contient que des quantités.
