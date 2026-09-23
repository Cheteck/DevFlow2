# ADR-0009: Dev Session & Runtime State Management

## Status
Accepted

## Context
Running `mosaix dev` requires an isolated, recoverable development environment that tracks watcher state, active application sessions, and incremental builds without state pollution.

## Decision
Dev sessions are stored in `.mosaix/dev/sessions/<session-id>/` containing `session.json`, `runtime.json`, `apps.json`, and `diagnostics.json`. `DevSession` primitives track port allocations, process IDs, and watcher status.
