# Responsabilites — config

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/config` |
| Version | `0.1.0` |
| Couche | Primitif framework — zero dependance workspace (`"dependencies": {}`, `eslintBoundaries: "ports"`) |
| Compagnon declaratif | `config/` racine (voir section dediee ci-dessous) |

## Raison d'etre

`@mosaix/config` est **le mecanisme unique de configuration** de la plateforme : lecture typee
de l'environnement, registre central immuable, resolution de secrets, gestion des cles de
chiffrement, lecture/ecriture de `.env`. Tout le reste (core, gateway, CLI, apps) lit sa
configuration **ici et nulle part ailleurs** — aucun `process.env` disperse dans le code metier.
Le **contenu** declaratif (quelles apps, quelles capabilities, pour quel usage) vit dans
`config/` ; le package fournit le **moteur** qui l'exploite.

## Modules

| Fichier | Export | Role |
|---|---|---|
| `env.ts` | `env`, `createEnvHelper(source)` | Acces type a l'environnement : `string / number / boolean / float…` avec defauts et coercition tolerante (`"yes/on/1"` → `true`) ; source injectable (tests deterministes), singleton sur `process.env` par defaut |
| `config.ts` | `ConfigManager`, `Config` (singleton), `config(key, default)`, `ConfigEvent` | Registre central : `load()` (deep-clone + deep-freeze), `get()` a cles pointillees, `has()`, `all()`, `namespace(prefix)`, `snapshot()`, `reload()` avec evenements `beforeReload/reload/change/error` et compteur `version` |
| `secret-resolver.ts` | `SecretVaultResolver`, `SecretStore`, `secretVaultResolver` | Resolution vault → variable d'env de repli → `process.env[key]` ; le store est interchangeable (vault reel en prod, rien en dev) |
| `app-key.ts` | `generateAppKey`, `parseAppKey`, `generateSecret`, `MissingAppKeyError`, `InvalidAppKeyError` | Cles facon Laravel : `MOSAIX_APP_KEY = base64:<32 octets>` (AES-256-CBC, 128 accepte), fail-fast si absente/invalide, **rotation** via `MOSAIX_APP_PREVIOUS_KEYS` (anciennes cles = verification seule), `generateSecret()` ≥ 256 bits pour JWT/session/webhook |
| `env-file.ts` | `parseEnvContent`, `readEnvFile`, `ensureEnvFile`, `upsertEnvKeys` | `.env` lu/ecrit **en preservant commentaires, ordre et format** ; cles existantes jamais ecrasees sans `force` ; quoting auto ; `EnvUpsertResult` (`created/updated/skipped`) |
| `index.ts` | re-exports | API publique : `env`, `Config*`, `secret-resolver`, `app-key`, `env-file` (exhaustif) |

## Le dossier `config/` — contenu declaratif

| Chemin | Role |
|---|---|
| `config/compositions/marketplace.json` | Assemblage « Marketplace » : citadelle + spaces + portfolio + commerce + solara, capabilities associees |
| `config/compositions/community-platform.json` | Assemblage « Community » (reseau social / entraide) |
| `config/compositions/creator-platform.json` | Assemblage « Creator » (publication / monétisation) |

- Format : `{ id, name, version, description, contexts[] (@apps/<x> ^1.0.0), capabilities[] }`.
- Consommes par le shell (`src/shell/composition-loader.ts`), le CLI et le dev-server pour
  monter **uniquement** les BACs requis par l'usage vise — c'est le pendant declaratif du
  `DatabaseModule`/`AppDatabaseResolver` (choix d'adapters par environnement).
- Les secrets et l'environnement restent dans `.env` / `.env.example` : `config/` ne contient
  **jamais** de valeur sensible, uniquement des references et des selections.

Regle de separation : **`packages/config` = mecanisme** (comment lire, valider, geler,
resoudre) ; **`config/` = contenu** (quoi monter, pour quel usage). Le package ne connait
aucune composition en dur ; les compositions ne contiennent aucune logique.

## Interactions

- Sans dependance workspace : importable par **toutes** les couches (fondations, ports,
  adapters, primitifs, gateway, SDK, apps, CLI).
- Consomme par : core (platform settings), gateway (port, CORS, rate-limit), CLI
  (`install`, `key:generate`, `ensureEnvFile/upsertEnvKeys`), control-plane/Imperia
  (valeurs `MOSAIX_*` du catalogue settings).
- Produit : configuration gelee versionnee + `.env` maintenu + cles/secrets resolus.

## Frontieres

- Seul `env.ts` / `secret-resolver.ts` touchent `process.env` — le reste du monorepo est
  interdit d'acces direct (a faire respecter par revue ; pas de garde ESLint dediee a ce jour).
- `load()`/`reload()` gelent en profondeur : apres chargement, toute mutation silencieuse est
  impossible — le changement passe par `reload()` (evenementiel, versionne).
- `upsertEnvKeys` n'ecrase jamais sans `force` : les secrets existants survivent aux re-runs.
- Aucune valeur sensible en log : masquage (`mask()` cote CLI) obligatoire pour tout affichage.

## Non-responsabilites

- Ne valide pas les manifests d'apps ni les compositions (voir `@mosaix/schemas`,
  `scripts/validate-manifests.ts`) — il les **transporte**, il ne les **juge** pas.
- Ne choisit pas les adapters (voir compositions + resolvers) ni les feature flags
  (voir `@mosaix/ports-feature-flags`).
- Ne chiffre/déchiffre pas lui-meme (cles fournies aux consommateurs : crypto-node/web).
- Ne persiste rien d'autre que `.env` (pas de base, pas de vault embarque).

## Ecarts connus (intention vs reel) — a combler

- [ ] Compositions non validees par schema : aucun `CompositionSchema` (Zod) ni check dedie —
      une faute de frappe dans `contexts[]` echoue tard au montage ; ajouter validation + `check:compositions`.
- [ ] Mapping composition ↔ environnement non formalise (dev/staging/prod) : 3 compositions
      d'usage mais selection par env implicite — documenter/typer la resolution.
- [ ] `deepClone` via `JSON.parse/stringify` : perd `Date`, `Map`, `undefined` — documenter la
      limitation ou passer a `structuredClone`.
- [ ] Ecouteurs `reload/change` : exception avalee avec `console.warn` — prevoir `error` agrege
      et contrat d'ecouteur (sync/async, timeout).
- [ ] Acces direct `process.env` hors package non interdit mecaniquement — ajouter une regle
      `eslint-plugin-boundaries` (ou `no-restricted-properties`) sur le reste du monorepo.

## Criteres de sante

- [ ] Zero dependance workspace (garde `eslintBoundaries: "ports"` verte).
- [ ] Tests verts : `config.test.ts`, `env-file.test.ts`, `app-key.test.ts` (gel, coercitions,
      rotation de cles, preservation du `.env`).
- [ ] `pnpm key:generate` idempotent : re-run = `skipped`, jamais d'ecrasement sans `--force`.
- [ ] `config/` sans secret en clair (scan) ; chaque cle `MOSAIX_*` du catalogue Imperia
      resoluble via `env`/`Config` avec defaut documente.
- [ ] Toute nouvelle composition accompagnee de : usage vise, BACs requis, validation verte.
