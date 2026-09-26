# Responsabilites — theme

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/theme` |
| Version | `0.1.0` |
| Couche | Paquet partage — Systeme de Themes |

## Raison d'etre

Paquet dedie au systeme de themes MosaiX :
- Moteur de resolution entity-first agnostique (`ThemeResolver`).
- Heritage parent/enfant facon PrestaShop (`extends`).
- Presets et variantes chromatiques facon UniTheme (`presets`).
- Compilateur deterministe CSS (`ThemeCompiler`).
- Injecteur Shadow DOM & document root (`ThemeInjector`).
- Moteur d'auto-decouverte du dossier `themes/` (`ThemeDiscoveryEngine`).
- SDK consommateur a 3 niveaux (`theme.get`, `theme.watch`, `theme.resolve`, `theme.targets.*`, `theme.assign`, `theme.catalog.*`).

## Interactions

Consomme par `@mosaix/core`, `@mosaix/sdk`, `src/shell/theme`, `apps/*`.

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests Vitest verts (`pnpm --filter @mosaix/theme test`).
- [ ] Aucune dependance vers du code metier (`space`, `store`, etc.).
