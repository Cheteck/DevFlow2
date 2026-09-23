# MosaiX Spaces — Espaces Modulaires & Pages Entreprises

MosaiX Spaces est la Bounded Application Context dédiée à la création et gestion d'**espaces virtuels modulaires** (concept similaire aux Facebook Pages et Google Business Profiles).

## Modules Pluggables Supportés

- **Commerce** (`commerce`) : Vitrine de produits/services via `@apps/portfolio` et `@apps/commerce`.
- **Événements** (`events`) : Billetterie et agendas d'événements.
- **Réservations** (`bookings`) : Prise de rendez-vous en ligne.
- **Messenger** (`messenger`) : Canal de discussion directe via `@apps/beam`.
- **Contenu** (`content`) : Fil d'actualités et publications.

## Architecture & Structure

```
apps/spaces/
├── prd-spaces.md               # Spécification PRD complète
├── mosaix.json                 # Manifest du Bounded Context
├── package.json                # Métadonnées et dépendances
├── tsconfig.json               # Configuration TS composite
├── frontend/
│   └── src/index.ts            # Extensions UI pour Imperia et le Shell
└── src/
    ├── domain/                 # SpaceModel et SpaceManagementService
    ├── infrastructure/         # SpaceController REST
    ├── composition-root.ts     # Injection IoC Container & Router
    └── index.ts                # Point d'entrée principal
```
