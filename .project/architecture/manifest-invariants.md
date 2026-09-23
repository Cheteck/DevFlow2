# Manifest Invariants — MosaiX

**Version:** 1.0  
**Scope:** Tout manifeste d'application ou de plugin  
**Reference:** Constitution Laws 2, 5, 7 — ADR-0001, Roadmap §3, §8

---

## Invariants

### 1. Immutable During Runtime

> Un manifeste **ne change jamais** après le démarrage de l'application.
> - Lecture seule pour le Runtime
> - Aucune API de mutation runtime
> - Hot-reload = nouvel instance + nouvel manifeste

### 2. Deterministic

> Même entrée (fichiers source) → même manifeste de sortie.
> - Pas de dates, random, environnement dans le manifeste généré
> - Build reproductible garanti

### 3. Versioned

> Chaque manifeste porte une version SemVer explicite.
> - `application.version` obligatoire
> - Compatibilité vérifiée au déploiement (Control Plane)
> - Historique immuable dans Manifest Store

### 4. Self-Contained

> Le manifeste contient **tout** ce que le Runtime doit savoir :
> - Identité (`id`, `version`, `runtime`)
> - Domaine (`entities`, `commands`, `queries`, `events`, `migrations`)
> - Capacités (`provides`, `consumes`)
> - Événements (`publishes`, `subscribes`)
> - Permissions (`provides`, `requires` — toutes catégories)
> - Expérience (`inherit`, `supports`, `overrides`)

> Aucune connaissance externe requise pour valider ou exécuter.

### 5. Declarative Only

> **Zéro logique exécutable** dans le manifeste.
> - Pas de fonctions, callbacks, conditions, boucles
> - Pas d'imports de code applicatif
> - Structure de données pure (JSON/YAML/TS objet typé)
> - Le SDK compile des fragments → objet final ; le Runtime valide

### 6. Single Source of Truth

> Le manifeste est l'unique autorité pour :
> - Résolution de capacités (`requires` ↔ `provides`)
> - Autorisations événements (`publishes`/`subscribes` ↔ permissions)
> - Isolation tenant (déclarée dans `runtime`, validée par Kernel)
> - Dépendances inter-applications (graphe de composition)

### 7. Fragmented Authoring, Unified Contract

> Développeur écrit : `manifest/{index,events,permissions,capabilities,ui,routes}.ts`
> SDK assemble → unique objet validé par `@mosaix/schemas`
> Runtime ne voit que le contrat unifié

---

## Validation Rules (Control Plane)

| Check | Description |
|-------|-------------|
| Schema | Zod validation contre `ApplicationManifestSchema` |
| Ownership | Événements publiés = événements possédés |
| Permissions | Chaque `requires` a un `provides` correspondant + grant |
| Tenant | `runtime.isolation` compatible avec politiques tenant |
| Version | SemVer valide ; compatibilité majeure vérifiée |
| Completeness | Aucune capacité/événement référencée non déclarée |

---

## Governance

- **Déploiement :** Control Plane rejette tout manifeste invalide
- **Drift Detection :** Phase 4 — runtime compare manifeste déclaré vs réel
- **Migration :** Nouveau manifeste = nouvelle version d'application (pas de patch in-place)