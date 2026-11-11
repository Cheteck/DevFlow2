# Session 2026-10-13 (suivi) — Levée des réserves SSR : clé, garde-fou, mesures

## Objectif

Répondre à la revue « GO conditionnel » : vérifier les 3 points techniques
(hash/clé, contrats de confiance, doublon drawer) + exécuter la priorité n°1
(mesures SSR froid/chaud). Priorités n°3 (CSP/Tailwind) et migration drawer
restent hors périmètre (validation humaine requise).

## Travaux réalisés

- Clé de cache JSON structurée + condition d'isolation tenants documentée.
- Provenance des fragments commentée aux 4 sites d'injection.
- `drawer-exclusivity.test.ts` (6 tests) + ADR-0022 (Proposed).
- Bench froid/chaud (script jetable en temp, méthodologie ci-dessous).
- Diagnostic racine `maintenanceService`/tsc → CONF-DETTE (pas de doublon).

## Décisions prises

- **GO** : durcissement clé, provenance, garde-fou, mesures, ADR Proposed.
- **STOP** : correctif tsc systémique (blast radius ~500 imports, suivi CONF-DETTE) ;
  migration/suppression drawer (ADR-0022 Proposed, humain requis) ;
  `aria-expanded` sur triggers actuels (cibleraient un composant absent).
- FNV-1a conservé : non crypto mais adéquat (≤500 entrées, TTL 60 s,
  fragments internes non adversariaux) ; l'isolation inter-contextes repose
  sur le hash du contenu, pas sur l'unicité du hash — vérifié par construction.

## Validation effectuée

- 21/21 verts (15 ssr-engine + 6 exclusivity) ; voisins 43/43 inchangés.
- ESLint propre sur les fichiers touchés.
- Bench (200 froid / 5000 chaud / 5000 mixte / 2000 hash, fragments réels) :
  froid 0,029ms / chaud 0,031ms / mixte 0,029ms / hash 0,019ms —
  cache à coût quasi nul, gain nul : valeur = justesse, pas vitesse.

## Risques détectés

- Cache LRU du head : neutre en perf, ne pas le présenter comme accélération.
- `tsc` global rouge systémique (familles NodeNext + dist) — CONF-DETTE.
- CSP prod + Tailwind build + WCAG manuelle : toujours ouverts.

## Prochaines actions

1. Validation humaine ADR-0022 → migration drawer → tests clavier/lecteur d'écran.
2. Stratégie CSP + build Tailwind (avec nonces cohérents par réponse).
3. CONF-DETTE (ESM NodeNext) hors release.

## Git State

- Branche active : `feat-plugin-engine-audit-11753157743017484321`
- Commit : `5eabadc` (aucun commit créé, changements non stagés)
- Fichiers : 7 modifiés + 2 nouveaux (`ssr-engine.test.ts`, `drawer-exclusivity.test.ts`)
  + 1 ADR + 1 report + changelog. Bench script hors repo (temp).
- Rollback : `git checkout -- <fichiers>` + `git clean -f` les 2 tests.
