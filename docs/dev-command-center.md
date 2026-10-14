# MOSAIX // COMMAND CENTER — cockpit multi-panneaux (`pnpm dev`)

Cockpit terminal dense : barre système, grille adaptative 3/2/1 colonnes de
panneaux à bordures fines colorées (titres intégrés), palette de commandes,
barre de statut. Zéro nouvelle dépendance (ANSI maison, Node builtins).

## Lancement

```bash
pnpm dev                 # cockpit si terminal VT, sinon texte
pnpm dev -- --no-tui     # sortie texte préfixée ([api]/[mcp]/[watch]/[system])
pnpm dev -- --debounce 500
NO_COLOR=1 pnpm dev      # sans couleurs (bordures conservées)
```

## Composition

- **Barre système** — `◆ MOSAIX // COMMAND CENTER  DEV  ● ÉTAT  SERVICES
n/n  INCIDENTS n  RESTARTS n  SESSION …` + ligne watch atténuée.
- **INFRASTRUCTURE** (cyan) — API/MCP : état, PID, uptime, restarts,
  disponibilité (`confirmed` / `unconfirmed` ambre / `startup failed`
  rouge), port API **uniquement si connu de l'env** (`:3000`), exit.
  Un processus vivant n'est jamais compté prêt.
- **PROCESS FLEET** (violet) — PID, état, dernier boot, uptime, restarts,
  exit code/signal. Arrêts suivis via exit, dit explicitement.
- **VITALS** (bleu) — watchers, CPU/RSS/heap **mesurés du superviseur**
  (portée étiquetée), boots, exits, restarts.
- **SESSIONS / ACTIVITY** (violet) — événements bornés, horodatés, taggés.
- **DIAGNOSTICS** (rouge si erreur) — incidents triés par gravité : code,
  service, résumé, heure de détection, hint actionnable. Codes :
  `API_PORT_CONFLICT`, `*_STARTUP_FAILED`, `*_NONZERO_EXIT`, `*_CRASHED`,
  `MCP_READINESS_UNKNOWN`, `API_READINESS_UNCONFIRMED`, `*_RESTART_LOOP`,
  `*_SLOW_BOOT`, `ENV_WATCHER_UNAVAILABLE`, `RESTART_LOOP_DETECTED`,
  `RESTART_SLOW`. Aucun incident inventé.
- **LIVE LOGS** (bleu) — repliés par défaut (`N buffered`), L développe,
  E erreurs seules, `1/2` filtre service, `↑/↓` défile (ancre live).
  Stdout MCP **jamais** rendu (protocole intact).
- **RESTART TIME MACHINE** (ambre) — cycles bornés : `#007`, motif, scope,
  durée mesurée, barres `████░░░░` à l'échelle du max, comparaison médiane.
- **Barre de statut** — raccourcis + contexte (`filter:api`,
  `errors-only`, `watch-paused`).

## Raccourcis (tous fonctionnels)

R restart · L logs · E erreurs · C clear · P watch · 1/2 filtre ·
↑/↓ scroll logs · **Ctrl+K palette** (12 commandes : restart all/api/mcp,
filtres, toggles, quit — `↑↓` navigue, `Entrée` exécute, `Échap` ferme ;
la saisie ne déclenche aucun raccourci) · ? aide · Q/Ctrl+C quit gracieux.

## États

READY = serving confirmé (seul compté `up`, + MCP RUNNING sans sonde) ·
RUNNING api = ambre non compté · FAILED = déclaré incapable (même vivant) ·
STARTING/STOPPING ambre · CRASHED rouge · STOPPED gris. Global :
OPERATIONAL / DEGRADED / DOWN / STARTING (`computeOverall`, pur + testé).

## Moteur de rendu (P0 duplication — corrigé, conservé)

Un `TerminalRenderer` par session, repaint en place (`ESC[nA` + `ESC[K`),
rafales coalescées, heartbeat unique 1 Hz, gate `vtSupported()` (repli
texte sinon), ré-ancrage unique au resize, `dispose()` restaure curseur +
retire listeners. Aucun `console.log` en TUI ; logs → buffer borné.

## Sécurité secrets

`secret-guard.ts` unique (`KEY=<redacted>`, `Bearer` masqués). Noms seuls
affichés. `.env` jamais lus ni réécrits.

## Fiabilité (inchangée)

Supervision indépendante, 1 processus/service, restarts sérialisés
(mutex + génération), backoff 500 ms → 8 s (5/min max), SIGTERM + grâce
1 s Windows puis `taskkill /T /F`, watchers debounce 300 ms + recréation.

## Architecture (`packages/dev-server/src/command-center/`)

`supervisor-types.ts` · `secret-guard.ts` · `event-bus.ts` ·
`process-manager.ts` · `env-watcher.ts` · `restart-tracker.ts` ·
`diagnostics.ts` · `theme.ts` (palette) · `format.ts` · `layout.ts`
(grille 3/2/1 + budgets) · `palette.ts` (modèle Ctrl+K) · `cockpit.ts`
(panneaux) · `renderer.ts` (compositeur) · `terminal-renderer.ts`
(moteur) · `supervisor.ts` (+ `resolveKnownPort`, stats hôte) · tests.
