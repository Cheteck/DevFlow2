# MosaiX Imperia

MosaiX Imperia est l'application de Bounded Context dédiée à la **gouvernance globale** et au **contrôle de la plateforme MosaiX**.

## Responsabilités

- **Inspection de la Topologie** : Supervision des applications, manifests et résolutions de routes de la plateforme.
- **Audit & Conformité** : Centralisation des journaux d'audit et vérification du respect des politiques de sécurité.
- **Gestion des Politiques** : Administration globale des politiques d'accès (`Policy` & `Guard`).
- **Supervision du Control Plane** : Inspection des files de messages mortes (DLQ), disjoncteurs (`CircuitBreakers`) et santé du runtime.

## Architecture & Structure

```
apps/imperia/
├── mosaix.json                 # Manifest officiel du Bounded Context Imperia
├── package.json                # Dépendances et métadonnées
├── tsconfig.json               # Configuration TypeScript composite
├── frontend/
│   └── src/index.ts            # Point d'entrée des slots UI et I18n d'Imperia
└── src/
    ├── composition-root.ts     # Wiring unique (Container & Router)
    ├── index.ts                # Ré-exportation canonique
    ├── domain/                 # Entités et agrégats de gouvernance
    └── infrastructure/
        └── imperia-controller.ts # Contrôleur HTTP d'administration/gouvernance
```
