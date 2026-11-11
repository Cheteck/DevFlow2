# Cycle de Vie — Supervisor → ManagedService → Process

> Date : 2026-10-31
> Contexte : Critique architecturale @mosaix/dev-server

Ce document décrit le cycle de vie **actuel** du DevSupervisor et la
**cible** avec l'abstraction `ManagedService`.

---

## 1. Cycle de vie ACTUEL (DevSupervisor)

### 1.1 Démarrage

```
┌──────────────────────────────────────────────────────────────────┐
│ DevSupervisor.start()                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. wireAppLogs()          (no-op, legacy hook)                 │
│  2. bus.emit SYSTEM "starting"                                   │
│  3. watcher.start()        (watch .env, .env.local)             │
│  4. emit WATCH "Watching ..."                                    │
│  5. api.start()            (spawn + readiness "listening on")   │
│  6. mcp.start()            (spawn, stdout isolé)                │
│  7. installSignals()       (SIGINT/SIGTERM → shutdown)          │
│  8. if useTui → startTui() else emit "text mode"                │
│  9. render()                                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Machine à états d'un service (ManagedProcess)

```
                        ┌─────────┐
                  ┌────│ STOPPED  │◄──────────────────────┐
                  │    └────┬─────┘                        │
                  │         │ start()                       │
                  │         ▼                               │
                  │    ┌──────────┐                         │
                  │    │ STARTING │                         │
                  │    └──┬───┬───┘                         │
                  │       │   │                             │
          failure pattern   │ log pattern match              │
                  │       │   │                             │
                  │       ▼   ▼                             │
                  │  ┌───────┐ ┌─────────┐                  │
                  │  │FAILED │ │ READY   │                  │
                  │  └───┬───┘ └────┬────┘                  │
                  │      │          │                       │
                  │      │   (readiness timeout)            │
                  │      │          │                       │
                  │      │          ▼                       │
                  │      │    ┌─────────┐                   │
                  │      │    │ RUNNING │─────────────────┐ │
                  │      │    └──┬───┬──┘                 │ │
                  │      │       │   │                     │ │
                  │      │  crash│   │ stop()              │ │
                  │      │       │   │                     │ │
                  │      ▼       ▼   ▼                     │ │
                  │  ┌─────────┐ ┌─────────┐               │ │
                  └──│ CRASHED │ │STOPPING │               │ │
                     └─────────┘ └────┬────┘               │ │
                          ▲           │                     │ │
                          │    SIGTERM → grace → taskkill   │ │
                          │           ▼                     │ │
                          │      exit event                 │ │
                          └──────────────┘                  │ │
                                                             │
                     (unhandled exit during STARTING/RUNNING)
```

**Notes :**
- `RUNNING` = processus vivant, readiness non confirmée (JAMAIS "serving")
- `READY` = signal réel observé (log pattern, future: probe)
- `FAILED` = processus vivant mais service incapable de servir (EADDRINUSE…)
- `CRASHED` = sortie inattendue → backoff exponentiel capped

### 1.3 Cycle de restart (EnvWatcher)

```
.env change
    │
    ▼
EnvWatcher.notify() ──► debounce 300ms
    │
    ▼
handleEnvEvent()
    │
    ├── watchPaused? ──yes──► emit WATCH "no restart scheduled"
    │
    └──no──► scheduleRestart("WATCH <file>", scope="all")
                 │
                 ▼
         ┌────────────────────────────────────┐
         │ Serialized chain (mutex+token):    │
         │  token = ++restartToken            │
         │  chain = chain.then(runRestart)    │
         └─────────────┬──────────────────────┘
                       ▼
            runRestart(reason, scope, token)
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
        stop each          start each
        (sequential)       (sequential)
        SIGTERM→grace→     spawn +
        taskkill           readiness wait
              │                 │
              └────────┬────────┘
                       ▼
              tracker.begin/finish
              emit SYSTEM done/timeout
              render()
```

**Propriétés :**
- Un nouveau trigger annule l'exécution en cours via `token`
- Les stops sont séquentiels (jamais 2 children morts en parallèle)
- `waitForReady` après spawn : si timeout → outcome `timeout` (warn)

### 1.4 Shutdown

```
SIGINT / SIGTERM / Q key / palette quit
    │
    ▼
shutdown(signal)
    │
    ├─ shuttingDown = true; restartToken++
    ├─ bus.emit "Shutting down"
    ├─ stop UI (heartbeat, keypress, renderer.dispose, rawMode off)
    ├─ watcher.dispose()
    ├─ Promise.all([api.stop, mcp.stop])   (SIGTERM → grace → SIGKILL)
    ├─ forceKill() x2 (belt & braces, no orphans)
    ├─ markDisposed() x2
    └─ bus.emit "Shutdown complete"
         └─ setTimeout(process.exit(0), 100) (hors test)
```

---

## 2. Cycle de vie CIBLE (ManagedService)

### 2.1 Niveaux d'abstraction

```
┌─────────────────────────────────────────────────────────────────┐
│ DevSupervisor                                                    │
│  - possède un ServiceRegistry                                    │
│  - orchestre restarts (scope: service ou "all")                  │
│  - TUI / fallback texte                                          │
├─────────────────────────────────────────────────────────────────┤
│ ServiceRegistry                                                  │
│  - registre déclaratif : ServiceSpec[]                           │
│  - fabrique un ManagedService par spec                           │
│  - calcule l'état global (computeOverall)                        │
├─────────────────────────────────────────────────────────────────┤
│ ManagedService (nouvelle couche)                                 │
│  - config : name, command, args, readiness, envVars              │
│  - possède un ManagedProcess (impl. détail)                      │
│  - implémente ReadinessStrategy                                  │
├─────────────────────────────────────────────────────────────────┤
│ ManagedProcess (inchangé)                                        │
│  - spawn/exit/kill, backoff, stdout isolation                    │
│  - état honnête (READY only on real signal)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Séquence cible

```
Supervisor.start()
  │
  ├─ registry = ServiceRegistry.fromConfig(specs)
  ├─ for service of registry.services:
  │     service.start()          ← ManagedService.start()
  │        │
  │        ├─ process.start()
  │        └─ strategy.attach(process)
  │
  └─ installSignals, TUI, render
```

```
EnvWatcher event (.env change)
  │
  ▼
registry.affectedServices(varsChanged)   ← cartographie env→service
  │
  ▼
Supervisor.scheduleRestart(reason, scope=affected)
  │
  ▼
(for service of targets)
  service.stop()  →  service.start()
```

### 2.3 Diagramme de séquence (restart granulaire)

```
EnvWatcher      Registry          Supervisor     api (ManagedSvc)   mcp (ManagedSvc)
    │                │                  │                │                │
    │ .env changed   │                  │                │                │
    ├────────────────►                  │                │                │
    │                │ parse keys       │                │                │
    │                │ PORT=3001        │                │                │
    │                │   → [api]        │                │                │
    │                ├─────────────────►│                │                │
    │                │                  │ scheduleRestart("api")          │
    │                │                  ├───────────────►│                │
    │                │                  │                │ stop (SIGTERM) │
    │                │                  │                │                │
    │                │                  │                │ start (spawn)  │
    │                │                  │                │ READY (pattern)│
    │                │                  │◄───────────────┤                │
    │                │                  │ render         │                │
    │                │                  │  (mcp intouché)│                │
```

**Gain :** un changement de `PORT` ne redémarre **que l'api**.

---

## 3. États globaux (invariants)

```
computeOverall(services):
    any FAILED/CRASHED                     → DOWN
    all READY (mcp: RUNNING accepté)       → OPERATIONAL
    api READY && mcp ∈ {RUNNING, READY}    → OPERATIONAL
    any STARTING/STOPPING                  → STARTING
    else                                   → DEGRADED
```

**Invariants (à préserver dans la migration) :**
1. Un processus vivant n'est JAMAIS "opérationnel" sans readiness
2. Un restart en cours est annulé par un token de génération
3. Aucun orphelin : `forceKill` + `markDisposed` au shutdown
4. MCP stdout est toujours drainé, jamais affiché
5. Les secrets sont redactés avant toute sortie visible

---

## 4. Matrice des transitions (ManagedProcess)

| Depuis | Événement | Vers |
|--------|-----------|------|
| STOPPED | `start()` | STARTING |
| STARTING | log pattern match | READY |
| STARTING | failure pattern | FAILED |
| STARTING | timeout | RUNNING (warn) |
| STARTING/RUNNING | exit inattendu | CRASHED |
| RUNNING | stop() | STOPPING |
| READY | stop() | STOPPING |
| STOPPING | exit | STOPPED |
| CRASHED | backoff ok → `start()` | STARTING |
| CRASHED | maxRestarts/min dépassé | CRASHED (stop cycling) |
