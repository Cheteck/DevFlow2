# ADR-0011: Build Artifacts vs Runtime Execution Isolation

## Status
Accepted

## Context
To guarantee production deployment stability and fast development startup, build compilation artifacts must be decoupled from runtime execution state.

## Decision
Compilation outputs reside in `.mosaix/build/` and `.mosaix/runtime/`. Runtime state and dev sessions reside in `.mosaix/dev/` and are strictly gitignored. Production deployment consumes bundled `.mosaix/runtime/manifest.json`.
