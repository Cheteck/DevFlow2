# Audit Topologie Microfrontends (Microfrontends Topology)

- **Auteur :** MFE Topology Expert & Transformation Architect
- **Date :** 2026-09-19
- **Statut :** Complété
- **Niveau de Confiance :** Élevé

---

## 1. Inventaire & Cartographie des Microfrontends (BACs & Plugins)

| MFE / Extension | Type | Slot d'Injection / Emplacement | Mode d'Assoc. | Dépendances Clés |
|---|---|---|---|---|
| **Shell Host** (`src/`) | Host Application | Racine `/` (Layout App) | Native/Static | `@mosaix/sdk`, `@mosaix/ui-runtime` |
| **Solara MFE** (`apps/solara`) | App / Remote | `shell.home.widgets` (Composer & Showcase) | Slot Registry | `SolaraSocialService`, `@mosaix/commands` |
| **Beam MFE** (`apps/beam`) | App / Remote | `shell.home.widgets`, `shell.usermenu.actions` | Slot Registry | `BeamMessagingService` |
| **Commerce MFE** (`apps/commerce`) | App / Remote | `shell.home.widgets` (Daily Deal) | Slot Registry | `CommerceService`, `OrderModel` |
| **Imperia MFE** (`apps/imperia`) | App / Remote | `shell.usermenu.actions` (Org Switcher) | Slot Registry | `ImperiaGovernanceService` |
| **Identity MFE** (`apps/identity`) | App / Remote | `shell.usermenu.actions` (Security Settings) | Slot Registry | `AuthManager`, `LocalPasswordProvider` |
| **Spaces MFE** (`apps/spaces`) | App / Remote | Navigation `/spaces` | Router Registry | `SpaceService`, `DatabasePort` |
| **Solidarity MFE** (`apps/solidarity`) | App / Remote | Navigation `/solidarity` | Router Registry | `SolidarityService` |
| **Portfolio MFE** (`apps/portfolio`) | App / Remote | Navigation `/portfolio` | Router Registry | `PortfolioService`, `VendableRepository` |
| **Booking MFE** (`apps/booking`) | App / Remote | Navigation `/booking` | Router Registry | `BookingService` |
| **Commerce Plugins** (5 plugins) | UI Extensions | Commerce Views / Product Cards | Plugin Engine | `@mosaix/plugin-engine` |

---

## 2. Analyse de l'Orchestration Runtime & Contrats Inter-MFE

### Communication Inter-MFE (Event Bus & Shared State)
1. **Événements In-Process & BroadcastChannel :** Les microfrontends communiquent via le `CommandBus` de `@mosaix/commands` et le bus d'événements `@mosaix/events`.
2. **Gestion du Contexte Utilisateur (Shared Session) :** Le contexte d'authentification (`sub`, `roles`, `tenantId`) est injecté au niveau du Shell Host par le JWT Middleware et propagé dans `HttpRequest` vers chaque contrôleur de MFE.

### Points Critiques de la Topologie
- **Risque d'Incompatibilité de Versions de Dépendances (Dependency Drift) :** Les microfrontends partagent le monorepo, mais sans vérification stricte de compatibilité sémantique (semver) lors de l'exécution dynamique si un plugin externe est chargé.
- **Cascade d'Erreurs de Rendu (UI Cascade Failure) :** Un crash JS non capturé dans le composant d'affichage d'un MFE (ex: `solara:post-types-showcase-widget`) peut faire planter l'intégralité du rendu HTML de la page si un Error Boundary d'emplacement n'est pas présent.

---

## 3. Stratégie Cible d'Évolution de la Topologie MFE

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Target MFE Federation Architecture               │
│                                                                        │
│   ┌────────────────┐      ┌────────────────┐      ┌────────────────┐   │
│   │   Shell Host   │      │   Solara Remote│      │   Beam Remote  │   │
│   │   (App Container)│     │   (Bundle / JS)│      │   (Bundle / JS)│   │
│   └───────┬────────┘      └───────┬────────┘      └───────┬────────┘   │
│           │                       │                       │            │
│           ▼                       ▼                       ▼            │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │           Import Maps & Dynamic Remote Loader                  │   │
│   │    - Isolating Error Boundaries per Slot                       │   │
│   │    - Fallback UI on Remote Disruption                           │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Isolation par Error Boundary d'Emplacement :** Chaque contribution injectée dans un slot UniTheme doit être entourée d'un `try/catch` de rendu avec composant de repli (Fallback UI).
2. **Import Maps & Versioning Asynchrone :** Mettre en place un registre d'Import Maps centralisé pour permettre le rechargement à chaud d'un microfrontend sans redémarrer le Shell Host.
