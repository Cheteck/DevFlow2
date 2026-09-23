# MosaiX Architectural Blueprint & Subsystem Mapping

## Architectural Layers

1. **Control Plane (Governance)**:
   - `AppRegistry`: Discovers and supervises BAC lifecycle states.
   - `CapabilityRegistry`: Central registry for typed capability contracts.
   - `EventSchemaRegistry`: Ownership and SemVer validation for domain events.
   - `PermissionRegistry`: RBAC/ABAC grammar enforcement (`domain:resource:action:scope`).

2. **Runtime Plane (Execution)**:
   - `RuntimeKernel`: Core execution engine (`packages/core/src/runtime-kernel.ts`).
   - `KernelContext`: Open service container storing kernel services and infrastructure ports via `InfrastructureModule`.
   - `DomainEventBus`: Event publication with optional payload validation (`ADR-0003`).

3. **Application Plane (BACs)**:
   - Autonomous Bounded Application Contexts (`apps/identity`, `apps/portfolio`) interacting exclusively via Kernel capabilities and domain events.
