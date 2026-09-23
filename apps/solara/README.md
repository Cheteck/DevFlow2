# MosaiX Solara — Moteur d'Activités Sociales Agnostique

MosaiX Solara est la Bounded Application Context dédiée aux **activités sociales et d'engagement** sur la plateforme MosaiX.

## Caractéristiques Principales

- **Acteur Agnostique** : Tout acteur (`user`, `space`, `organization`, `system`) peut publier, commenter, réagir et suivre.
- **Extensibilité par Plugins** : Architecture extensible via les plugins du répertoire `plugins/` (ex: `solara-content-moderator`).

## Architecture & Structure

```
apps/solara/
├── prd-solara.md               # Spécification PRD
├── mosaix.json                 # Manifest officiel du Bounded Context Solara
├── package.json                # Dépendances et scripts
├── tsconfig.json               # Configuration TS composite
├── frontend/
│   └── src/index.ts            # Extension UI et slots d'administration
└── src/
    ├── domain/                 # Modèles ORM (Post, Comment, Reaction, Follower) & SolaraSocialService
    ├── infrastructure/         # SolaraController REST
    ├── composition-root.ts     # Injection Container & Router
    └── index.ts                # Point d'entrée principal
```
