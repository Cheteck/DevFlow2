# MOSAIX // DEVELOPER COCKPIT — console `pnpm dev`

Cockpit développeur graphite/bleu nuit supervisant le Platform Server et le
MCP Server. Zéro nouvelle dépendance (rendu ANSI maison, Node builtins).

## Lancement

```bash
pnpm dev                 # cockpit si terminal interactif, sinon texte
pnpm dev -- --no-tui     # sortie texte préfixée ([api]/[mcp]/[watch]/[system])
pnpm dev -- --debounce 500
NO_COLOR=1 pnpm dev      # sans couleurs (CI-safe)
```

## Composition

- **Header compact** — identité, mode DEV, état global réel, `n/n up`,
  incidents, durée session. Seconde ligne atténuée : watch + restarts.
- **Services** — API et MCP côte à côte (≥96 cols) ou empilés : PID, uptime,
  restarts, statut de disponibilité. Largeur réellement exploitée.
- **Incidents** — résumés actionnables (service, problème, code, hint),
  jamais de dumps bruts. Logs complets via L.
- **Timeline** — 6 derniers événements (4 en étroit), tag + horodatage.
- **Logs secondaires** — masqués par défaut (`N lines buffered`), L pour
  développer, E pour erreurs seules, C pour effacer la vue.
- **Restart** — dernier cycle en une ligne mesurée.

## États (cohérence : vivant ≠ opérationnel)

| État              | Sens                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| READY             | disponibilité confirmée (signal réel) — seul compté `up` (MCP excepté)             |
| RUNNING           | processus vivant. MCP : normal (pas de sonde). API : **ambre**, non compté `up`    |
| FAILED            | le service a déclaré ne pas pouvoir servir (EADDRINUSE…), processus parfois vivant |
| STARTING/STOPPING | transitoire (ambre)                                                                |
| CRASHED           | sortie inattendue                                                                  |
| STOPPED           | arrêté proprement                                                                  |

Global : `OPERATIONAL` = API READY (+ MCP RUNNING/READY) ; `FAILED/CRASHED`
→ `DOWN` ; API vivante non confirmée → `DEGRADED` ; boot → `STARTING`.

## Readiness (réelle, par service)

- **API** : motif `/listening on/i` (cf. `src/start.ts`) + détection d'échec
  (`EADDRINUSE`, `address already in use`, `listen EACCES…`). Sans signal
  sous 25 s → `RUNNING` ambre explicite, jamais `READY` usurpé.
- **MCP** : stdio sans signal applicatif → `RUNNING` normal. Stdout pipé +
  drainé, jamais rendu (protocole intact).

## Raccourcis

| Touche     | Effet réel                                                |
| ---------- | --------------------------------------------------------- |
| R          | restart séquentiel sûr (stop attendu → spawn → readiness) |
| L          | développer / réduire les logs                             |
| E          | filtre erreurs uniquement                                 |
| C          | efface la vue logs (événements/cycles préservés)          |
| P          | pause/reprend le watch `.env` (supervision continue)      |
| 1 / 2      | filtre platform / MCP                                     |
| ?          | aide                                                      |
| Q / Ctrl+C | arrêt gracieux (SIGTERM → arbre tué, pas d'orphelins)     |

## Moteur de rendu (P0 duplication — corrigé)

Un seul `TerminalRenderer` par session, créé une fois dans `startTui`,
jamais recréé. Repaints **en place** par adressage curseur
(`\x1b[{n}A` + `\x1b[K`), jamais d'effacement plein écran par frame :
pas d'accumulation, pas de scroll permanent. Rafales coalescées
(`setImmediate`, aucun timer par refresh) ; heartbeat unique 1 Hz.
`vtSupported()` exclut les terminaux sans VT (vieux CMD, `TERM=dumb`,
CI) → repli texte, jamais de séquences ignorées. Resize : un seul
ré-ancrage. Fermeture : curseur restauré, listeners retirés, file vidée.

## Pourquoi pas Ink/React

Zéro dépendance runtime ; isolation protocole MCP ; rendu string pur testé
en unitaire + fallback texte déterministe ; Windows/CI fiables.

## Sécurité secrets

`secret-guard.ts` unique avant timeline/logs/erreurs (`KEY=<redacted>`,
`Bearer` masqués). Seuls les NOMS de variables sont affichés. `.env`
jamais lus ni réécrits.

## Fiabilité

Supervision indépendante, un processus par service, restarts sérialisés
(mutex + génération), backoff 500 ms → 8 s (max 5/min). Arrêt : SIGTERM,
grâce 1 s sous Windows puis `taskkill /T /F`. Watchers `.env` : debounce
300 ms, recréation après `rename`, répertoire suivi si fichier absent.

## Architecture (`packages/dev-server/src/command-center/`)

`supervisor-types.ts` · `secret-guard.ts` · `event-bus.ts` ·
`process-manager.ts` (dont `summarizeFailureLine`) · `env-watcher.ts` ·
`restart-tracker.ts` · `diagnostics.ts` · `renderer.ts` (`isUp`,
`computeOverall` dans `supervisor.ts`) · `supervisor.ts` ·
`command-center.test.ts`
