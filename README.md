# MosaiX — Plateforme Modulaire d'Orchestration pour Applications Intelligentes

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Cheteck/DevFlow2/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org/)
[![PNPM](https://img.shields.io/badge/pnpm-9.x-F69220)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933)](https://nodejs.org/)

**MosaiX** est une plateforme d'écosystème applicatif ouverte, gouvernée et composable pour les monorepos Node.js / TypeScript.

Elle permet de construire des Bounded Application Contexts (BACs) autonomes qui communiquent via des contrats gouvernés, des événements, des capabilities et des tokens de thème, sans couplage strict.

---

## Architecture

MosaiX suit une architecture hexagonale en trois plans :

### Plan de Contrôle (Control Plane)
- **App Registry** — Enregistrement et découverte des applications
- **Capability Registry** — Registre des capabilities du système
- **Event Schema Registry** — Schémas d'événements validés
- **Permission Registry** — Gestion des permissions et rôles

### Plan d'Exécution (Runtime Plane)
- **Runtime Kernel** — Noyau de composition et cycle de vie
- **Domain Event Bus** — Bus d'événements métier
- **Authorization Engine** — Moteur d'autorisation
- **Communication Backbone** — Infrastructure de communication

### Plan Application
- **BACs autonomes** : `apps/beam`, `apps/commerce`, `apps/imperia`, `apps/portfolio`, `apps/solara`, `apps/solidarity`, `apps/spaces`, `apps/subscription`, `apps/citadelle`, `apps/booking`
- **Packages framework** : `packages/ports-*`, `packages/adapters-*`, `packages/core`, `packages/gateway`

---

## Démarrage rapide

### Prérequis

- Node.js 22+
- pnpm 9+
- (Optionnel) Docker & Docker Compose

### Installation

```bash
pnpm install
```

### Développement

```bash
pnpm dev                  # Dev server avec auto-reload → http://localhost:3000/
pnpm dev -- --port 4000  # Port personnalisé
pnpm build                # Build TypeScript incrémental
pnpm start                # Serveur sans watch mode
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Shell frontend (HTML) |
| `/__mosaix` | Tableau de bord diagnostic (JSON) |
| `/health` | Health check |
| `/metrics` | Export Prometheus |
| `/openapi.json` | Spécification OpenAPI |

### Docker

```bash
pnpm docker:up     # Stack dev (app + postgres + redis) → http://localhost:3000/
pnpm docker:down   # Arrêt (ajoutez -v pour supprimer les volumes)
```

> Copiez `.env.example` en `.env` pour configurer `DATABASE_URL` et `REDIS_URL`.

---

## BACs (Bounded Application Contexts)

| BAC | Description |
|-----|-------------|
| `citadelle` | Identité et gestion des utilisateurs |
| `commerce` | Gestion des commandes et panier |
| `imperia` | Gouvernance plateforme et paramètres |
| `portfolio` | Gestion des actifs et vendables |
| `solara` | Création et gestion de contenu |
| `solidarity` | Transactions et mécaniques solidaires |
| `spaces` | Espaces collaboratifs |
| `booking` | Réservation et planification |
| `subscription` | Forfaits récurrents et metering |
| `beam` | Messagerie inter-BAC |

---

## Packages

### Ports (Interfaces)
`packages/ports/*` — Définitions des interfaces (clock, database, auth, cache, etc.)

### Adapters (Implémentations)
`packages/adapters/*` — Implémentations concrètes (postgres, redis, oidc, etc.)

### Core
`packages/core` — Runtime kernel, registres, moteur de composition

### Gateway
`packages/gateway` — Rate limiting, CORS, security headers

### HTTP
`packages/http` — Client HTTP, middleware, OpenAPI

---

## Vérification et Tests

```bash
pnpm check              # Build + Lint + Typecheck + Test + Format
pnpm test               # Exécuter les tests (vitest)
pnpm check:conformance  # Validation de conformité des contrats
pnpm mosaix doctor      # Vérification de l'architecture
```

---

## Gouvernance et Documentation

La documentation complète est maintenue sous `.project/` :

- `.project/PROJECT.md` — Spécification maître du projet
- `.project/REQUIREMENTS.md` — Catalogue des exigences (`REQ-001` à `REQ-105`)
- `.project/STATE.md` — État d'exécution actif et position de vague
- `.project/architecture/` — Blueprints et invariants architecturaux
- `.project/decisions/` — Architecture Decision Records (ADRs)
- `.project/roadmap.md` — Feuille de route
- `.project/changelog.md` — Journal des changements

---

## Contributing

1. Fork le dépôt
2. Créez une branche (`git checkout -b feature/ma-feature`)
3. Committez (`git commit -m "feat: ma feature"`)
4. Poussez (`git push origin feature/ma-feature`)
5. Ouvrez une Pull Request

---

## License

MIT License — voir [LICENSE](LICENSE) pour les détails.
