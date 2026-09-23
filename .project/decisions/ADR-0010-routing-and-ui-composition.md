# ADR-0010: Route Contracts & UI Slot Composition

## Status
Accepted

## Context
MosaiX applications need to expose HTTP routes and UI contributions (slots/widgets) to the platform shell without direct cross-application imports.

## Decision
Applications declare `RouteContract`s (`method`, `path`, `handler`, `permissions`) and `UIContribution` slot registrations (`platform.sidebar`, `dashboard.widgets`). The Platform Shell and Runtime Router discover and mount these contributions dynamically based on RBAC permissions.
