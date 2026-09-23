# MosaiX Beam — Messagerie Instantanée Type Messenger

MosaiX Beam est la Bounded Application Context dédiée à la **messagerie instantanée en temps réel**, aux discussions de groupe et aux échanges directs entre utilisateurs de la plateforme MosaiX.

## Responsabilités

- **Conversations & Fils de Discussion** : Création de discussions directes (1:1) et de canaux de groupe.
- **Messages Instantanés** : Envoi de messages texte, métadonnées et horodatage.
- **Gouvernance & Conformité** : Modération des messages et intégration avec MosaiX Imperia.

## Architecture

```
apps/beam/
├── mosaix.json                 # Manifest de l'application Beam
├── package.json                # Dépendances du Bounded Context
├── tsconfig.json               # Configuration TS composite
├── frontend/
│   └── src/index.ts            # Extensions UI et pages d'administration Beam
└── src/
    ├── domain/                 # Models ORM (Conversation, Message) et Service métier
    ├── infrastructure/         # Contrôleur HTTP REST
    ├── composition-root.ts     # Wiring Container & Router
    └── index.ts                # Point d'entrée principal
```
