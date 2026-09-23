# Architecture Constitution — MosaiX

**Version:** 1.0  
**Status:** Immutable — toute modification nécessite RFC + consensus unanime  
**References:** Chaque loi référence son(ses) ADR(s) et SPEC(s)

---

## Loi 1 — Applications Never Communicate Directly

> Toute interaction inter-applications (événements, commandes, requêtes, invocations de capacités) passe par le Runtime Kernel. Aucune communication directe, aucun partage de mémoire, aucun couplage compile-time.

**Références:** ADR-0001 (Contract Layer), ADR-0002 (Kernel Module System), Roadmap §4

---

## Loi 2 — Everything Is a Contract

> Applications, plugins, thèmes, capacités, expériences, événements : tous sont des contrats runtime gouvernés. `@mosaix/contracts` est la couche de spécification canonique (l'« OCI spec de MosaiX »).

**Références:** ADR-0001, `@mosaix/contracts` package, Roadmap §8

---

## Loi 3 — The Runtime Is an Arbiter, Never an Actor

> Le Runtime **route**, **valide**, **autorise**, **coordination** — mais :
> - n'implémente **aucune logique métier**
> - ne transforme **aucune donnée métier**
> - ne décide **aucun résultat métier**
> - ne possède **aucun domaine**

**Références:** Roadmap §11 (Principle #19), ADR-0002 (Kernel Context)

---

## Loi 4 — Single Owner Per Event

> Chaque type d'événement a un unique propriétaire (Bounded Context). Seul le propriétaire publie. Les consommateurs demandent l'accès via permissions explicites.

**Références:** ADR-0003 (Event Payload Contracts), Roadmap §4.1 (Event Naming Convention), Permission Model

---

## Loi 5 — Manifest Is Declarative

> Le manifeste d'application est purement déclaratif : aucune logique exécutable, aucune condition runtime, aucun code. Le SDK assemble ; le Runtime valide et applique.

**Références:** Roadmap §3 (Minimal Manifest Core), §8 (Application Manifest), Phase 5 (Fragmented Manifests)

---

## Loi 6 — No Business Logic in Kernel

> Le Kernel ne possède que quatre responsabilités :
> 1. Cycle de vie des applications
> 2. Communication (Event Bus, Capability RPC)
> 3. Sécurité (Authorization, Ownership, Tenant Isolation)
> 4. Résolution des contrats (Schemas, Permissions)

> Toute fonctionnalité optionnelle est un **Kernel Module** derrière interface stable. Le Kernel n'importe jamais d'implémentation.

**Références:** ADR-0002 (Kernel Module System), Roadmap §10 Risk #7

---

## Loi 7 — One Bounded Context = One Application

> Une application MosaiX est un Bounded Context complet : modèle de domaine propre, capacités exposées, événements possédés, permissions déclarées. Aucun partage de domaine entre applications.

**Références:** Roadmap §1 (Bounded Application Context), §8 (Application Manifest)

---

## Processus de modification

| Étape | Description | Outils |
|-------|-------------|--------|
| 1. Idea | Capture dans `.project/working/` | `gsd-capture` |
| 2. RFC | Document structuré, discussion | Workflow `architecture/rfc-process` |
| 3. Prototype | Validation technique (spike) | `gsd-spike` |
| 4. ADR | Décision architecturale immuable | Workflow `architecture/adr-create` |
| 5. Implementation | Code + tests + docs | Phase correspondante |
| 6. Audit | Validation post-implémentation | `gsd-audit-milestone` |

**Règle d'or:** Aucune loi ne peut être assouplie. Un conflit entre une proposition et la Constitution → la proposition change, pas la Constitution.