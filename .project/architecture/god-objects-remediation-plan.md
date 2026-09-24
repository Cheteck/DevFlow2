# Analyse des God Objects et Plan de Remédiation Architectural
**Date :** 2026-09-24  
**Projet :** MosaiX / IJIDeals  
**Statut :** Plan Directeur de Refactoring & Découplage  

---

## 1. Cartographie et Diagnostic des God Objects

L'analyse statique du monorepo identifie **5 fichiers monolithiques critiques** cumulant trop de responsabilités divergentes (Violation du principe de responsabilité unique - *SRP*, couplage fort, maintenabilité dégradée, risque élevé de régression).

### Tableau des Fichiers Identifiés

| Fichier | Lignes | Complexité | Responsabilités Cumulées (Anti-Patterns) |
|---|---|---|---|
| `src/start.ts` | **2 126** | **Critique (P0)** | Serveur HTTP + Routeur API + Gate Maintenance + Assemblage SSR + Parsing URL + Gestion Cookies & Rôles + Injection CSS/Thèmes + Webhooks PSP. |
| `apps/imperia/frontend/src/index.ts` | **1 785** | **Critique (P0)** | 11 onglets d'administration distincts (Users, Portfolio, Spaces, Commerce, Federation, Subscriptions, Theme Editor, Feature Flags, Compliance, Logs) générant du HTML/JS en un seul bloc. |
| `src/shell/renderer.ts` | **1 128** | **Élevé (P1)** | Rendu de tous les composants shell (Sidebar principale/secondaire, Command Palette, Dev Inspector, User Switcher, Mobile Drawer, Toasts, Header, Badges). |
| `apps/beam/frontend/src/index.ts` | **1 010** | **Élevé (P1)** | Liste de contacts, threads de conversation directs, compositeur de messages riches, lecteur vocal, statuts de chiffrement E2E, sélecteur de bots. |
| `apps/portfolio/src/domain/portfolio-service.ts` | **628** | **Moyen (P2)** | CRUD vendables, moteur de recherche et filtrage, parsing CSV RFC4180, transitions de workflow de publication, gestion des variantes et médias. |

---

## 2. Analyse Détaillée par God Object

### 🚨 2.1 `src/start.ts` (2 126 lignes) — Le Monolithe d'Exécution
- **Diagnostic** : Le point d'entrée du serveur Node.js gère à la fois les routes HTTP d'API (`/api/theme`, `/api/user/switch`, `/api/feature-flags/*`, `/api/composition/*`, `/api/auth/*`), la composition SSR modulaire, les en-têtes de sécurité, et l'injection de scripts inline.
- **Risques** :
  - Chaque modification d'une route API risque de casser le serveur SSR.
  - Impossibilité de tester unitairement les routes HTTP sans lancer l'ensemble du serveur.
  - Duplication de la gestion des erreurs HTTP.

### 🚨 2.2 `apps/imperia/frontend/src/index.ts` (1 785 lignes) — La Console Géante
- **Diagnostic** : Ce fichier concentre la totalité de l'IHM du Control Plane de la plateforme. Chaque onglet possède des centaines de lignes de gabarit HTML interpolé.
- **Risques** :
  - Illisibilité et temps de review de PR prohibitif.
  - Risques accrus de régression XSS lors des interpolations manuelles.
  - Impossibilité de charger ou modifier un panneau d'administration de manière isolée.

### ⚠️ 2.3 `src/shell/renderer.ts` (1 128 lignes) — L'Usine à Composants Shell
- **Diagnostic** : Contient tous les éléments visuels réutilisables du layout shell (sidebars, modales, tiroirs, widgets).
- **Risques** :
  - Couplage fort entre composants indépendants (ex: la Command Palette dépend du même fichier que le User Switcher).
  - Difficulté à faire évoluer les thèmes ou les variantes d'IHM.

---

## 3. Plan de Remédiation Optimisé (Architecture Cible & Bonnes Pratiques)

```
                       ARCHITECTURE DÉCOUPLÉE CIBLE
                       
     ┌────────────────────────────────────────────────────────┐
     │                      src/start.ts                      │
     │   (Bootstrap minimal, écoute port 3000, middleware)    │
     └───────────┬────────────────────────────────┬───────────┘
                 │                                │
                 ▼                                ▼
     ┌───────────────────────┐        ┌───────────────────────┐
     │    src/server/api/    │        │   src/shell/views/    │
     │  (Routeurs modulaires │        │ (Composants visuels   │
     │   par domaine d'API)  │        │  atomiques et purs)   │
     └───────────────────────┘        └───────────────────────┘
```

### Étape 1 : Décomposition de `src/start.ts` (P0)
1. **Création d'un routeur HTTP modulaire (`src/server/router.ts`)** :
   - Extraire les contrôleurs API dans `src/server/routes/` :
     - `auth-routes.ts` (`/api/auth/*`, wizard d'inscription).
     - `theme-routes.ts` (`/api/theme`).
     - `feature-flag-routes.ts` (`/api/feature-flags/*`).
     - `composition-routes.ts` (`/api/composition/*`).
     - `webhook-routes.ts` (`/api/webhooks/psp/*`).
2. **Extraction du middleware de maintenance (`src/server/middleware/maintenance-gate.ts`)** :
   - Isoler l'intercepteur 503 et la vérification des rôles exemptés (`platform-admin`, `imperia`).
3. **Résultat attendu** : `src/start.ts` réduit à **< 150 lignes** (uniquement bootstrapping, configuration et initialisation).

---

### Étape 2 : Modularisation d'Imperia Frontend (P0)
Découper `apps/imperia/frontend/src/` par onglet métier :
```
apps/imperia/frontend/src/
├── index.ts                      (Router d'onglets & layout principal, < 120 lignes)
├── components/
│   ├── imperia-header.ts
│   └── imperia-tab-nav.ts
└── tabs/
    ├── overview-tab.ts           (Métriques et santé système)
    ├── users-citadelle-tab.ts    (Gestion des utilisateurs et rôles)
    ├── portfolio-tab.ts          (Catalogue et modération produits)
    ├── spaces-tab.ts             (Organisations et registre légal)
    ├── commerce-tab.ts           (Commandes et logistique)
    ├── theme-editor-tab.ts       (Éditeur de variables CSS & thèmes)
    ├── feature-flags-tab.ts      (Gestion des bascules de fonctionnalités)
    └── compliance-audit-tab.ts   (Rapports SOC2 / ISO / OPA)
```

---

### Étape 3 : Décomposition de `src/shell/renderer.ts` (P1)
Découper `src/shell/renderer.ts` en composants atomiques dans `src/shell/components/` :
```
src/shell/components/
├── navigation/
│   ├── primary-sidebar.ts
│   ├── secondary-sidebar.ts
│   └── mobile-drawer.ts
├── overlays/
│   ├── command-palette-modal.ts
│   ├── dev-inspector-drawer.ts
│   └── toast-container.ts
├── widgets/
│   ├── user-switcher-widget.ts
│   └── header-controls.ts
└── pages/
    └── maintenance-page.ts
```

---

### Étape 4 : Décomposition de `apps/beam/frontend/` (P1)
Isoler les sous-vues de Beam :
```
apps/beam/frontend/src/
├── index.ts                      (Assemblage IHM Beam)
├── components/
│   ├── conversation-list.ts      (Liste des discussions actives)
│   ├── message-thread.ts         (Flux de messages chiffrés)
│   ├── message-composer.ts       (Zone de saisie et envoi de pièces jointes)
│   ├── voice-note-player.ts      (Lecteur audio compact)
│   └── bot-commands-picker.ts    (Menu de commandes)
```

---

### Étape 5 : Extraction du Parser CSV dans Portfolio (P2)
- Extraire la logique RFC4180 de `apps/portfolio/src/domain/portfolio-service.ts` vers un utilitaire dédié `apps/portfolio/src/domain/csv-parser.ts`.
- Isoler les validateurs de transition d'état dans `apps/portfolio/src/domain/vendable-workflow.ts`.

---

## 4. Matrice d'Impact et Bénéfices

| Axe | Avant Refactoring | Après Remédiation |
|---|---|---|
| **Testabilité** | Tests d'intégration lourds, IHM non isolable | Tests unitaires fins sur chaque routeur et onglet |
| **Sécurité (XSS)** | Risque d'oubli de sanitisation dans les gros fichiers | Sanitisation systématique et vérifiable par composant |
| **Vitesse de Build / HMR** | Recompilation monolithique | Rechargement rapide et granularité des modules |
| **Expérience Développeur** | Fichiers de 2000+ lignes difficiles à naviguer | Modules clairs de 80 à 250 lignes par fichier |

---

## 5. Calendrier d'Exécution Recommandé

1. **Phase 1 (Immédiate)** : Extraction des routes API et du middleware de `src/start.ts` vers `src/server/`.
2. **Phase 2** : Découpage des onglets d'administration d'`apps/imperia/frontend/`.
3. **Phase 3** : Modularisation de `src/shell/renderer.ts` en sous-composants.
4. **Phase 4** : Découpage de `apps/beam/frontend/` et extraction du parser CSV de `portfolio-service.ts`.
