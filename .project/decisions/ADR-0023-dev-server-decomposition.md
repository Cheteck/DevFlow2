# ADR-0023 — Dev Server Decomposition

> **Status :** Proposed
> **Date :** 2026-10-31
> **Auteurs :** Technical Steward + ChatGPT architectural review
> **Impact :** `@mosaix/dev-server`, `@mosaix/cli`

---

## Contexte

Le package `@mosaix/dev-server` (v0.1.0) mélange actuellement **trois domaines
fonctionnellement distincts** dans un seul artifact :

1. **DevServer (HMR)** — sessions de dev, événements HMR, stockage
2. **Command Center (TUI Supervisor)** — orchestration processus enfants, TUI
   interactive, diagnostics, watchdog .env
3. **CLI Dev Server** — discovery workspace, conformance, lanceur du serveur HTTP

Cette fusion rend le code difficile à étendre (ajout d'un worker = modification
du cœur), empêche le testing ciblé, et crée un risque de fuite en production
(rien ne bloque l'import du Command Center depuis un bundle production).

ChatGPT a confirmé cette analyse :

> *L'architecture est cohérente fonctionnellement, mais présente un problème
> de séparation des responsabilités et de maîtrise du cycle de vie.*

---

## Décision

**Découpler en trois packages indépendants** avec des frontières explicites :

```
@mosaix/dev-session       (existe déjà) — sessions + état
@mosaix/dev-server        — HMR uniquement (scope réduit)
@mosaix/command-center    — NOUVEAU — TUI supervisor + ManagedService
@mosaix/cli               — orchestration workspace (inchangé)
```

**Motivation :**
- Chaque package a une responsabilité unique testable
- Le Command Center devient optionnel (pas de dependency pour le CLI headless)
- La prod ne peut pas importer accidentellement du TUI
- L'ajout d'un nouveau type de service (worker, queue) ne touche pas le cœur

---

## Conséquences

### Positives
- Testing ciblé par domaine
- Extensibilité : un `worker` s'ajoute par configuration, pas par modification du code
- Surface de build réduite pour les sous-ensembles du monorepo
- Protection prod : `@mosaix/command-center` avec `"dev": true` dans package.json

### Négatives
- Migration temporaire : imports à migrer
- Deux releases coordonnées (`dev-server` + `command-center`)
- Période de dépréciation de l'API legacy (`DevServer` class)

---

## Confluence avec les livrables

Les trois livrables produits dans ce dossier documentent :
- `DEV-SERVER-RESPONSIBILITY-MATRIX.md` — qui fait quoi
- `DEV-SERVER-LIFECYCLE-DIAGRAM.md` — cycle de vie Supervisor → ManagedService
- `DEV-SERVER-MIGRATION-PLAN.md` — plan incrémental sans breaking changes
