# Audit Architecture de Plateforme (Platform Architecture)

- **Auteur :** Platform Architecture Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé (Basé sur le code source, pnpm workspaces, gateway pipelines et runtime specs)

---

## 1. Topologie Globale & Architecture Monorepo

La plateforme **MosaiX / IJIDeals** est structurée sous la forme d'un Monorepo TypeScript/Node.js orchestrait par **pnpm workspaces**. Elle regroupe :
- **32 packages noyau** sous `/packages/` (`@mosaix/sdk`, `@mosaix/gateway`, `@mosaix/container`, `@mosaix/ui-runtime`, `@mosaix/orchestration`, `@mosaix/events`, `@mosaix/auth`, etc.)
- **9 applications métier (BAC - Business Application Components)** sous `/apps/` (`solara`, `beam`, `commerce`, `identity`, `imperia`, `spaces`, `solidarity`, `portfolio`, `booking`)
- **5 plugins d'extension UI** sous `/plugins/` (`commerce-badge-plugin`, `commerce-reviews-plugin`, `commerce-wishlist-plugin`, etc.)
- **1 Shell Application (Composition Host)** sous `/src/` avec un point d'entrée HTTP (`src/start.ts`, `src/index.ts`).

### Schéma de Topologie Runtime

```
[ Client Browser / IFrame ]
            │ (HTTP / WS Port 3000)
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MosaiX Gateway & Shell Host                      │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Gateway Pipeline (CORS, RateLimiter, SecurityHeaders, JWT Auth)    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Shell UI Renderer & UniTheme Engine (SSR / Slot Composition)      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  BAC Solara  │             │   BAC Beam   │             │ BAC Commerce │
│ (Réseau Soc) │             │ (Messagerie) │             │  (E-Commerce)│
└──────────────┘             └──────────────┘             └──────────────┘
      │                            │                            │
      └────────────────────────────┼────────────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Noyau Partagé & Persistance                      │
│ ┌───────────────────────────┐ ┌──────────────────────────────────────┐ │
│ │ Postgres / SQLite ORM     │ │ Outbox Message Bus & Redis Caching   │ │
│ └───────────────────────────┘ └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Évaluation des Domaines & Bounded Contexts

### Points Forts
1. **Isolation des Bounded Contexts :** Chaque BAC possède son propre sous-dossier, son propre `mosaix.json`, son propre `CompositionRoot` et sa couche domaine isolée.
2. **Abstractions par Ports & Adaptateurs (Hexagonal Architecture) :** Les dépendances vers les bases de données et les brokers de messages passent par `@mosaix/ports-database` et `@mosaix/events`.
3. **Contrats d'Interfaces Typés :** Le package `@mosaix/sdk` expose un point d'accès unifié pour tous les BACs, évitant le couplage direct inter-packages.

### Dysfonctionnements et Violations Constatées
1. **Couplage du Boot centralisé (`src/start.ts`) :** La Shell Host instancie manuellement tous les BACs et leurs `ServiceProviders` dans une séquence monolithique. Si un BAC échoue son enregistrement, l'intégralité du serveur s'arrête.
2. **Absence de chargement dynamique de Remotes (Remote Loading) :** Les microfrontends et composants BACs sont compilés statiquement avec le Shell Host plutôt que d'être distribués sous forme de bundles distants autonomes (Module Federation / Import Maps).

---

## 3. Analyse du Runtime Composition & Slot Architecture

Le moteur UniTheme (`@mosaix/ui-runtime`) utilise une architecture par emplacements (**Slots & Contributions**) :
- **Slots définis :** `shell.home.widgets`, `shell.usermenu.actions`, `shell.navigation.main`.
- **Mécanisme d'overrides :** Les réorganisations de grilles et de styles sont enregistrées dynamiquement dans `/.mosaix/composition-overrides.json` et servies via `/api/composition/override`.

### Risques d'Architecture
- **Absence de Sandbox Isolation (Shadow DOM / Iframe CSS Isolation) :** Les contributions de blocs partagent le même contexte CSS global et la même mémoire JS. Un composant malveillant ou défaillant peut impacter l'ensemble du DOM.

---

## 4. Recommandations d'Architecture de Plateforme

1. **Isolation par Circuit Breaker au Boot :** Isoler l'initialisation de chaque BAC via un wrapper d'enregistrement tolérant aux pannes (`tryRegisterBac(app)`).
2. **Déploiement Découplé des Remotes (Native Federation / Import Maps) :** Évoluer vers un chargement asynchrone des composants MFE via HTTP pour permettre des déploiements indépendants par équipe.
3. **Standardisation du Registre de Capacités (Capability Registry) :** Automatiser la découverte des routes et des widgets exposés par chaque BAC au démarrage via `@mosaix/orchestration`.
