# MosaiX Theme System (`themes/*`)

MosaiX introduces a powerful, declarative 3rd dimension of discoverable artifacts: **Themes (`themes/*`)**.

## Core Principles
1. **Zero Runtime Execution**: Themes are purely declarative data artifacts (`theme.json`, design tokens, slots, layouts, asset presets). They contain no runtime code or application dependencies.
2. **Strict Isolation**: Themes do not know about Bounded Application Contexts (BACs) (`@apps/`, `@mosaix-plugin/`, business routes). Inversion of compatibility is handled via `contractVersion` and `themeContract`.
3. **PrestaShop Inspirations**: Rich manifests, layouts separate from templates, specific-to-generic fallback, mandatory `preview.png`, settings schema out of manifest, generic email shells, asset presets, and RTL/locales chrome support.

## Discovery & Precedence Resolution
Themes are discovered dynamically from the root `themes/` directory (ignoring `_`-prefixed and `.`-prefixed directories).
Precedence order for slot and layout resolution:
$$\text{parent}(0) < \text{theme}(1) < \text{app non-propriétaire}(2) < \text{app propriétaire}(3) < \text{tenant}(4)$$
- Shell routes (`/, /login, /register, errors/*`) exclude app-level overrides (Levels 2 & 3).
- Route ownership is determined by matching the request route against `routes[]` in `mosaix.json`. Longest pattern match wins. Ambiguities raise a strict CI error.

## CI & Validation (`check:themes`)
- Validates JSON schemas against Zod manifests.
- Enforces presence of `preview.png` and valid `settings.schema.json`.
- Grep-guard: prohibits references to `@apps/`, `@mosaix-plugin/`, or commercial routes (`/checkout`, `/cart`).
- `--emit-resolution-table` generates a structured resolution summary at `.project/reports/theme-resolution-table.json`.
