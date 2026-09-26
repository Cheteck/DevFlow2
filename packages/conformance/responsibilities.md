# Responsabilites — conformance

| Champ | Valeur |
|---|---|
| Nom | `@mosaix/conformance` |
| Version | `0.1.0` |
| Couche | Outillage qualite |

## Raison d'etre

Suite de conformite MOSAIX-APP : AppConformanceValidator (manifest, capabilities, events, entrypoint canonique), golden-path, suites de contrats (application, capability, event, permission, plugin, tenant, runtime, session, route, platform, security, auth, theme, kernel), utilises par `pnpm check`.
Depuis 2026-09-26 : suite statique d'integrite (`suites/integrity/`) qui detecte les contournements du systeme, utilisee par `pnpm check:integrity` (report par defaut, `--strict` pour CI).

### Regles d'Integrite Identifiees (`CONF-*-NNN`)

- `CONF-DB-001` (`no-ddl-outside-migrations`) : DDL hors des providers de migration.
- `CONF-DB-002` (`no-direct-sqlite-driver`) : Import direct du driver SQLite (`node:sqlite`).
- `CONF-DB-003` (`no-swallowed-db-errors`) : Erreurs de persistance avalees.
- `CONF-SESSION-001` (`no-memory-session-stores`) : Stockage de session en memoire vive.
- `CONF-SEC-001` (`no-plaintext-password-defaults`) : Mot de passe par defaut en clair.
- `CONF-SEC-002` (`no-direct-identities-sql`) : Requetes SQL directes sur la table `identities`.
- `CONF-SEC-003` (`no-mock-in-prod-path`) : Mode mock actif par defaut en chemin de production.
- `CONF-ID-001` (`no-math-random-ids`) : Utilisation de `Math.random()` pour la generation d'identifiants.
- `CONF-I18N-001` (`no-hardcoded-ui-text`) : Textes d'interface utilisateur codes en dur.
- `CONF-BOUNDARY-001` (`no-cross-bac-imports`) : Imports directs entre Bounded Applications.

## Responsabilites

- Suite de conformite MOSAIX-APP : AppConformanceValidator (manifest, capabilities, events, entrypoint canonique), golden-path, utilises par `pnpm check`.
- Suite d'integrite : regles documentees avec IDs stables `CONF-*-NNN`, chacune avec allowlist explicite et remediation.
- Expose un point d'entree unique via `src/index.ts`.
- Couvre par tests Vitest (`*.test.ts`, fixtures en tmpdir pour la suite d'integrite).

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
