# Guide Développeur — Système de Plugins MosaiX

Ce guide décrit l'architecture, le cycle de vie, la déclaration des manifestes `mosaix.json`, l'isolation en bac à sable et l'exécution des hooks pour créer des plugins compatibles avec MosaiX.

---

## 1. Principes Généraux

Un **Plugin MosaiX** est une extension applicative dynamique :
- Il ne possède aucun domaine métier en propre et ne s'exécute jamais de manière autonome.
- Il s'attache à une application hôte (BAC) via un ou plusieurs **Points d'Extension (Extension Points)** ou **Hooks Canoniques**.
- Il interagit exclusivement avec l'application hôte via des capabilities injectées, des événements ou des contributions d'emplacements (slots UI).

---

## 2. Déclaration du Manifeste (`mosaix.json`)

Chaque paquet de plugin sous `plugins/<nom-du-plugin>/` doit obligatoirement inclure un fichier `mosaix.json` à la racine de son dossier :

```json
{
  "id": "@mosaix-plugin/commerce-badge",
  "name": "Commerce Badge Plugin",
  "version": "1.0.0",
  "entrypoint": "./src/index.ts",
  "extension": {
    "target": "commerce",
    "point": "commerce.checkout.calculateDiscount"
  },
  "settingsSchema": {
    "type": "object",
    "properties": {
      "discountPercent": { "type": "number", "default": 10 }
    }
  }
}
```

---

## 3. Machine à États du Cycle de Vie

Un plugin traverse les états suivants au sein du `PluginEngine` (`@mosaix/plugin-engine`) :

1. **`DISCOVERED`** : Fichier `mosaix.json` découvert par `WorkspacePluginLoader`.
2. **`VALIDATED`** : Manifeste validé par `PluginManifestSchema` (`@mosaix/schemas`).
3. **`INITIALIZED`** : Contexte bac à sable créé (`PluginSandboxEnvironment`), capabilities résolues et paramètres initialisés.
4. **`ACTIVE`** : Instance activée et hooks enregistrés dans `HookExecutionEngine`.
5. **`DISABLED`** : Plugin désactivé depuis la console Imperia ou la CLI (les hooks ne sont plus exécutés).
6. **`UNLOADED`** : Plugin déchargé et nettoyé sans résidu en mémoire.

---

## 4. Prise en Main des Hooks Canoniques

Les BACs MosaiX déclenchent des hooks lors des phases critiques du cycle de traitement :

- `commerce.checkout.calculateDiscount` : Calcul et personnalisation des remises panier.
- `solara.post.beforeCreate` : Modération et analyse de contenu avant publication.
- `booking.slot.filterAvailability` : Filtrage dynamique des créneaux de réservation.
- `citadelle.auth.beforeLogin` : Contrôles de sécurité et règles d'accès personnalisées.

Exemple d'implémentation de hook :

```typescript
import { PluginEngine } from "@mosaix/plugin-engine";

const engine = new PluginEngine();

// Enregistrement d'un hook
engine.registerHook("commerce.checkout.calculateDiscount", (args: { total: number }) => {
  return args.total * 0.9; // Remise de 10%
}, { priority: 10, pluginId: "commerce-discount-plugin" });

// Exécution du hook par l'application hôte
const result = await engine.runHook("commerce.checkout.calculateDiscount", { total: 100 });
console.log(result.results); // [90]
```

---

## 5. Administration via Imperia & CLI

Les plugins enregistrés dans le runtime `PluginEngine` sont automatiquement administrables depuis :
- La **Console Administrateur Imperia** (`/imperia/plugins` & `/imperia/plugins/action`).
- La **Ligne de Commande (CLI)** :
  - `pnpm mosaix plugin list` : Liste les plugins installés et leurs états.
  - `pnpm mosaix plugin install <id>` : Installe et active un plugin.
  - `pnpm mosaix plugin disable <id>` : Désactive un plugin en direct.
