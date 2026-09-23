# MosaiX — Modular Orchestration for Smart Application Integration eXperience

MosaiX (**Modular Orchestration for Smart Application Integration eXperience**) is an open, governed, and composable application ecosystem platform for Node.js / TypeScript monorepos.

It enables building autonomous Bounded Application Contexts (BACs) that communicate via governed contracts, events, capabilities, and theme tokens without tight coupling.

---

## Core Architecture

- **Control Plane**: App Registry, Capability Registry, Event Schema Registry, Permission Registry.
- **Runtime Plane**: Runtime Kernel, Domain Event Bus, Authorization Engine, Communication Backbone.
- **Application Plane**: Autonomous BACs (`apps/identity`, `apps/portfolio`) and decoupled framework packages (`packages/ports-*`, `packages/adapters-*`).

---

## Development

```bash
pnpm dev                  # dev server + auto-reload → http://localhost:3000/
pnpm dev -- --port 4000   # custom port (also: --host, --open, --help)
pnpm build                # incremental TypeScript build
pnpm start                # one-shot server (no watch)
```

Endpoints: `/` (Shell frontend, HTML) · `/__mosaix` (diagnostic JSON) ·
`/openapi.json` (OpenAPI spec). `PORT` / `HOST` env vars are respected.

## Docker

```bash
pnpm docker:up     # dev stack (app + postgres + redis) → http://localhost:3000/
pnpm docker:down   # stop (add -v to drop db/cache volumes)
```

Notes:

- The image runs from TypeScript sources via `tsx` (path aliases resolve at
  runtime); `pnpm build` stays the typecheck gate.
- `HOST=0.0.0.0` is set for container networking; the compose stack overrides
  the command with `pnpm dev` (auto-reload, sources mounted).
- Copy `.env.example` to `.env` to customize `DATABASE_URL` / `REDIS_URL`.

---

## Documentation & Governance

Full project specification, architecture blueprints, requirements, and decisions are maintained under `.project/`:

- `.project/PROJECT.md`: Master project specification & system vision
- `.project/REQUIREMENTS.md`: Master requirements catalog (`REQ-001`..`REQ-105`)
- `.project/STATE.md`: Active execution state and wave position
- `.project/architecture/`: Architecture blueprints and invariants
- `.project/decisions/`: Architecture Decision Records (ADRs)
