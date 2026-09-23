# MosaiX Coding Conventions & Technical Standards

## Mandatory Code Quality Rules

1. **TypeScript Strictness**:
   - `exactOptionalPropertyTypes: true` is strictly enforced. Optional properties must be omitted or assigned conditionally rather than assigned `undefined`.
   - `noUncheckedIndexedAccess: true` is enforced for indexed access safety.

2. **Error Handling & Cause Propagation**:
   - ESLint custom rule `preserve-caught-error`: Any caught error inside a catch block must be rethrown with the original error wrapped as `cause`:
     ```ts
     throw new Error("Failed operation", { cause: error });
     ```

3. **Port/Adapter Naming Rules**:
   - Port interfaces and concrete adapters must have distinct filenames to avoid collisions (e.g. `user-repository.ts` vs `in-memory-user-repository.ts`).
