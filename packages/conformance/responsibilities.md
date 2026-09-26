# Responsabilites — conformance

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/conformance` |
| Version | `0.1.0` |
| Couche | Outillage qualite |

## Raison d'etre

Suite de conformite MOSAIX-APP : AppConformanceValidator (manifest, capabilities, events, entrypoint canonique), golden-path, suites de contrats (application, capability, event, permission, plugin, tenant, runtime, session, route, platform, security, auth, theme, kernel), utilises par `pnpm check`.
Depuis 2026-09-26 : suite statique d'integrite (`suites/integrity.ts`) qui detecte les contournements du systeme (DDL hors migrations, driver sqlite direct, erreurs DB avalees, sessions memoire, mots de passe en clair, SQL identities direct, IDs Math.random, mocks en prod), utilisee par `pnpm check:integrity` (report par defaut, `--strict` pour CI).

## Responsabilites

- Suite de conformite MOSAIX-APP : AppConformanceValidator (manifest, capabilities, events, entrypoint canonique), golden-path, utilises par `pnpm check`.
- Suite d'integrite : regles documentees issues de l'audit 2026-09-26 (`.project/reports/db-bypass-audit-2026-09-26.md`), chacune avec allowlist explicite ; toute nouvelle classe de contournement devient une regle ici avant d'etre imposee en CI.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`, fixtures en tmpdir pour la suite d'integrite).
- Regle `no-hardcoded-ui-text` (warn) : textes visibles codes en dur dans les couches de vue au lieu de cles de traduction ; ignore marques, interpolations et libelles courts. Aucune infra i18n dans `src/`/`apps/` a ce jour (seul `themes/_template/locales`) : la regle mesure la dette en attendant le catalogue.

## Interactions

consomme par scripts/CI, templates d'apps.

## Frontieres

- Ne corrige rien, ne build rien.

## Non-responsabilites

- Ne porte aucune logique metier d'application concrete.
- Ne duplique pas les responsabilites d'un autre package (unicite de basename).

## Criteres de sante

- [ ] `src/index.ts` stable et documente.
- [ ] Tests verts (`vitest run`).
- [ ] Aucune dependance interdite par `eslint-plugin-boundaries`.
