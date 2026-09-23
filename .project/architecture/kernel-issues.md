# Kernel Issues

> Analysis Date: 2026-09-07
> Status: Les duplications critiques ont été résolues.

## Résolu: Code Duplication

Les fichiers `kernel-head.ts` et `km-head.ts` ont été supprimés. L'implémentation canonique est maintenant `packages/core/src/kernel.ts`.

---

## Problèmes Connus

### KNOWN-01: Capabilities dérivées avec entrypoints par défaut

**Localisation**: `kernel.ts:346-356`

**Description**: Lors de l'enregistrement d'une application, les capabilities sont dérivées du manifest:

```typescript
this.context.capabilities.register({
  id: cap.id,
  ownerApp: manifest.id,
  version: cap.version ?? "1.0.0",
  entry: `${(manifest.runtime as { entrypoint: string }).entrypoint}#${cap.id}`,
  permissions: perms as unknown as string[],
});
```

**Impact**: 
- `permissions` peut être vide si le manifest n'a pas de permissions `capability:*:execute:*`
- `entry` formaté comme `entrypoint#capId` peut ne pas correspondre à la réalité de l'executor

**Travailaround**: Appeler `registerCapabilityExecutor()` explicitement après `kernel.register()`.

---

### KNOWN-02: Event schemas versionnées en dur

**Localisation**: `kernel.ts:360-367`

**Description**: Les schemas d'événements sont toujours enregistrés avec `version: "1.0.0"` codé en dur:

```typescript
this.context.eventSchemas.register({
  type: eventType,
  version: "1.0.0",  // ❌ Ignoré du manifest
  ownerApp: manifest.id,
  schema: {},         // ❌ Vide
});
```

**Impact**: La version du manifest est ignorée, les schemas sont vides.

---

### KNOWN-03: Dead-letter queue sans logging

**Localisation**: `event-bus.ts:207-235`

**Description**: Quand un handler échoue après tous les retries, l'événement est ajouté à la dead-letter queue silencieusement:

```typescript
this.deadLetterQueue.push({
  event: envelope,
  subscriber,
  error: toError(lastError),
  attempts: policy.retries + 1,
  failedAt: new Date().toISOString(),
});
```

**Impact**: Perte d'événement silencieuse si `retries: 0` (défaut).

**Travailaround**: Configurer `setRetryPolicy()` avec `retries > 0` et monitorer `deadLetters()`.

---

### KNOWN-04: Publish séquentiel

**Localisation**: `event-bus.ts:197-204`

**Description**: Les handlers sont exécutés séquentiellement:

```typescript
for (const { handler, subscriber } of subscriptions) {
  // ...
  await this.deliver(handler, subscriber, envelope);
}
```

**Impact**: Un handler lent bloque tous les suivants.

---

### KNOWN-05: Permissions avec scope wildcard interdites

**Localisation**: `invariants.ts:35-46`, `permission.ts:28-32`

**Description**: Le scope `*` est interdit dans les permissions:

```
*:event:user.created:publish:tenant  // ❌ Invalid
acme:event:user.created:publish:tenant  // ✅ Valid
```

**Impact**: Le pattern `*` pour le scope casse la grammaire.

---

## Points de Conception

### Executor Lookup Double

**Localisation**: `kernel.ts:497-498`

```typescript
const executor = this.executors.get(capabilityId)
  ?? (entry as unknown as { executor?: CapabilityExecutor }).executor;
```

L'executor peut être stocké:
1. Dans la map `this.executors` (via `registerCapabilityExecutor`)
2. Directement sur l'entry (via mutation)

**Note**: Ce double lookup est pour la compatibilité mais peut créer de la confusion.

---

### Legacy Manifest Support

**Localisation**: `kernel.ts:316-331`

Les manifests peuvent avoir deux formes:
- **New**: Validation Zod stricte
- **Legacy**: Fallback silencieux (permissions as string[], capabilities sans provider/operations)

Cette dualité complique le code mais préserve la compatibilité avec les 8 apps existantes.

---

## Backlog de Corrections

| ID | Priorité | Description |
|----|----------|-------------|
| KNOWN-01 | P1 | Câbler les permissions de capabilities ou documenter le comportement |
| KNOWN-02 | P1 | Utiliser la version du manifest pour les event schemas |
| KNOWN-03 | P0 | Logger les dead-letters (minimum warn) |
| KNOWN-04 | P2 | Livraison parallèle ou documenter l'avertissement |

---

## Related

- [kernel-architecture.md](./kernel-architecture.md)
- [AUDIT-001-repository-health.md](../audits/AUDIT-001-repository-health.md)
