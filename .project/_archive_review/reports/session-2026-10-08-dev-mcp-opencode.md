# Session 2026-10-08 — Dev server + MCP + OpenCode

## Objectif
Vérifier le démarrage normal du dev server (avec MCP) et rendre le MCP accessible dans OpenCode.

## Constats initiaux
- `scripts/dev.ts` lançait déjà les deux processus (plateforme `tsx --watch src/start.ts` + MCP `stdio-server.ts`).
- Échec plateforme : `Cannot find package '@mosaix/auth'` (bootstrap) — dépendance racine manquante.
- Échec MCP : `Cannot find package '@mosaix/intelligence'` (nouveau pont, dépendance manquante).
- `pnpm install` jamais exécuté dans cet arbre → liens workspace absents.

## Corrections appliquées
- `package.json` racine : ajout `@mosaix/auth` + `@apps/portfolio` (`workspace:*`), `pnpm install` → liens créés.
- `src/server/routes/auth-routes.ts` : ajout adaptateur `handleAuthRoutes(req, res, parsedUrl)` style dispatcher (le refactor AUTH-06 n'exportait que `registerAuthRoutes`, cassant l'import de `api-dispatcher.ts:23`).
- `compose.yml` : port `5432:5432` exposé pour le dev host-local ; base `mosaix_dev` déjà présente dans le volume.
- `packages/mcp/src/stdio-server.ts` : repli de résolution `@apps/portfolio` → sources directes (dist non construit).
- `apps/portfolio/src/index.ts` : export manquant `in-memory-vendable-repository.js`.
- Migrations : déjà toutes appliquées (2026-09-27) ; `migrate`/`migrate:status` fonctionnent après le fix DB.
- `C:\Users\EH\.config\opencode\opencode.json` : entrée `mosaix` repointée de `G:\MeshJS-by-Jules\...` vers le stdio-server DevFlow (node + tsx cli, `cwd` repo, `timeout` 30000).

## Validation effectuée
- Plateforme : `HTTP 200` sur `http://localhost:3000/` après restart supervisé (touch `.env`).
- MCP : processus fils actif ; `tools/list` one-shot = 15 outils (dont 3 intelligence + 2 portfolio réels) ; `tools/call` invalide → `-32602` ; anonyme sur outil protégé → `-32001`.
- Commande OpenCode simulée à l'identique (cwd + node + tsx cli) : handshake JSON-RPC OK.
- Orphelins de mes runs de test nettoyés (1 génération MCP restante, celle du superviseur).

## Risques / suivis
- Le fils MCP ne recharge pas le code seul (pas de watch) : restart via superviseur (touch `.env`) après modif MCP.
- Bearer MCP toujours simulé (MCP-03 suite) : ne pas exposer hors local.
- `pnpm-lock.yaml` modifié par les installs (dépendances racine ajoutées).
