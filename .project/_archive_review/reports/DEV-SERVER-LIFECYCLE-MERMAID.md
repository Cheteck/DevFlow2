# Diagrammes — Dev Server Lifecycle

> Date : 2026-10-31
> Outil : Mermaid (compatible GitHub, VSCode, Notion)

---

## 1. Cycle de vie ManagedProcess (état actuel)

```mermaid
stateDiagram-v2
    [*] --> STOPPED
    
    STOPPED --> STARTING : start()
    
    state STARTING {
        [*] --> CheckingReadiness
        CheckingReadiness --> READY : log pattern match
        CheckingReadiness --> FAILED : failure pattern (EADDRINUSE)
        CheckingReadiness --> RUNNING : timeout
    }
    
    READY --> STOPPING : stop()
    RUNNING --> STOPPING : stop()
    FAILED --> STOPPING : stop()
    
    STARTING --> CRASHED : exit inattendu
    RUNNING --> CRASHED : exit inattendu
    READY --> CRASHED : exit inattendu
    
    CRASHED --> STARTING : backoff OK
    CRASHED --> [*] : maxRestarts dépassé
    
    STOPPING --> STOPPED : exit
    STOPPED --> [*]
    
    note right of READY
      READY = signal réel observé
      (ex: "listening on")
    end note
    
    note right of RUNNING
      RUNNING ≠ opérationnel
      readiness non confirmée
    end note
    
    note right of FAILED
      FAILED = processus vivant
      mais service incapable de servir
    end note
```

---

## 2. Séquence de démarrage (DevSupervisor)

```mermaid
sequenceDiagram
    participant S as DevSupervisor
    participant B as EventBus
    participant W as EnvWatcher
    participant A as api (ManagedProcess)
    participant M as mcp (ManagedProcess)
    participant T as TerminalRenderer
    participant U as UI (keypress)
    
    S->>B: emit SYSTEM "starting"
    S->>W: start()
    B-->>S: emit WATCH "Watching .env"
    
    S->>A: start()
    activate A
    A-->>S: spawn + readiness wait
    deactivate A
    
    S->>M: start()
    activate M
    M-->>S: spawn (stdout isolé)
    deactivate M
    
    S->>U: installSignals(SIGINT/SIGTERM)
    
    alt TUI enabled
        S->>T: start()
        T-->>S: heartbeat 1000ms
    else Text mode
        S-->>B: emit SYSTEM "text mode"
    end
    
    S->>T: render()
```

---

## 3. Restart déclenché par .env change

```mermaid
sequenceDiagram
    participant E as EnvWatcher
    participant S as DevSupervisor
    participant R as RestartTracker
    participant A as api (ManagedProcess)
    participant M as mcp (ManagedProcess)
    
    E->>S: notify(.env changed)
    activate S
    
    S->>S: debounce 300ms
    
    S->>R: tracker.begin("all", "WATCH .env")
    
    S->>A: stop("restart")
    activate A
    A-->>S: SIGTERM → grace → exit
    deactivate A
    
    S->>M: stop("restart")
    activate M
    M-->>S: SIGTERM → grace → exit
    deactivate M
    
    S->>R: mark stopRequestedAt
    
    S->>A: start()
    activate A
    A-->>S: spawn + READY
    deactivate A
    
    S->>M: start()
    activate M
    M-->>S: spawn + RUNNING
    deactivate M
    
    S->>R: mark readyAt, finish("completed")
    
    S-->>E: render()
    deactivate S
```

---

## 4. Architecture CIBLE (avec ManagedService)

```mermaid
classDiagram
    class DevSupervisor {
        -ServiceRegistry registry
        -EventBus bus
        -EnvWatcher watcher
        -TerminalRenderer screen
        +start()
        +shutdown(signal)
        +scheduleRestart(reason, scope)
        +snapshot()
    }
    
    class ServiceRegistry {
        -ServiceSpec[] specs
        -ManagedService[] services
        +fromConfig(specs)
        +affectedServices(changedEnvVars)
        +computeOverall()
    }
    
    class ManagedService {
        -ServiceSpec spec
        -ManagedProcess process
        -ReadinessStrategy strategy
        +start()
        +stop()
        +isReady()
        +snapshot()
    }
    
    class ManagedProcess {
        -ChildProcess child
        -ServiceState state
        -ReadinessSpec readiness
        +start()
        +stop()
        +waitForReady()
        +snapshotBoot()
    }
    
    class ReadinessStrategy {
        <<interface>>
        +attach(process)
        +isReady()
        +dispose()
    }
    
    class LogPatternStrategy {
        -RegExp pattern
        -Number timeoutMs
        +attach(process)
        +isReady()
    }
    
    class HttpProbeStrategy {
        -String url
        -Number intervalMs
        +attach(process)
        +isReady()
    }
    
    class EnvServiceMap {
        -EnvServiceMapping[] mappings
        +affectedServices(changedVars)
    }
    
    DevSupervisor --> ServiceRegistry
    ServiceRegistry --> ManagedService
    ManagedService --> ManagedProcess
    ManagedService --> ReadinessStrategy
    LogPatternStrategy ..|> ReadinessStrategy
    HttpProbeStrategy ..|> ReadinessStrategy
    ServiceRegistry --> EnvServiceMap
```

---

## 5. Shutdown graceful

```mermaid
flowchart TD
    A[SIGINT / SIGTERM / Q key] --> B[shuttingDown = true]
    B --> C[restartToken++]
    C --> D[bus.emit Shutting down]
    
    D --> E1[Stop UI heartbeat]
    D --> E2[Stop keypress handler]
    D --> E3[renderer.dispose]
    D --> E4[rawMode off]
    
    E1 --> F[watcher.dispose]
    E2 --> F
    E3 --> F
    E4 --> F
    
    F --> G1[api.stop SIGTERM]
    F --> G2[mcp.stop SIGTERM]
    
    G1 --> H{grace timeout?}
    G2 --> H
    
    H -->|yes| I1[taskkill /T /F]
    H -->|no| I2[wait exit]
    
    I1 --> J[forceKill x2]
    I2 --> J
    
    J --> K[markDisposed x2]
    K --> L[bus.emit Shutdown complete]
    L --> M[process.exit 0]
```

---

## 6. Calcul état global (computeOverall)

```mermaid
flowchart TD
    A[Snapshot services] --> B{any FAILED/CRASHED?}
    B -->|yes| C[DOWN]
    
    B -->|no| D{all READY?}
    D -->|yes| E[OPERATIONAL]
    
    D -->|no| F{api READY && mcp RUNNING/READY?}
    F -->|yes| E
    
    F -->|no| G{any STARTING/STOPPING?}
    G -->|yes| H[STARTING]
    
    G -->|no| I[DEGRADED]
    
    style C fill:#ff6b6b
    style E fill:#51cf66
    style H fill:#fcc419
    style I fill:#ff922b
```

---

## 7. Restart serialization (mutex + token)

```mermaid
sequenceDiagram
    participant T1 as Trigger 1 (.env)
    participant S as Supervisor
    participant T2 as Trigger 2 (manual R)
    participant C as Restart Chain
    
    T1->>S: scheduleRestart("WATCH .env")
    S->>S: token = ++restartToken (token=1)
    S->>C: chain = chain.then(runRestart token=1)
    
    Note over C: runRestart starts...
    
    T2->>S: scheduleRestart("manual R")
    S->>S: token = ++restartToken (token=2)
    S->>C: chain = chain.then(runRestart token=2)
    
    Note over C: token=1 running, token=2 queued
    
    C->>C: runRestart token=1 completes
    C->>C: check token == restartToken?
    
    alt token mismatch (2 != 2?)
        C-->>S: cancel runRestart token=1
    else token match
        C->>C: runRestart token=2 starts
    end
```

---

## 8. Arbre de décision readiness

```mermaid
graph TD
    A[Process spawned] --> B{readiness pattern?}
    
    B -->|no MCP| C[ state = RUNNING ]
    C --> D[ readiness = "unknown (no probe)" ]
    
    B -->|yes API| E{log chunk}
    
    E --> F{failure pattern?}
    F -->|yes EADDRINUSE| G[ state = FAILED ]
    G --> H[ readiness = "startup failed" ]
    
    F -->|no| I{readiness pattern?}
    I -->|yes| J[ state = READY ]
    J --> K[ readiness = "confirmed" ]
    
    I -->|no| L{timeout?}
    L -->|yes| M[ state = RUNNING ]
    M --> N[ readiness = "awaiting log signal" ]
    L -->|no| E
```

---

## 9. Mapping env → service (futur)

```mermaid
graph LR
    A[.env change] --> B[EnvWatcher]
    B --> C[parse changed vars]
    
    C --> D{PORT changed}
    D -->|yes| E[affected = api]
    
    C --> F{MCP_ changed}
    F -->|yes| G[affected = mcp]
    
    C --> H{API_ changed}
    H -->|yes| I[affected = api]
    
    C --> J{autre var}
    J -->|yes| K[affected = all fallback]
    
    E --> L[scheduleRestart scope=api]
    G --> M[scheduleRestart scope=mcp]
    I --> L
    K --> N[scheduleRestart scope=all]
```
