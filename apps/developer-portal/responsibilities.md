# @ijideals/developer-portal — Responsabilités

Universal Developer Portal (Option C) : porte d'entrée des développeurs
internes et tiers dans l'écosystème IJIDeals / MosaiX.

## Périmètre

- **Discovery** : projection du catalogue (BACs, apps, packages, APIs).
- **Documentation** : guides, références et documentation versionnée.
- **Publishing** : soumission, validation et publication de ressources.
- **Governance** : éditeurs, politiques de publication et audit.

## Frontières (BOUND)

- Ne gère **pas** l'identité → déléguée à Citadelle (`IdentityPort`).
- Ne remplace **pas** les registres BAC / packages → projections uniquement.
- N'exécute **pas** les BACs.
- Ne gère **pas** les déploiements ni la facturation.
- N'introduit **pas** de second Event Bus.
- N'est **pas** une dépendance obligatoire des autres applications.

## Dépendances sortantes (ports)

- `CatalogRepository` (projection locale, propriété du BAC)
- `ResourceRegistryPort` (registre BAC, lecture seule)
- `PackageRegistryPort` (registre packages, lecture seule)
- `IdentityPort` / `AuthorizationPort` (Citadelle)
