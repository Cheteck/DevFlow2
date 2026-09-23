# MosaiX — Project Specification & Master Directive

## System Vision

MosaiX (**Modular Orchestration for Smart Application Integration eXperience**) is an **Operating System for Composable Application Ecosystems**. It provides a modular, governed runtime platform enabling autonomous Bounded Application Contexts (BACs) to execute, communicate, and compose without tight coupling.

---

## Architectural Guiding Principles & Invariants

1. **Unidirectional Dependency Flow**:
   `apps ➔ sdk ➔ core ➔ schemas ➔ contracts ➔ types`
   Direct cross-application dependencies or reverse layer dependencies are strictly forbidden.

2. **Communication Backbone Decoupling**:
   Applications never communicate directly. All inter-BAC interactions pass through Runtime Kernel contracts (`CapabilityRegistry`, `DomainEventBus`, `AuthorizationEngine`).

3. **Hexagonal Boundaries (Ports & Adapters)**:
   Core domain business logic depends strictly on abstract ports (`packages/ports/`). Infrastructure drivers (`packages/adapters/`) implement ports without exposing concrete implementations to consumers.

4. **Multi-App Schema Target Independence**:
   Each Bounded Application Context owns its schema target. Database migrations are discovered across Core, Packages, and Apps and applied to local targets (`app_schema.migrations`).

5. **Immutable Contracts & Payload Validation**:
   Capability parameters and Event payloads are validated at publication and invocation using Zod schemas (`@mosaix/schemas`).

---

## Repository Governance & Evolution Rules

- Governance artifacts live in `.project/` following GSD (Get Shit Done) context engineering patterns.
- Active task state is tracked centrally in `.project/backlog/consolidated-backlog-2026-08-16.md` and `.project/STATE.md`.
- Historical decisions are locked in `.project/decisions/` (ADR-0001..ADR-0007).
