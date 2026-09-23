# MosaiX Application Runtime v1.0 — Architecture & Specification

## Executive Summary & Vision

This specification defines the transition of **MosaiX** from a statically assembled modular framework into a **declarative, capability-driven Application Orchestration Runtime**.

Following Alex Osterwalder's architectural review, MosaiX decouples the Runtime Core (`@mosaix/core`) from hardcoded path imports (`apps/*`). Instead, an **Application** becomes a first-class execution unit defined declaratively via `ApplicationDefinition`, composed of **Bounded Application Contexts (BACs)** and **Capabilities**, resolved topologically via `ApplicationCompositionResolver`, and lifecycle-managed via a unified `RuntimeComponentLifecycle` engine.

---

## The 6 Core Structural Pillars

### 1. First-Class `ApplicationDefinition`
An **Application** is no longer represented implicitly by an individual BAC manifest. An Application is a first-class manifest declaring target context versions, enabled capabilities, policies, configuration overrides, and tenant activation rules.

### 2. Path-Decoupled `ContextRegistry`
The Runtime Core does not possess hardcoded assumptions about directory paths (`apps/commerce`). Instead, BACs, plugins, and remote packages register their `AppServiceProvider` and `ContextManifest` into a decoupled `ContextRegistry` at startup or discovery.

### 3. Unified `RuntimeComponentLifecycle`
The lifecycle engine previously limited to plugins (`@mosaix/plugin-engine`) is generalized into a universal `RuntimeComponentLifecycle` supporting Plugins, BACs, Capabilities, and Adapters:
`DISCOVERED` ➔ `VALIDATED` ➔ `RESOLVED` ➔ `LOADED` ➔ `INITIALIZED` ➔ `ACTIVE` ➔ `DISABLED`

### 4. Topological `ApplicationCompositionResolver`
A Directed Acyclic Graph (DAG) dependency solver that receives an `ApplicationDefinition`, resolves version constraints (`^1.0`), validates contract compliance, checks required capabilities, and produces an ordered execution plan.

### 5. Capability as a First-Class Runtime Primitive
Capabilities (`spaces.create`, `commerce.checkout`, `solara.publish`) are elevated from metadata strings to first-class runtime primitives (`CapabilityDefinition`) with owner contexts, input/output schemas, permission requirements, and HTTP/RPC route interceptors.

### 6. Declarative Multi-Tenant Composition
Support for tenant-level activation variations (`TenantDefinition`), allowing different tenants hosted on the same MosaiX cluster to execute distinct application compositions (e.g. Tenant A = Marketplace, Tenant B = Creator Platform).

---

## Architectural Topology

```text
                               MOSAIX RUNTIME KERNEL
                                         │
                        Platform Application Orchestrator
                                         │
                        ApplicationCompositionResolver (DAG)
                                         │
            ┌────────────────────────────┴────────────────────────────┐
            ↓                                                         ↓
     ContextRegistry                                         CapabilityRegistry
(BACs, Plugins, Extensions)                             (First-Class Runtime Guards)
            │                                                         │
            └────────────────────────────┬────────────────────────────┘
                                         ↓
                            Unified Component Lifecycle
                   (DISCOVERED ➔ VALIDATED ➔ RESOLVED ➔ ACTIVE)
                                         │
           ┌─────────────────────────────┼─────────────────────────────┐
           ↓                             ↓                             ↓
Marketplace Platform            Creator Platform              Community Platform
  (ApplicationDef)              (ApplicationDef)               (ApplicationDef)
```

---

*Specification authored for MosaiX Platform Architecture v1.0*
