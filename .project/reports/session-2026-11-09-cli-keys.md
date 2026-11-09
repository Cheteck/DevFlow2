## Session Report — Correction touches clavier CLI MosaiX (suite)

**Date :** 2026-11-09
**Branche :** `fix/p0-migration-contracts`
**Commits :** `b735b8d` → `dd85d7f` → `21dee4f` → `3254900` → `67cc7a6`
**Rollback :** `git reset --hard 9c8d21b`

### Objectif
Corriger le non-fonctionnement des touches `1`–`6`, `r`, `s`, `a`, `Tab`, `Ctrl+K`, `Q` pour naviguer entre les 6 vues du CLI, et ajouter les informations d'accès à la TUI dans l'interface.

### Travaux réalisés — P0 (bugs fonctionnels silencieux) — TOUS CORRIGÉS ✅

| ID | Fichier | Correction |
|----|---------|------------|
| **BUG-01** | `supervisor.ts` | `handleKey()` : 1=dashboard, 2=processes, 3=logs, 4=diagnostics, 5=environment, 6=sessions via `viewManager.setActiveView()`. `F` pour serviceFilter. |
| **BUG-02** | `supervisor.ts` | `render()` : guard `vtSupported()` avant séquences VT brutes, fallback texte pour PowerShell. |
| **BUG-03** | `renderer.ts` | `helpOverlay` : `r`=restart svc, `s`=stop svc, `a`=start svc. |
| **RFIX-01** | `cockpit.ts` | `statusBar` : `r restart` (était `r stop`). |
| **RFIX-02** | `palette.ts` | Hints filter-api/mcp/all : `1`/`2` → `F`. Ajout commandes goto-* (1-6). |
| **RFIX-03** | `supervisor.ts` | `setupKeyboard()` : `previousRawMode` sauvegardé AVANT `setRawMode(true)`. `cleanupKeyboard()` restaure sans condition `isTTY`. |
| **SD-01** | `supervisor.ts` | Suppression du double `setRawMode(false)` redondant dans `shutdown()`. |
| **SD-02** | `supervisor.ts` | `forceKill` conditionné à `isAlive` (évite double-kill Windows). |
| **SD-04** | `process-manager.ts` | Suppression du timer mort dans `waitForExit()`. |

### Travaux réalisés — P1 (dégradations UX) — TOUS CORRIGÉS ✅

| ID | Fichier | Correction |
|----|---------|------------|
| **CLI-01** | `cockpit.ts`, `renderer.ts` | `headerBar` affiche `[DASHBOARD]` / `[PROCESSES]` etc. selon la vue active. |
| **CLI-02** | `cockpit.ts` | `statusBar` : deux lignes si width < 110 cols (actions service + navigation). |
| **CLI-06** | `cockpit.ts`, `supervisor.ts` | `statusBar` utilise `filters.activeView` au lieu de `viewManager.getActiveView()`. `filters.activeView` synchronisé dans `handleKey()`. Import `viewManager` supprimé de `cockpit.ts`. |
| **SD-03** | `process-manager.ts` | `killTreeWindows(pid, timeoutMs?)` utilise `shutdownTimeoutMs` au lieu de 5000ms hardcodé. |

### Travaux réalisés — P2 (polish) — TOUS CORRIGÉS ✅

| ID | Fichier | Correction |
|----|---------|------------|
| **CLI-03** | `logs-view.ts`, `renderer.ts` | `renderLogsPanel(snapshot, width, enabled, height?)` : `Math.max(5, height - 8)` lignes au lieu de 10 hardcodé. |
| **CLI-04** | 5 fichiers views | Suppression imports morts `ViewRenderer` (processes, logs, diagnostics, environment, sessions). |
| **CLI-05** | `renderer.ts` | Early-return `activeView` avant calcul de layout (8 passes d'ajustement évitées). |
| **SD-06** | `supervisor.ts` | Commentaire explicatif sur `setTimeout(() => process.exit(0), 100).unref()`. |

### Non traité (souhaité par l'analyse mais pas requis pour l'objectif)
- **SD-05** : Frame de shutdown TUI visible avant fermeture (effort M, UX fermeture muette — pas critique).

### Validation effectuée
- `tsc --noEmit` : **0 erreur** dans `@mosaix/command-center`.
- `vitest run` : **51/51 tests passants**.

### Git State
- Branche active : `fix/p0-migration-contracts`
- Dernier commit : `67cc7a6`
- Rollback disponible : `git reset --hard 9c8d21b` (5 commits en arrière)