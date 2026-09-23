# Event Invariants — MosaiX

**Version:** 1.0  
**Scope:** Tout événement de domaine publié sur le Domain Event Bus  
**Reference:** Constitution Laws 1, 2, 4 — ADR-0001, ADR-0003, Roadmap §4.1

---

## Invariants

### 1. Immutable

> Une fois publié, un événement **ne change jamais**.
> - Event Store = append-only log
> - Aucune API de mise à jour ou suppression
> - Correction = nouvel événement compensatoire (ex: `order.cancelled`)

### 2. Append-Only

> L'écriture est la seule opération.
> - `EventStore.append(envelope)` → séquence monotone
> - Idempotence par `envelope.id` (UUID v7)
> - Replay = relecture séquentielle

### 3. Owned

> Chaque type d'événement a un **unique propriétaire** (Bounded Context).
> - `source.application` = propriétaire
> - Seul le propriétaire peut publier (Kernel enforces)
> - Propriété = autorité de publication + autorité de schéma

### 4. Replayable

> Tout événement peut être rejoué à l'identique.
> - Payload complet dans l'enveloppe
> - `metadata.aggregate` + `metadata.aggregateId` + `metadata.sequence` pour ordering
> - Consommateurs idempotents (clé `idempotencyKey` ou `envelope.id`)

### 5. Deterministic

> Même cause → même événement.
> - Pas de hasard, pas d'horloge locale dans le payload
> - `timestamp` = ISO 8601 UTC au moment de la publication
> - `correlationId` + `causationId` pour traçabilité causale

### 6. Versioned

> Enveloppe porte `type@version` (SemVer).
> - `sales.order.created@1.0.0` → `sales.order.created@1.1.0` (additif)
> - Breaking = nouveau type majeur `sales.order.created@2.0.0`
> - Registry gère compatibilité, dépréciation, migration

### 7. Ordered

> Garanties d'ordre selon le niveau :
> | Niveau | Garantie | Mécanisme |
> |--------|----------|-----------|
> | Per-Aggregate | Séquence stricte | `metadata.sequence` monotone |
> | Per-Tenant | Causalité | `correlationId` + `causationId` |
> | Global | Best-effort | Timestamp + partition |

> Le Kernel n'offre **pas** d'ordre global fort.

### 8. Past-Tense Facts, Not Commands

> Nommage : `<domain>.<resource>.<past-tense-action>`
> - ✅ `sales.order.created`, `identity.user.disabled`, `payment.invoice.paid`
> - ❌ `sales.order.create`, `identity.disable.user`, `payment.process.invoice`
> L'événement = fait accompli, immuable, auditable.

### 9. Single Owner Enforced

> Kernel vérifie à chaque `publish` :
> 1. `source.application` == propriétaire enregistré (Event Schema Registry)
> 2. Schéma de payload validé (si `payloadSchema` déclaré)
> 3. Permission `domain:event:<type>:publish:<scope>` accordée
> Échec = `EventError` (typé, non générique)

### 10. Tenant-Isolated

> Chaque enveloppe porte `tenant: { organizationId, spaceId? }`.
> - Event Store partitionné par tenant
> - Consommateurs reçoivent uniquement événements de leur tenant
> - Cross-tenant = interdit par défaut ; fédération explicite requise

### 11. Security Classified

> `security: { classification, pii? }` obligatoire.
> - `classification`: `public` | `internal` | `confidential` | `restricted`
> - `pii: true` → audit renforcé, chiffrement au repos, rétention limitée
> - Consommateur voit la classification avant traitement

### 12. Metadata for Domain Context

> `metadata: { aggregate?, aggregateId?, sequence? }` pour :
> - Reconstruction d'état (Event Sourcing)
> - Détection de gaps (sequence non contiguë)
> - Corrélation inter-agrégats

---

## Envelope Structure (Canonical)

```typescript
interface MosaixEventEnvelope<T> {
  // Identity
  id: string;                    // UUID v7 (time-ordered)
  type: string;                  // "sales.order.created"
  version: string;               // "1.0.0"

  // Source & Ownership
  source: {
    application: string;         // Owning Bounded Context ID
    instance?: string;           // Runtime instance ID
  };

  // Tenant Isolation (mandatory)
  tenant: {
    organizationId: string;
    spaceId?: string;
  };

  // Temporal & Causality
  timestamp: string;             // ISO 8601 UTC
  correlationId: string;         // Business transaction ID
  causationId?: string;          // Previous event ID that caused this

  // Payload (validated against registered schema)
  payload: T;

  // Domain Context
  metadata: {
    aggregate?: string;          // DDD aggregate root
    aggregateId?: string;        // Aggregate instance ID
    sequence?: number;           // Aggregate sequence for ordering
  };

  // Security & Classification
  security: {
    classification: "public" | "internal" | "confidential" | "restricted";
    pii?: boolean;
  };
}
```

---

## Lifecycle

```
Publisher (Owner App)
    │
    ▼
publish(envelope)
    │
    ▼
┌─────────────────────────────────────┐
│ Runtime Kernel                      │
├─────────────────────────────────────┤
│ 1. VALIDATE SCHEMA (Zod)           │
│ 2. VALIDATE OWNERSHIP              │
│ 3. CHECK PUBLISH PERMISSION        │
│ 4. PERSIST → Event Store (tenant)  │
│ 5. RESOLVE SUBSCRIBERS             │
│ 6. CHECK CONSUME PERMISSION each   │
│ 7. DELIVER (async, ordered)        │
│ 8. AUDIT LOG                       │
└─────────────────────────────────────┘
```

---

## Governance

- **Schema Registry** : Control Plane — enregistre, valide, versionne, déprécie
- **Permission Registry** : Control Plane — grants/deny consume par subscriber/tenant
- **Audit Trail** : Immuable — chaque publication, grant, deny, revocation logué
- **Compatibility** : Phase 2/4 — vérification CI/CD breaking changes
- **Retention** : Politique par classification (ex: `restricted` = 90 jours, `public` = 7 ans)