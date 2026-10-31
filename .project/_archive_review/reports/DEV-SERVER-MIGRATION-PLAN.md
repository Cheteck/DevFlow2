# Plan de Migration — Dev Server Decomposition

> Date : 2026-10-31
> Statut : Proposed
> Risque : Medium
> Effort estimé : 3-5 jours

Ce plan décrit comment découpler `@mosaix/command-center` de
`@mosaix/dev-server` **sans breaking changes** pour les consommateurs
existants.

---

## Phase 0 : Préparation (Day 0)

### Objectifs
- Audit des imports existants
- Validation des tests actuels
- Branch de migration

### Tâches

| # | Tâche | Owner | Durée |
|---|-------|-------|-------|
| 0.1 | `git branch -b migrate/command-center-decouple` | Steward | 5min |
| 0.2 | `grep -r "from '@mosaix/dev-server'" packages/ apps/` | Steward | 10min |
| 0.3 | Lister les exports utilisés dans `index.ts` | Steward | 10min |
| 0.4 | Vérifier que tous les tests passent (`pnpm test`) | Steward | 15min |
| 0.5 | Créer `.project/reports/DEV-SERVER-MIGRATION-LOG.md` | Steward | 5min |

**Livrable :** Rapport d'imports existants

---

## Phase 1 : Extraction du Command Center (Day 1)

### Objectif
Créer le package `@mosaix/command-center` sans modifier `dev-server`.

### Tâches

| # | Tâche | Owner | Durée |
|---|-------|-------|-------|
| 1.1 | `mkdir -p packages/command-center/src/command-center` | Steward | 2min |
| 1.2 | Copier tous les fichiers `command-center/` de `dev-server` | Steward | 5min |
| 1.3 | Créer `packages/command-center/package.json` | Steward | 10min |
| 1.4 | Créer `packages/command-center/tsconfig.json` | Steward | 5min |
| 1.5 | Créer `packages/command-center/src/index.ts` (exports) | Steward | 15min |
| 1.6 | Mettre à jour les imports internes (`./command-center/...`) | Steward | 20min |
| 1.7 | `pnpm install` (workspace link) | Steward | 10min |
| 1.8 | `pnpm -F @mosaix/command-center build` | Steward | 5min |
| 1.9 | Copier `responsibilities.md` adapté | Steward | 10min |

**`package.json` cible :**
```json
{
  "name": "@mosaix/command-center",
  "version": "0.1.0",
  "description": "MOSAIX Command Center — TUI Supervisor for Dev Processes",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run"
  },
  "dependencies": {
    "@mosaix/dev-session": "workspace:*"
  },
  "devOnly": true,
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
}
```

**Livrable :** Package `@mosaix/command-center` buildable

---

## Phase 2 : Dual-write dans dev-server (Day 2)

### Objectif
Maintenir la compatibilité : `dev-server` ré-exporte `command-center`.

### Tâches

| # | Tâche | Owner | Durée |
|---|-------|-------|-------|
| 2.1 | Ajouter `@mosaix/command-center` aux deps de `dev-server` | Steward | 2min |
| 2.2 | Modifier `dev-server/src/index.ts` : ré-exporter depuis `command-center` | Steward | 10min |
| 2.3 | `pnpm -F @mosaix/dev-server build` | Steward | 5min |
| 2.4 | Vérifier que les tests passent toujours | Steward | 10min |
| 2.5 | Tester l'import legacy : `import { DevSupervisor } from '@mosaix/dev-server'` | Steward | 10min |

**`dev-server/src/index.ts` cible :**
```typescript
/**
 * @mosaix/dev-server — public entry. Re-exports the HMR DevServer (legacy
 * API, kept stable) and the MOSAIX // COMMAND CENTER cockpit.
 *
 * DEPRECATED (v0.2.0): Import @mosaix/command-center directly.
 */

// Legacy HMR API (kept here)
export * from "./dev-server.js";

// Re-export Command Center (transitional, will be removed in v0.2.0)
export * from "@mosaix/command-center";
```

**Livrable :** Compatibilité maintenue, aucun breaking change

---

## Phase 3 : Migration des consommateurs (Day 3)

### Objectif
Migrer CLI et autres packages vers `@mosaix/command-center`.

### Tâches

| # | Tâche | Owner | Durée |
|---|-------|-------|-------|
| 3.1 | Identifier tous les imports `command-center` dans CLI | Steward | 10min |
| 3.2 | Remplacer `from '@mosaix/dev-server'` par `from '@mosaix/command-center'` | Steward | 20min |
| 3.3 | `pnpm -F @mosaix/cli build` | Steward | 5min |
| 3.4 | Tester `mosaix dev` en mode TUI | Steward | 15min |
| 3.5 | Tester `mosaix dev --no-tui` | Steward | 10min |
| 3.6 | Mettre à jour la doc CLI si nécessaire | Steward | 10min |

**Fichiers à migrer (probables) :**
- `packages/cli/src/dev-server/dev-server.ts` (si import supervisor)
- `packages/cli/src/start.ts` (si import renderer)
- Tests CLI

**Livrable :** CLI migré, tests verts

---

## Phase 4 : Nettoyage (Day 4)

### Objectif
Supprimer les ré-exports legacy, documenter la dépréciation.

### Tâches

| # | Tâche | Owner | Durée |
|---|-------|-------|-------|
| 4.1 | Retirer les exports `command-center/` de `dev-server/src/index.ts` | Steward | 5min |
| 4.2 | Ajouter un warning dépréciation (JSDoc `@deprecated`) | Steward | 5min |
| 4.3 | Mettre à jour `dev-server/responsibilities.md` | Steward | 10min |
| 4.4 | Créer `command-center/responsibilities.md` | Steward | 10min |
| 4.5 | Mettre à jour `eslint-plugin-boundaries` | Steward | 10min |
| 4.6 | `pnpm test` (tous packages) | Steward | 15min |
| 4.7 | `git commit -m "refactor: decouple @mosaix/command-center"` | Steward | 5min |

**`dev-server/src/index.ts` post-nettoyage :**
```typescript
/**
 * @mosaix/dev-server — MosaiX Dev Server & Real HMR Event Broadcaster
 *
 * @deprecated (v0.2.0) For TUI supervision, use @mosaix/command-center instead.
 * This package now focuses on HMR session management only.
 */
export * from "./dev-server.js";

// Command Center exports REMOVED — import from @mosaix/command-center
```

**Livrable :** Séparation complète, documentation à jour

---

## Phase 5 : Améliitations futures (Backlog)

Ces tâches ne sont **pas bloquantes** pour la migration, mais sont les
prochaines étapes recommandées par ChatGPT.

### 5.1 Registre déclaratif de services

**Objectif :** Permettre l'ajout d'un `worker` sans modifier le supervisor.

**Fichier :** `packages/command-center/src/service-registry.ts`

```typescript
export interface ServiceSpec {
  name: string;
  label: string;
  command: string;
  args: string[];
  readiness?: ReadinessSpec;
  envVars?: string[];  // variables qui déclenchent un restart
}

export class ServiceRegistry {
  constructor(specs: ServiceSpec[]);
  get services(): ManagedService[];
  affectedServices(changedEnvVars: string[]): ServiceName[];
  computeOverall(): OverallStatus;
}
```

**Impact :** `DevSupervisor` utilise `ServiceRegistry` au lieu de coder en dur
`api` et `mcp`.

---

### 5.2 Stratégies de readiness pluggables

**Objectif :** Supporter différents types de readiness (log, HTTP, TCP, stdio).

**Fichier :** `packages/command-center/src/readiness-strategy.ts`

```typescript
export interface ReadinessStrategy {
  attach(process: ManagedProcess): void;
  isReady(): boolean;
  dispose(): void;
}

export class LogPatternStrategy implements ReadinessStrategy {
  constructor(pattern: RegExp, timeoutMs: number);
  // ...
}

export class HttpProbeStrategy implements ReadinessStrategy {
  constructor(url: string, intervalMs: number, timeoutMs: number);
  // ...
}

export class StdioHandshakeStrategy implements ReadinessStrategy {
  constructor(expectedMessage: string, timeoutMs: number);
  // ...
}
```

**Impact :** MCP peut avoir une vraie readiness (ex: message "READY" sur stdout).

---

### 5.3 Mapping env → service

**Objectif :** Restart granulaire (uniquement le service concerné).

**Fichier :** `packages/command-center/src/env-service-map.ts`

```typescript
export interface EnvServiceMapping {
  varPattern: RegExp;  // ex: /^API_/
  serviceName: ServiceName;
}

export class EnvServiceMap {
  constructor(mappings: EnvServiceMapping[]);
  affectedServices(changedVars: string[]): ServiceName[];
}
```

**Exemple de config :**
```typescript
const defaultMappings: EnvServiceMapping[] = [
  { varPattern: /^API_/i, serviceName: 'api' },
  { varPattern: /^MCP_/i, serviceName: 'mcp' },
  { varPattern: /^PORT$/i, serviceName: 'api' },
  { varPattern: /^.*$/i, serviceName: 'all' },  // fallback
];
```

---

### 5.4 Persistence JSONL

**Objectif :** Conserver l'historique après restart supervisor.

**Fichier :** `packages/command-center/src/jsonl-writer.ts`

```typescript
export interface JsonlWriterOptions {
  filePath: string;  // ex: .mosaix/events.jsonl
  rotation?: {
    maxFileSizeMB: number;
    maxFiles: number;
  };
}

export class JsonlWriter {
  constructor(opts: JsonlWriterOptions);
  write(event: SupervisorEvent | LogEntry): void;
  rotate(): void;
  dispose(): void;
}
```

**Impact :** Au démarrage, le supervisor peut relire les N derniers événements.

---

### 5.5 Tests du cycle de vie

**Fichier :** `packages/command-center/src/command-center.test.ts`

**Scenarios à couvrir :**
1. `start()` → api READY, mcp RUNNING
2. `.env change` → restart api only (si mapping)
3. `EADDRINUSE` → FAILED, pas CRASHED
4. `SIGTERM` → graceful shutdown, pas d'orphelin
5. `maxRestartsPerMinute` dépassé → stop cycling
6. Concurrent restarts → serialized, token annule l'ancien
7. TUI non-TTY → fallback texte

---

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Breaking change involontaire | Medium | High | Dual-write phase 2, tests CLI |
| Imports circulaires dev-server ↔ command-center | Low | Medium | Audit avant extraction, eslint boundaries |
| Perte de fonctionnalité TUI | Low | Medium | Test manuel `mosaix dev` avant merge |
| Migration trop longue | Medium | Low | Découper en PRs par phase |
| Tests manquants | High | Medium | Phase 5.5 obligatoire avant prod |

---

## Critères d'acceptation (Definition of Done)

- [ ] Package `@mosaix/command-center` créé et buildable
- [ ] `@mosaix/dev-server` ré-exporte (phase 2) puis retire (phase 4)
- [ ] CLI migré et testé (`mosaix dev` TUI + headless)
- [ ] Tests existants passent toujours
- [ ] Documentation mise à jour (`responsibilities.md`)
- [ ] Boundaries eslint configurées
- [ ] ADR-0023 créé et lié
- [ ] Changelog mis à jour

---

## Timeline estimée

```
Day 0: Préparation (audit, branch)
Day 1: Extraction command-center
Day 2: Dual-write (compatibilité)
Day 3: Migration CLI
Day 4: Nettoyage + docs
Day 5: Tests + buffer
```

**Total : 3-5 jours** (selon la complexité des imports existants)
