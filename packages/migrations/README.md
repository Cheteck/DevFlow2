# @mosaix/migrations

MosaiX Migration Engine — source-agnostic schema migrations for framework and
applications.

Aligned with [ADR-0006](../../../.project/decisions/ADR-0006-database-port-migration-engine.md)
and PRD-0006 (`.project/prd/PRD-0006-migrations-engine.md`).

## Architecture (ADR-0006)

```text
Registry                      Registry
   ↓                             ↓
Runner                        Migration Planner
                                 ↓
                              MigrationPlan
                                 ↓
                              Migration Runner
                                 ↓
                              DatabasePort
```

- **Registry** aggregates `MigrationProvider`s (framework + applications),
  computes content checksums at load (R2) and rejects full identity
  collisions (`owner.module.version.sequence_name`, R9).
- **Planner** computes the deterministic delta between the desired state
  (Registry) and the current state (Store) and produces an immutable
  `MigrationPlan` (R12, R13, R14).
- **Runner** executes only the validated plan, under the adapter-provided
  migration lock (R3). It never computes an upgrade itself.

## Public API

```typescript
MigrationRegistry; // register(provider, rank?), all(), get(), ownerOf()
MigrationPlanner; // plan({ rollback? }) → MigrationPlan
MigrationRunner; // run(plan) → { applied, rolledBack }
InMemoryMigrationStore; // MigrationStore (prototype/tests)
loadMigration(raw); // computes checksum at load time
compareMigrationIds(a, b); // numeric ordering (R6)
computeChecksum(content); // FNV-1a 64 (swap for SHA-256 in Phase 0)

// Database port (re-exported)
(DatabasePort, DatabaseCapabilities, Dialect, LockCapabilities, MigrationLock);
```

## Migration identity

```
owner.module.version.sequence_name
identity.users.v1.001_create_users
```

The sequence is compared **numerically** (R6). Global ordering: framework
bootstrap → modules framework → DAG applicatif → migrations applicatives
(R10), expressed in the spike via a per-provider `rank`.

## Spike scope

This package is the validation prototype of spike T-ADR-0006. The checksum is
FNV-1a 64 (non-cryptographic, runtime-agnostic); a cryptographic hash can be
swapped in Phase 0 without changing the contract. SQLite driver evaluation
(`better-sqlite3` / `node:sqlite` / WASM) is still blocked by the supply-chain
policy.
