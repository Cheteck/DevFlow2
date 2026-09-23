# MosaiX Codebase Stack & Package Ecosystem

## Package Hierarchy & Boundaries

MosaiX is structured as a pnpm workspace monorepo enforcing strict boundary rules (`apps ➔ sdk ➔ core ➔ schemas ➔ contracts ➔ types`):

```
packages/
├── types/                      # Canonical primitive types
├── contracts/                  # Platform ABI contracts & interfaces (@mosaix/contracts)
├── schemas/                    # Zod validation schemas (@mosaix/schemas)
├── core/                       # RuntimeKernel, Module system, Communication Backbone
├── sdk/                        # Developer helpers (uuid, ulid, clock, logger, cache)
├── config/                     # Immutable configuration engine
├── migrations/                 # Multi-App Migration Engine
├── ports/                      # 19 Abstract Infrastructure Ports (@mosaix/ports-*)
└── adapters/                   # 29 Concrete Infrastructure Adapters (@mosaix/adapter-*)

apps/
├── identity/                   # User IAM Reference Bounded Context Application
├── portfolio/                  # Vendable Products/Services Reference BAC
└── sales/                      # Legacy demo application
