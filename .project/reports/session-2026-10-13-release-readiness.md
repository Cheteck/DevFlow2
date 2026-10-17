# Session 2026-10-13 — Évaluation préparation production (preuves CLI + live)

## Méthode

Référentiel `.project/backlog/RELEASE-READINESS.md`. Preuve exigée = commande/log,
pas affirmation. Différentiel `git stash` pour attribuer les 5 tests rouges
(pré-existants vs régressions de session).

## Résultats CLI (tous exit 0 sauf mention)

| Commande | Résultat |
|---|---|
| `mosaix doctor` | healthy, 4/4 OK (11 apps conformes) |
| `check:env` | OK, 53 clés documentées |
| `check:integrity` | exit 0, warns connus (CONF-I18N-001 FR, CONF-DB-001 dont commentaires) |
| `validate-manifests` / `check:contracts` | 17/17 + tri topo OK |
| `check:themes` | 19/19 |
| `validate-conformance` / `validate-ui-contracts` / `app:validate` | 11/11 partout |
| `check:architecture` | boundaries valid, 0 deps directes |
| `runtime:health` | online, 12 modules |
| `registry:apps` | `not_built` (informatif, exit 0) |
| `capability:validate` | commande inconnue du routeur (listée au help — incohérence mineure) |
| `permission:check` (sans args) | `allowed:true` wildcard — non informatif |

## Résultats live (serveur dev :3000)

| Sonde | Résultat |
|---|---|
| `/`, `/commerce`, `/login` | 200 (70/70/35 ko), 4 headers OWASP |
| `/healthz` | 200 JSON `{"status":"alive"}` |
| `/metrics` | **absent** : rend le login (comme `/health`) → OBS-METRICS-01 |
| URL inconnue | 200 login (soft-404, à documenter) |
| `/api/auth/session` anonyme | 200 `{"authenticated":false}` — fail-closed propre |
| login mauvais creds | **503 honnête by-design** (`authManager` non câblé, Citadelle owner) → P0 AUTH-E2E reste rouge |
| `/__mosaix` | running, 11 BACs dont commerce |

## Tests : 979/984 — les 5 rouges sont pré-existants (différentiel stash rejoué à l'identique)

1. `plugin-e2e` : `@mosaix-plugin/solara-content-moderator` non lié (même famille que `plugin-engine` avant fix).
2. FEAT-04 enchères : `status` undefined (contredit AUCTION-PERSIST DONE).
3. `bac-access.http` : attend un catalogue vide, le dev-PG contient les seeds Jijel (dépendance aux données).
4. -6. `cli.test.ts` ×3 : `migrate`/`rollback` → `database is not open`, seed `[]` (chemin CLI sqlite cassé ; chemin serveur PG prouvé OK le même jour) → CLI-MIGRATE-01.
5. Bonus : sur stash (fix checksum absent), la suite http ne boote même pas (garde checksum) — preuve involontaire que le fix de session était nécessaire.

Backlog créé : CLI-MIGRATE-01 (P1), OBS-METRICS-01 (P2), TEST-RED-01 (P1).

## Verdict

**NO-GO exposition publique** (P0 auth réelle rouge + tsc + CLI migrate + CSP),
**GO pré-prod/dev** (boot fiable, gardes prouvées, 99,5 % tests, frontières vertes).
Prochain jalon prod : AUTH-E2E réel → TEST-RED-01 → CLI-MIGRATE-01 → CSP/Tailwind → CONF-DETTE.

## Git State

- Branche `feat-plugin-engine-audit-11753157743017484321`, base `5eabadc`, rien commité.
- Aucune modification de code dans cette passe (évaluation pure) ; ajoutés :
  changelog, BACKLOG (3 lignes), ce rapport. Stash différentiel poppé sans conflit.
