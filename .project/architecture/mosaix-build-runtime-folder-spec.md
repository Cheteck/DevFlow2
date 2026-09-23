# MosaiX Architecture Specification — Le Dossier `.mosaix` & La Stratégie `node_modules` Unifié

**Auteur :** Jules, Gardien de l'Architecture MosaiX
**Statut :** Spécification d'Architecture Officielle
**Version :** 1.0
**Inspiration :** Principes Vercel/Next.js adaptés à NestJS et aux Monorepos d'Entreprise

---

## 1. Vision et Objectifs Principaux

Dans l'écosystème Next.js/Vercel, le répertoire `.next` agit comme le **centre névralgique de compilation, de cache et d'exécution runtime**. Pour le framework **MosaiX** (conçu pour orchestrer des plateformes d'applications modulaires autonomes basées sur NestJS / Node.js), nous adaptons cette philosophie en instaurant un répertoire interne standardisé nommé **`.mosaix`**.

### Objectifs Clés
1. **Centralisation des Artefacts :** Réunir la totalité des éléments générés (manifestes synthétisés, schémas Zod compilés, tokens de thèmes, bundles d'applications, métriques et caches de build) au sein de `.mosaix/`.
2. **Séparation Stricte :** Maintenir une frontière étanche entre le code source propre (`src/`, `apps/`, `packages/`), les dépendances et les artefacts de build éphémères.
3. **Single Shared `node_modules` :** Garantir la présence d'un **unique dossier `node_modules` à la racine du monorepo**, partagé efficacement entre le framework MosaiX, les applications (BACs), les packages d'infrastructure et les plugins.
4. **Agnostique et Standard Node.js :** Éviter les hacks propriétaires de résolution de modules en s'appuyant sur les standards modernes Node.js ESM, `exports` et pnpm workspaces.

---

## 2. Structure du Monorepo & Anatomie du Dossier `.mosaix`

### A. Structure Globale du Projet

```text
mosaix-platform/
├── .mosaix/                         ◄── Dossier de build & runtime interne (git-ignoré)
├── apps/
│   ├── identity/                    ◄── Bounded Application Context (BAC) Identity
│   │   ├── src/
│   │   └── package.json
│   └── portfolio/                   ◄── BAC Portfolio (PIM)
│       ├── src/
│       └── package.json
├── packages/
│   ├── core/                        ◄── Framework Kernel (@mosaix/core)
│   ├── sdk/                         ◄── Application SDK (@mosaix/sdk)
│   ├── contracts/                   ◄── Domain Contracts (@mosaix/contracts)
│   ├── schemas/                     ◄── Zod Validators (@mosaix/schemas)
│   ├── ports/                       ◄── Infrastructure Ports (@mosaix/ports-*)
│   └── adapters/                    ◄── Production Adapters (@mosaix/adapter-*)
├── plugins/
│   └── analytics/                   ◄── Plugin MosaiX
│       ├── src/
│       └── package.json
├── node_modules/                    ◄── UNIQUE dossier node_modules racine (Symlinked Store)
├── eslint.config.mjs
├── package.json                     ◄── Root Workspace Manifest
├── pnpm-workspace.yaml              ◄── Configuration du workspace
├── tsconfig.build.json
└── tsconfig.json
```

### B. Structure Interne du Dossier `.mosaix`

Le répertoire `.mosaix` est automatiquement généré à la racine par le CLI MosaiX (`mosaix dev` ou `mosaix build`).

```text
.mosaix/
├── cache/                           ◄── Fichiers de cache de build & hashs incrémentaux
│   ├── tsbuildinfo/                 ◄── Information de compilation TypeScript/SWC
│   ├── manifests.json               ◄── Hashs des manifestes applicatifs
│   └── schemas-cache.json           ◄── Caches de validation Zod
├── build/                           ◄── Artefacts de compilation JS/ESM pour dev/test
│   ├── apps/
│   │   ├── identity/
│   │   └── portfolio/
│   ├── packages/
│   └── plugins/
├── manifests/                       ◄── Registre synthétisé de la plateforme
│   ├── aggregated-manifest.json     ◄── Manifeste unifié de tous les BACs enregistrés
│   ├── capabilities-registry.json   ◄── Table de routage des capabilities
│   └── events-registry.json         ◄── Contrats d'événements validés
├── themes/                          ◄── Artefacts de compilation du Theme System V2.1
│   ├── compiled-tokens.json         ◄── Map unifiée des tokens de design
│   └── css-variables.css            ◄── CSS compilé pour le Shell Runtime
├── standalone/                      ◄── Bundle d'exécution de production autonome (mosaix build)
│   ├── server.js                    ◄── Point d'entrée optimisé de production
│   ├── package.json                 ◄── Dépendances strictement nécessaires
│   └── node_modules/                ◄── Symlinks ou pnpm pruned store minimal
└── logs/                            ◄── Métriques et journaux de build/runtime dev
    └── build-trace.json
```

---

## 3. Système de Build, Caches & Gestion des Environnements

### A. Moteur de Compilation (NestJS / SWC / esbuild)
MosaiX s'appuie sur le compilateur **SWC** (Speedy Web Compiler) intégré à NestJS ou **esbuild** pour la synthèse rapide de code TypeScript vers ESM.

- **Phase `mosaix dev` (Développement) :**
  - Surveillance à chaud (watch mode) via SWC.
  - Régénération à la volée du registre des manifestes dans `.mosaix/manifests/` sans redémarrer tout le processus Node.js.
  - Invalidation fine du cache par composant basé sur le hash du contenu (`sha256`).
- **Phase `mosaix build` (Production) :**
  - Compilation stricte typecheck (`tsc --build`) + minification SWC/esbuild.
  - Production du bundle `.mosaix/standalone/` contenant uniquement le nécessaire d'exécution.
- **Phase `mosaix test` (Tests) :**
  - Utilisation des artefacts pré-compilés dans `.mosaix/build/` pour accélérer l'exécution des suites Vitest.

---

## 4. Stratégie du `node_modules` Partagé à la Racine

### A. Étude Comparative des Approches

| Approche | Avantages | Inconvénients | Rétention pour MosaiX |
| :--- | :--- | :--- | :--- |
| **npm workspaces (Hoisting)** | Standard Node.js natif | Risque de Phantom Dependencies (accès à des sous-dépendances non déclarées). | ❌ Rejeté (Manque d'isolation) |
| **Yarn Berry (PnP)** | Zéro `node_modules` sur disque | Incompatibilité fréquente avec certains packages natifs Node.js/NestJS. | ❌ Rejeté (Instabilité écosystème) |
| **pnpm Workspaces (Symlinked Store)** | **Strict isolation, performance I/O ultime, 0 duplication sur disque, gestion native des binaires C++.** | Nécessite la gestion appropriée des symlinks en CI/CD. | **✅ SÉLECTIONNÉ POUR MOSAIX** |

### B. Recommandation MosaiX : pnpm Workspaces
MosaiX impose **pnpm** comme gestionnaire de packages officiel du monorepo.
- Un **seul store global pnpm** sur la machine hôte.
- Un **unique dossier `node_modules` à la racine** du projet, contenant un arbre de liens symboliques (symlinks) rigoureusement vérifiés par pnpm.
- Chaque sous-projet (`apps/*`, `packages/*`, `plugins/*`) ne voit dans son propre scope de résolution que les dépendances explicitement déclarées dans son `package.json`.

---

## 5. Résolution des Modules & Interopérabilité Node.js

Node.js applique l'algorithme standard ESM de résolution de modules. Pour garantir que tous les sous-projets résolvent leurs dépendances depuis le `node_modules` racine sans hacks :

1. **Génération de Path Aliases TypeScript :**
   Le fichier `tsconfig.json` racine définit les aliases de workspace (`@mosaix/core`, `@mosaix/sdk`, etc.) pointant vers les dossiers source `packages/*/src/index.ts` en dev, et vers `dist` en production.
2. **Champ `exports` dans `package.json` :**
   Chaque package du framework déclare des points d'entrée explicites via le champ `exports` standard de Node.js.
3. **Peer Dependencies pour les Singletons de Framework :**
   Les packages clés comme `@mosaix/core`, `@mosaix/contracts`, `zod`, et `@nestjs/common` sont déclarés en `peerDependencies` dans les plugins et applications pour s'assurer qu'un **seul instance singleton** du noyau s'exécute au runtime.

---

## 6. Architecture des Plugins MosaiX

Un plugin MosaiX (`plugins/*`) est un Bounded Extension Context :
- **Déclarations :** Il déclare le framework (`@mosaix/core`, `@mosaix/contracts`) en `peerDependencies`.
- **Dépendances tierces :** Ses dépendances propres (ex: `elasticsearch`, `launchdarkly-node-server-sdk`) sont déclarées dans son `dependencies` propre.
- **Résolution :** Au moment du `pnpm install`, pnpm crée un lien symbolique dans le `node_modules` racine pointant vers le store partagé.
- **Isollement et Conflits de Version :** Grâce à la structure symlinkée de pnpm, deux plugins peuvent utiliser deux versions différentes d'une même bibliothèque tierce (ex: `lodash@4` vs `lodash@3`) sans qu'aucun conflit n'émerge au runtime.

---

## 7. Configuration des `package.json` Exemple

### A. Root `package.json`
```json
{
  "name": "mosaix-platform",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "mosaix dev",
    "build": "mosaix build",
    "start": "mosaix start",
    "clean": "mosaix clean"
  },
  "devDependencies": {
    "@mosaix/cli": "workspace:*",
    "typescript": "^5.7.0",
    "pnpm": "^10.0.0"
  }
}
```

### B. Application `package.json` (`apps/portfolio/package.json`)
```json
{
  "name": "@apps/portfolio",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@mosaix/contracts": "workspace:*",
    "@mosaix/core": "workspace:*",
    "@mosaix/sdk": "workspace:*",
    "zod": "^3.23.8"
  }
}
```

### C. Framework Package `package.json` (`packages/core/package.json`)
```json
{
  "name": "@mosaix/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "dependencies": {
    "@mosaix/contracts": "workspace:*",
    "@mosaix/schemas": "workspace:*",
    "@mosaix/types": "workspace:*"
  }
}
```

### D. Plugin `package.json` (`plugins/analytics/package.json`)
```json
{
  "name": "@plugins/analytics",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "mixpanel": "^0.15.0"
  },
  "peerDependencies": {
    "@mosaix/contracts": "^0.1.0",
    "@mosaix/core": "^0.1.0"
  }
}
```

---

## 8. Mode Production `.mosaix/standalone`

Lors de l'exécution de `mosaix build` :
1. MosaiX analyse le graphe d'injection de dépendances de la plateforme.
2. Il génère un bundle ultra-léger dans `.mosaix/standalone/`.
3. Il crée un point d'entrée exécutable `server.js` qui démarre le `RuntimeKernel` pré-compilé et pré-enregistre les manifestes compilés dans `.mosaix/manifests/aggregated-manifest.json`.
4. **Réduction de taille Docker :** Au lieu de copier tout le monorepo dans l'image Docker de production, il suffit de copier le dossier `.mosaix/standalone` et de lancer `node .mosaix/standalone/server.js`.

---

## 9. CLI MosaiX & Commandes Standard

- **`mosaix dev`** : Démarre le RuntimeKernel en mode développement, crée le dossier `.mosaix/`, surveille les manifestes et fichiers TS à chaud avec SWC.
- **`mosaix build`** : Compile l'ensemble du monorepo, génère les tokens de thèmes, synthétise le registre unifié et produit le bundle autonome dans `.mosaix/standalone/`.
- **`mosaix start`** : Démarre le serveur de production à partir des artefacts pré-compilés dans `.mosaix/standalone/`.
- **`mosaix clean`** : Supprime intégralement le dossier `.mosaix/` et les répertoires `dist/` des sous-projets.
- **`mosaix inspect`** : Affiche l'état du registre synthétisé (`.mosaix/manifests/aggregated-manifest.json`), les capabilities enregistrées et le graphe de dépendances des BACs.

---

## 10. Comparaison Synthétique : MosaiX vs Next.js / Vercel

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MOSAIX vs NEXT.JS / VERCEL                            │
├───────────────────────┬──────────────────────┬──────────────────────────────┤
│ Concept Architectural │ Next.js / Vercel     │ Framework MosaiX             │
├───────────────────────┼──────────────────────┼──────────────────────────────┤
│ Dossier d'Artefacts   │ .next/               │ .mosaix/                     │
│ Domaine Cible         │ Frontend SSR/RSC/Edge│ Backend Multi-App BAC (NestJS)│
│ Moteur de Build       │ SWC / Turbopack      │ SWC / esbuild / tsc          │
│ Unité d'Isolation     │ Pages / Routes App   │ Bounded Application Contexts │
│ Modèle de Déploiement │ Serverless / Vercel  │ Standalone Node.js / Docker  │
│ Registre Dynamique    │ Route Manifest       │ Capability & Event Registry  │
└───────────────────────┴──────────────────────┴──────────────────────────────┘
```

### Ce qui est conservé de Next.js / Vercel :
- Le concept de répertoire interne centralisé (`.mosaix/` miroir de `.next/`).
- La séparation entre cache de compilation (`.mosaix/cache/`) et bundle d'exécution autonome (`.mosaix/standalone/`).
- Le système de commandes CLI simples (`dev`, `build`, `start`, `clean`).

### Ce qui est adapté pour NestJS & MosaiX :
- Remplacement du routage d'URL/Page par la **résolution de Capabilities RPC et de Bus d'Événements**.
- Remplacement des React Server Components par le **bootstrap asynchrone des Bounded Application Contexts (BACs)**.
- Gestion d'un monorepo multi-BACs avec isolation stricte des bases de données et des permissions RBAC.

### Ce qui n'est SURTOUT PAS reproduit :
- Pas de couplage propriétaire avec une plateforme Cloud spécifique (ex: Vercel). MosaiX reste 100% exécutable sur n'importe quel conteneur Docker ou serveur Node.js standard.
- Pas de surcoût d'hydratation HTML/React côté client : MosaiX est un framework d'architecture backend et de composition d'expériences métier.
