# Risque — Install pnpm bloqué par la policy supply-chain

- **Date :** 2026-08-06
- **Sévérité :** Medium (bloque build/test/check local, ne bloque pas le repository)
- **Statut :** Ouvert

## Constat

`pnpm install` (déclenché par `pnpm test`/`check` via le deps-status check) échoue avec
`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` :

- `@aws-sdk/client-s3@3.1104.0` publié à `2026-08-05T19:00:49Z`, dans la fenêtre `minimumReleaseAge`
- `@aws-sdk/client-ses@3.1104.0` publié à `2026-08-05T19:03:35Z`, dans la fenêtre `minimumReleaseAge`

Le cutoff détecté : `2026-08-05T11:41:29Z`.

## Impact

- `pnpm install` : échec → `node_modules` incomplet → `pnpm test`, `pnpm check`, `pnpm demo` non exécutables localement.
- Les comptages de tests (207 revendiqués) n'ont pas pu être re-vérifiés en session.

## Options de résolution

1. **Attendre** l'expiration du cutoff (le plus sûr — les packages auront 72h+ d'âge).
2. **Ajuster la policy** : la policy `minimumReleaseAge` n'est pas déclarée dans
   `pnpm-workspace.yaml` (aucun champ dédié) — elle provient du défaut pnpm / de la config
   utilisateur (`.npmrc`, `pnpm config`). La relâcher ne doit pas être fait sans validation.
3. **`pnpm clean --lockfile`** puis `pnpm install` (re-résolution) — uniquement si la policy est relâchée.

## Recommandation

Ne pas modifier la policy sans validation : la protection supply-chain est volontaire.
Attendre l'expiration du cutoff, puis re-vérifier `pnpm check` (build, lint, tests, prettier)
et corriger le comptage de tests du rapport si nécessaire (voir backlog T-I2).
