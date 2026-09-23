# ADR-0013: Declarative Theme System (`themes/*`)

## Status
Accepted

## Context
MosaiX required a 3rd discoverable dimension alongside `apps/` and `plugins/` for branding and user experience customization without introducing runtime coupling or business logic inside themes.

## Decision
1. **Declarative Artifacts**: Themes reside in `themes/*` with `theme.json`, design tokens, asset presets, and layouts.
2. **Deterministic Precedence**: Implemented a 5-tier resolution pipeline:
   - Level 0: Parent theme (`extends`)
   - Level 1: Active theme & variant (`light`/`dark`)
   - Level 2: Non-owner application overrides (`themeOverrides`)
   - Level 3: Route-owner application overrides
   - Level 4: Tenant overrides
3. **Shell Isolation**: Shell routes (`/, /login, /register, errors/*`) ignore app-level overrides.
4. **CI Enforcement**: `pnpm check:themes` guarantees structural conformance, grep-guards against business logic leaks, and validates `preview.png`.

## Consequences
- Clean separation between theme styling and business logic.
- Robust plug-and-play theme extensibility across tenants and applications.
