# Responsabilites — cli

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/cli` |
| Version | `0.1.0` |
| Couche | Outillage DX (Layer CLI) |
| Binaire | `mosaix` → `./bin/mosaix.js` (cf. `package.json:bin`) |
| Entree dev | `pnpm mosaix` = `tsx packages/cli/src/index.ts` |

## Raison d'etre

Le CLI `mosaix` est **l'unique porte d'entree operateur/developpeur** vers la plateforme :
initialiser le workspace (`.mosaix/`), decouvrir les packages/apps, compiler le bundle de
production (manifestes agreges), lancer le dev-server, diagnostiquer la sante du workspace,
gerer cles/install/migrations/seeds, et scaffolder des apps canoniques. Les `scripts/*.ts`
racine (`build.ts`, `dev.ts`, `install.ts`, …) sont de minces enveloppes par-dessus ce package.

## Modules

| Fichier | Classe / export | Role |
|---|---|---|
| `command.ts` | `CliCommand`, `CommandContext`, `CLIResult`, `EXIT_CODES` | Contrat de commande : `name`, `aliases?`, `execute(ctx)` ; contexte (`rootDir`, `isJson`, `isCi`, `args`, `respond`, `error`) |
| `cli-types.ts` | `CLIResult` | Doublon de type allege (re-export pratique) |
| `command-router.ts` | `MosaixCommandRouter` | Registre + dispatch des 7 familles (noms + alias) ; modes `--json` (sortie machine) et `--ci` (strict, sans interaction) ; `execute(command, options)` |
| `commands/lifecycle-commands.ts` | `InitCommand` (`init`), `DevCommand` (`dev`/`serve`) + build… | Cycle de vie : init `.mosaix/`, dev-server (`--port/--host/--app/--open/--strictPort`), build |
| `commands/discovery-commands.ts` | discovery | Decouverte packages/apps/capabilities du workspace |
| `commands/diagnostic-commands.ts` | diagnostic (`doctor`) | Wrapping de `WorkspaceDoctor` |
| `commands/migration-commands.ts` | migration | Pilotage `@mosaix/migrations` (plan, preview SQL, apply, dry-run) |
| `commands/seed-commands.ts` | seed | Jeux de donnees dev/test |
| `commands/key-commands.ts` | key | Generation/verification de cles (`key:generate`, `key:check`) |
| `commands/install-commands.ts` | install | Setup workspace (`setup`, `db:setup`) |
| `commands/database-command.ts` | database | Operations base (inspect, resolve, RLS) via `@mosaix/database` |
| `folder-manager.ts` | `MosaixFolderManager` | Structure `.mosaix/` : `build/` (client/server/shared, packages/apps/plugins), `cache/` (assets/bundler/compiler/resolver), `diagnostics/` (build.json), `manifests/` (applications, packages, capabilities+registry, events+registry, permissions, aggregated), `routes/`, `runtime/`, `standalone/` (server.js), `static/`, `logs/`, `themes/`, `traces/` (dependencies) |
| `package-discovery.ts` | `PackageDiscoverer`, `DiscoveredMosaixPackage` | Scan `packages/`, `plugins/`, `node_modules/`, `node_modules/@mosaix` (cle `mosaix` du package.json) ; statut `discovered\|valid\|incompatible` ; expose capabilities/events/permissions/cliCommands/cliGenerators |
| `build-compiler.ts` | `ProductionBuildCompiler`, `ProductionBundleManifest` | `synthesizeManifest()` + `compile(apps)` : agrege manifests apps + packages decouverts en `{ platformVersion, compiledAt, buildId, applications, packages }` + listes capabilities/events/permissions → ecrit via folder-manager |
| `doctor.ts` | `WorkspaceDoctor.runDiagnostic()` | Rapport `{ healthy, checks[] }` (`OK\|WARN\|FAIL`) incluant la conformite des manifests via `AppConformanceValidator.validateAllWorkspaceApps(appsDir)` |
| `scaffold.ts` | `Scaffolder` | Generateurs canoniques : `generateAppManifest(appId, name)` (mosaix.json : capabilities, permissions 4-parties, events, experience/frontend, `database.strategy: per-app`) + `generateAppEntryPoint()` (MANIFEST, ServiceProvider, factory) |
| `dev-server/dev-server.ts` | `MosaixDevServer` | Serveur dev (port/host/app/open/strictPort) |
| `dev-server/watcher.ts` | watcher | Rechargement sur changement de fichiers |
| `index.ts` | re-exports | Point d'entree public du package |

## Interactions

- Depend de : `adapter-database-sqlite`, `conformance`, `config`, `contracts`, `core`,
  `database`, `mcp`, `migrations`, `ports-database`, `schemas`, `types` (tous `workspace:*`).
- Consomme : conformite (`AppConformanceValidator`), migrations (plan/preview/apply),
  database (resolver), config (env), core (kernel/manifests).
- Consomme par : `scripts/*.ts` racine, `package.json:scripts` (`mosaix`, `build`, `dev`,
  `setup`, `db:setup`, `key:*`, `check:*`), devs en terminal, CI (`--ci --json`).
- Produit : arborescence `.mosaix/` + `ProductionBundleManifest`, consommes par le runtime/gateway.

## Creation initiale du superadmin (bootstrap)

Le CLI est responsable du bootstrap du **tout premier compte global** (`superadmin`) :
sans lui, Imperia (reserve aux roles globaux) serait inatteignable sur une plateforme neuve.
Poule-et-oeuf resolu cote operateur, jamais cote applicatif.

Etat actuel (partiel) — `mosaix install`, etape 6 « Admin » (`install-commands.ts`) :
- Delegue a `scripts/init-dev-admin.ts` via `ADMIN_EMAIL` / `ADMIN_PASSWORD` d'env
  (defaut `admin@mosaix.local`, mot de passe genere affiche **une fois** si omis).
- Hash scrypt sale, table SQLite `identities`, **idempotent** (compte existant = skip,
  re-run sur = preserve).
- ⚠️ Cree le role `["admin"]`, **jamais `superadmin`** ; SQL brut (hors ports
  `identity-store` / `credential-store`) ; SQLite uniquement.

Cible (non implemente) :
- Commande dediee, ex. `mosaix admin:create --email=… [--password=… | --generate]
  [--role=superadmin] [--dry-run]` : cree le premier `superadmin`, refuse d'en creer un
  second sans `--force` explicite et trace (fail-closed + audit).
- Passe par les ports (`identity-store`, `credential-store`, `session-creation`), donc
  Postgres **et** SQLite ; rapatrie la logique de `scripts/init-dev-admin.ts` dans le CLI
  (le script devient une enveloppe ou disparait).
- Secret : mot de passe genere affiche une seule fois, jamais en log structure ni en
  JSON (`--json` le masque) ; `--dry-run` planifie sans ecrire.
- Complemente par `admin:rotate` (rotation secret) et `admin:disable` (revocation d'urgence).

## Frontieres

- Ni runtime prod (ne sert aucun trafic), ni logique metier d'app.
- Ne parle aux apps que via manifests decouverts + validation — jamais d'import de code d'app.
- Effets de bord disque reseau limites au workspace (`.mosaix/`, scaffolds) : pas de mutation
  hors `rootDir` sans option explicite.
- Sortie stable : tout resultat passe par `respond`/`error` avec exit codes (`EXIT_CODES`),
  format texte ou JSON — jamais de `console.log` ad hoc dans les commandes.

## Non-responsabilites

- Ne valide pas a la place des scripts `check:*` (il les outille seulement).
- N'execute pas les migrations sans preview/dry-run prealable (delegue a `@mosaix/migrations`).
- Ne gere ni secrets ni cles en clair en log (les commandes `key` manipulent des references/empreintes).
- Ne remplace pas `@mosaix/dev-server` comme runtime partage (voir ecart ci-dessous).

## Ecarts connus (intention vs reel) — a combler

- [ ] `src/index.ts` ne re-exporte que 6 modules (folder-manager, package-discovery,
      build-compiler, command-router, key-commands, install-commands) : les commandes
      database/diagnostic/discovery/lifecycle/migration/seed, `doctor`, `scaffold` et
      `dev-server` ne sont pas importables depuis le point d'entree public — completer les exports.
- [ ] `WorkspaceDoctor` : les 3 premiers checks (workspace pnpm, references TS, compatibilite
      kernel/SDK) sont des constantes `"OK"` — les rendre reels (lecture `pnpm-workspace.yaml`,
      `tsconfig.build.json`, versions croisees) ou les marquer `WARN` non verifies.
- [ ] `Scaffolder.generateAppManifest` force `runtime.isolation: "trusted"` par defaut —
      exiger un choix explicite (defaut `untrusted`/sandbox) sauf pour les apps plateforme.
- [ ] Doublon `CLIResult` entre `command.ts` et `cli-types.ts` — garder une seule source.
- [ ] Chevauchement `@mosaix/dev-server` (package dedie) vs `dev-server/` embarque du CLI —
      trancher : le CLI delegue au package, ou le package est absorbe ; pas les deux.
- [ ] `bin/mosaix.js` : verifier qu'il pointe sur `dist/` compile (pas `src/`) pour l'usage installe.
- [ ] Bootstrap `superadmin` non implemente : `install` ne cree qu'un `admin` via SQL brut
      SQLite (`scripts/init-dev-admin.ts`) — specifier `admin:create` (role `superadmin`,
      via ports, Postgres + SQLite, idempotent, fail-closed) + `admin:rotate` / `admin:disable`.

## Criteres de sante

- [ ] `src/index.ts` exporte 100 % de l'API publique (test d'exhaustivite des exports).
- [ ] Chaque commande a : nom, alias documentes, `--help`, test (`cli.test.ts` et suites par famille).
- [ ] `doctor` vert sur workspace sain ; `FAIL` avec details actionnables sinon (jamais de faux `OK`).
- [ ] `compile()` deterministe a `buildId`/`compiledAt` pres (manifestes comparables entre runs).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries` (outillage, pas de cycle vers apps).
- [ ] `mosaix --help` et chaque `mosaix <cmd> --help` a jour avec les options reelles.
- [ ] Bootstrap verifie : fresh DB → install cree un `superadmin` utilisable sur Imperia ;
      re-run → preserve ; second `superadmin` sans `--force` → echec propre + audit.
