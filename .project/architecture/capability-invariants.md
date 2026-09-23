# Capability Invariants — MosaiX

**Version:** 1.0  
**Scope:** Toute capacité exposée ou consommée via le Capability Registry  
**Reference:** Constitution Laws 2, 3, 6 — ADR-0001, ADR-0002, Roadmap §4.3 (Flow B), Phase 2/4

---

## Invariants

### 1. Synchronous or Asynchronous — Explicit

> Chaque capacité déclare sa nature :
> - `sync: true` → retour direct (`Promise<T>` résolue avant réponse)
> - `sync: false` → asynchrone (dispatched, résultat via event/callback)
> Le Runtime route différemment ; l'appelant connaît le contrat.

### 2. Stable Signature

> Une capacité a une signature immuable par version :
> ```typescript
> interface CapabilityContract {
>   id: string;                    // ex: "identity.user.lookup"
>   version: string;               // SemVer: "1.0.0"
>   input: Schema;                 // Zod/JSON Schema — requis
>   output: Schema;                // Zod/JSON Schema — requis
>   errors: ErrorContract[];       // erreurs typées connues
>   idempotent?: boolean;          // si true, retry safe
>   timeoutMs?: number;            // budget d'exécution
> }
> ```
> Pas de `any`, pas de paramètres optionnels non déclarés.

### 3. Versioned

> Capability = identifiant + version.
> - `identity.user.lookup@1.0.0` ≠ `identity.user.lookup@2.0.0`
> - Négociation automatique : appelant déclare version min/max acceptée
> - Runtime résout la version la plus haute compatible
> - Breaking change = nouvelle version majeure (nouvel ID si signature change)

### 4. Idempotent If Declared

> `idempotent: true` → l'appelant peut réessayer sans effet de bord.
> - Runtime fournit clé d'idempotence optionnelle
> - Fournisseur garantit : même entrée + même clé = même sortie
> - Si non déclaré → jamais réessayé automatiquement

### 5. Never Implicitly Publishes Events

> Une capacité **ne publie jamais** d'événement sans contrat explicite.
> - Si l'exécution produit un fait métier → l'événement est déclaré dans `output` ou dans le manifeste `publishes`
> - Le Runtime ne devine pas ; le contrat dit ce qui arrive
> - Traçabilité : `correlationId` propagé de l'appel capacité → événement publié

### 6. Resolved by Contract, Never by Application

> L'appelant écrit : `kernel.execute("identity.user.lookup", input)`
> **Jamais** : `kernel.resolve("identity")` ou `identityApp.lookupUser()`
> - Le Runtime choisit le fournisseur (version, santé, tenant, policy)
> - Zéro couplage vers l'implémentation

### 7. Declared in Manifest

> Toute capacité fournie ou consommée apparaît dans le manifeste.
> - `capabilities.provides[]` — surface exposée
> - `capabilities.consumes[]` — dépendances déclarées
> - Absent du manifeste = erreur de démarrage (Control Plane)

### 8. Permission-Gated

> Exécution soumise à `domain:capability:execute:scope`.
> - Caller doit avoir la permission explicite
> - Fournisseur déclare `provides` avec scope précis
> - Wildcard `*:capability:*:scope` = justification requise + audit

### 9. Typed RPC with Contract Enforcement

> Au runtime :
> 1. Input validé contre `input` schema
> 2. Exécution (timeout, circuit breaker)
> 3. Output validé contre `output` schema
> 4. Erreurs mappées vers `errors` contract
> Échec validation = `CapabilityError` (typé, non générique)

### 10. Health & Observability

> Chaque capacité expose :
> - `health()` → `{ status, latency, errorRate }`
> - Métriques : appels, succès, échecs, latence p50/p99
> - Tracing : `correlationId` propagé, span dédié

---

## Version Negotiation Algorithm

```
Caller declares:  "identity.user.lookup" ^1.0.0 (>=1.0.0 <2.0.0)
Registry has:     v1.0.0, v1.1.0, v2.0.0
→ Resolves:       v1.1.0 (highest compatible)
```

Si aucune version compatible → `CapabilityError: NO_COMPATIBLE_VERSION`

---

## Governance

- **Registry** : Control Plane valide contrats au déploiement
- **Deprecation** : 2 versions mineures avant retrait (même règle événements)
- **Drift** : Phase 4 — détection fournisseur réel vs contrat déclaré