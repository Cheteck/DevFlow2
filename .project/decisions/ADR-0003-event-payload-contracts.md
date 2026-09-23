# ADR-0003 — Event Payload Contracts (validation au publish)

- **Date :** 2026-08-05
- **Statut :** Accepted
- **Décideurs :** Architecture Steward
- **Lié à :** roadmap §4.1 (Flow A step 1), §4.2 ; ADR-0001, ADR-0002 ; T-17 ; Identity reference app

## Context

La roadmap §4.1 (Flow A) exige que le payload d'un événement soit **validé
contre un schéma enregistré** au moment du publish, en plus de la vérification
d'ownership existante. Aujourd'hui `EventSchemaEntry.schema` est un
`Record<string, unknown>` toujours vide : aucune façon de déclarer un contrat
de payload. Le résidu T-17 du backlog (validation structurelle du payload au
hot path publish) n'est donc pas implémentable sans une évolution du framework.

Par ailleurs, la mission Identity exige qu'une capacité générique manquante
soit **livrée dans le framework avant** l'implémentation applicative — la
validation de payload est un besoin générique du backbone, pas un contournement
propre à une app.

## Decision

### 1. Contrat de payload optionnel et additif

`EventSchemaEntry` gagne un champ optionnel :

```ts
interface PayloadValidator {
  safeParse(input: unknown): { success: boolean; error?: unknown };
}

interface EventSchemaEntry {
  type: string;
  version: string;
  ownerApp: string;
  schema: Record<string, unknown>;
  payloadSchema?: PayloadValidator;   // NOUVEAU
}
```

`PayloadValidator` est **structurellement compatible avec les schémas Zod**
(`safeParse`), donc une app peut enregistrer son schéma Zod tel quel — le
framework n'importe jamais Zod.

### 2. Tolérance backward-compatible

Sans `payloadSchema` enregistré pour un événement, le payload est **accepté**
(comportement actuel préservé). La validation est donc additive : aucun des
117 tests existants ne change de comportement.

### 3. Validation au publish (hot path)

`DomainEventBus.publish` reçoit un paramètre optionnel `payloadCheck?`
(4e argument, après `schemaCheck`). La validation s'exécute :

```
enveloppe valide (MosaixEventEnvelopeSchema)
  → ownership (validateEnvelope)
  → PAYLOAD (payloadCheck)              ← NOUVEAU (roadmap §4.1 step 1)
  → permission publish
```

Échec → `EventError` explicite « Payload validation failed » (jamais silencieux,
jamais de fire-and-forget).

### 4. Exposition SDK-first

`MosaixApp.registerEventSchema(entry: Omit<EventSchemaEntry, "ownerApp">)` :
l'owner est toujours l'app qui déclare le schéma (`kernel.registerEventSchema`
avec `ownerApp: manifest.id`). L'app écrit son contrat dans son propre code.

## Consequences

### Positive

- T-17 partiel clôturé : validation structurelle du payload réellement branchée.
- Les événements PII (ex. `identity.user.created`) sont protégés contre les
  payloads invalides ou fuitant les credentials (test dédié).
- Le contrat de payload vit à côté du domaine qui le produit (schémas Zod
  dans `apps/identity/src/events/`), consommé au runtime par le kernel.
- Aucune migration : comportement inchangé sans `payloadSchema`.

### Negative

- Coût de validation sur le hot path publish (négligeable : `safeParse`).
- Deux mécanismes possibles (schéma Zod app vs validateur manuscrit) — la
  tolérance sans schéma peut laisser des événements non validés.

### Risks

- **Schéma non enregistré** → publish toléré : acceptable (rétro-compatibilité),
  documenté dans le README d'app (toute app de référence enregistre ses contrats).
- **Zod versionné côté app** → compatible structurellement ; aucune dépendance
  Zod dans `@mosaix/core` (ADR-0001 : schémas séparés).

## Alternatives considered

1. **Importer Zod dans `@mosaix/core`** — rejeté : impose Zod aux consommateurs
   de types et viole ADR-0001 (validators dans `@mosaix/schemas`, jamais dans
   `types`/`core`).
2. **Faire de la validation un module kernel dédié** — rejeté : l'evolution est
   additive et locale au bus ; un module serait une sur-ingénierie ici.
3. **Rejeter les événements sans schéma** — rejeté : breaking change non justifié
   (schémas pas encore déclarés partout).
