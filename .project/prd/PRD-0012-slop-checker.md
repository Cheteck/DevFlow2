# PRD-0012 — Slop Checker Hybride (pnpm + skill agent)

**Statut** : Validé v2.0 (2026-10-13)
**Priorité** : Moyenne (Gouvernance Qualité & Prévention Dette Agent)
**Couche** : `@mosaix/conformance` (moteur) ↔ `packages/cli` (commande) ↔ skill agent (qualification & revue)
**Package principal** : `@mosaix/conformance` (nouveau `suites/slop/`)

---

## 1. Vision & Principes Directeurs

Les sessions de développement pilotées par agents génèrent parfois du « slop » : mocks/handlers factices fusionnés, `TODO` orphelins, `Math.random()` comme identifiants, `console.*` hors logger, données de démonstration hardcodées, `catch` vides ou `as any`.

Le **Slop Checker** est un système **hybride à deux niveaux** :
1. **Pneu Déterministe (`pnpm mosaix check:slop`)** : Détection mécanique, rapide et déterministe. **Bloquant en CI** sur les erreurs P0.
2. **Skill Agent (`slop-check`)** : Interprétation contextuelle des findings, tri vrai/faux positif, propositions de remédiation minimale et rapport de revue.

**Principe directeur** : *Le détectable mécaniquement bloque la CI ; le discutable (qualité, pertinence) relève de l'évaluation guidée agent/humain.*

---

## 2. Non-Objectifs

- Pas de linter générique (ESLint et Prettier restent seuls maîtres du style et du formatage).
- Pas de réécriture automatique de code sans accord ou revue.
- Pas de blocage CI sur des impressions purement sémantiques ou esthétiques.

---

## 3. Architecture Technique Hybride

Le Slop Checker réutilise le châssis de conformité de `@mosaix/conformance` (`packages/conformance/src/suites/integrity/`) et introduit un modèle d'analyse **hybride (Regex + AST)**.

```
                               ┌──────────────────────────────────────────┐
                               │           pnpm mosaix check:slop         │
                               └────────────────────┬─────────────────────┘
                                                    │
                                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ @mosaix/conformance / suites / slop /                                                                 │
│                                                                                                       │
│   ┌───────────────────────────────────┐               ┌───────────────────────────────────────────┐   │
│   │ Scanner Textuel (Regex/Ligne)     │               │ Analyseur Synthétique (TypeScript AST)    │   │
│   │  - TODOs orphelins                │               │  - console.* / alert() réels              │   │
│   │  - Math.random()                  │               │  - catch vides & as any                   │   │
│   └─────────────────┬─────────────────┘               └─────────────────────┬─────────────────────┘   │
│                     │                                                       │                         │
│                     └─────────────────────────┬─────────────────────────────┘                         │
│                                               │                                                       │
│                                               ▼                                                       │
│                         ┌──────────────────────────────────────────┐                                  │
│                         │ Rapport JSON Public (version: 1)         │                                  │
│                         └────────────────────┬─────────────────────┘                                  │
└──────────────────────────────────────────────┼────────────────────────────────────────────────────────┘
                                               │
                                               ▼
                         ┌──────────────────────────────────────────┐
                         │ Skill Agent `slop-check`                 │
                         │ (Tri, qualification & verdict)           │
                         └──────────────────────────────────────────┘
```

---

## 4. Scopes & Sémantique Déterministe

### 4.1 Définition des Scopes

| Scope | Extensions & Inclusions | Exclusions Strictes | Usage |
|---|---|---|---|
| `code` *(défaut)* | `.ts`, `.tsx` sous `src/`, `apps/`, `packages/`, `scripts/` | `*.test.ts`, `*.spec.ts`, `dist/`, `build/`, `node_modules/`, `archive/` | Dev local, CI complète |
| `docs` | `.md` hors `node_modules/` | `.project/archive/`, `node_modules/` | Audit de documentation |
| `diff` | Fichiers modifiés (`git diff --name-only <base>`) | Fichiers supprimés | CI PR rapide |

### 4.2 Sémantique de Combinaison (Intersection)
Lorsque plusieurs scopes sont combinés (ex: `--scope=code,diff`), la sémantique est l'**intersection** :
> Seuls les fichiers `.ts`/`.tsx` modifiés par le diff qui appartiennent au périmètre du code sont analysés.

### 4.3 Robustesse Git Diff (`--base`)
- Base par défaut : `origin/main` (surchargeable via `--base=<ref>`).
- **Fail-Fast** : Si la branche de base n'existe pas localement ou si la commande Git échoue, l'exécuteur s'arrête immédiatement avec un **code de sortie 2** (Erreur d'Exécution), évitant tout faux vert silencieux.

---

## 5. Catalogue de Règles Précis & Unifié

### 5.1 Politique Alignée des TODOs
- **Politique retenue** : Un `TODO` est autorisé **s'il possède une référence traçable** (ex: `TODO(#123): ...`, `TODO(MOSAIX-456): ...` ou date `TODO(2026-10-15): ...`).
- **Règle bloquante (P0)** : Seul le `TODO` orphelin/non référencé (`no-untracked-todo`) est interdit.

### 5.2 Catalogue P0 — Bloquants en CI (`error`)

| ID | Alias | Moteur | Détection & Périmètre | Mitigation / Remédiation |
|---|---|---|---|---|
| `SLOP-P0-01` | `no-math-random` | Regex | `Math\.random\(\)` dans le code applicatif non-test. | Utiliser `crypto.randomUUID()` ou `CryptoPort`. |
| `SLOP-P0-02` | `no-untracked-todo` | Regex | `TODO\|FIXME\|HACK\|XXX` sans référence `#issue`, `TICKET-*` ou date `YYYY-MM-DD`. | Ajouter la référence `#ticket` ou la date d'échéance. |
| `SLOP-P0-03` | `no-unimplemented` | Regex | `throw new Error\(["']not implemented` ou stubs de fonctions vides non typés. | Implémenter le comportement ou utiliser un Port explicite. |
| `SLOP-P0-04` | `no-console` | AST | Appels réels à `console.(log\|warn\|error\|debug)` hors packages logging, CLI et tests. | Utiliser `ConsoleLogger` ou `LoggingPort`. |
| `SLOP-P0-05` | `no-alert` | AST | Appels réels à `alert()` ou `confirm()` dans les vues frontend. | Utiliser la navigation SSR ou les modales de dialogue. |
| `SLOP-P0-06` | `no-empty-catch` | AST | Bloc `catch` avec un corps d'instructions vide et non commenté. | Traiter l'erreur, la re-lancer ou expliciter la suppression. |
| `SLOP-P0-07` | `no-ts-ignore` | Regex | Directives `@ts-ignore` ou `@ts-expect-error` dépourvues de justification textuelle sur la même ligne. | Typer correctement ou ajouter une raison explicite (`// @ts-expect-error: legacy port`). |

### 5.3 Catalogue P1 — Avertissements (`warn`, bloquants avec `--strict`)

| ID | Alias | Moteur | Détection & Périmètre | Mitigation |
|---|---|---|---|---|
| `SLOP-P1-01` | `no-as-never` | AST | Casts de contournement `as never`. | Vérifier l'unification des types discriminés. |
| `SLOP-P1-02` | `no-unknown-chain` | AST | Casts doubles `as unknown as Type`. | Justifier le pont de typage ou utiliser un type guard. |
| `SLOP-P1-03` | `no-explicit-any` | AST | Annotations de type `value: any` dans les signatures de fonctions publiques. | Typer ou utiliser `unknown` avec type guard. |
| `SLOP-P1-04` | `secrets-suspect` | Regex | Clefs/secrets en dur suspectés (`api_key = "..."`, `secret = "..."`). | Passer par les variables d'environnement. |

---

## 6. Configuration & Ordre de Priorité

### 6.1 Source Unique de Vérité
La configuration du Slop Checker respecte un ordre de priorité déterministe (du plus prioritaire au moins prioritaire) :

1. **Flags CLI** (`--strict`, `--base`, `--allow`, `--scope`).
2. **Allowlists ciblées par fichier/ligne** (dans `.slop.json` ou par règle).
3. **Fichier de configuration racine `.slop.json`**.
4. **Valeurs par défaut du moteur**.

### 6.2 Structure de `.slop.json`

```json
{
  "version": 1,
  "scopes": ["code"],
  "strict": false,
  "base": "origin/main",
  "rules": {
    "SLOP-P0-01": "error",
    "SLOP-P1-03": "warn"
  },
  "allow": [
    {
      "ruleId": "SLOP-P0-04",
      "path": "scripts/check-integrity.ts",
      "reason": "Script CLI d'affichage console autorisé"
    }
  ]
}
```

- **Règle de validation** : Une configuration `.slop.json` invalide ou contenant une règle inconnue déclenche un échec immédiat (Exit code 2).

---

## 7. Contrat d'Exécution CLI & Codes de Sortie

### 7.1 Commande CLI

```bash
pnpm mosaix check:slop [--scope=code|docs|diff] [--base=origin/main] [--format=text|json] [--strict]
```

### 7.2 Hiérarchie des Codes de Sortie (Exit Codes)

| Code | Signification | Comportement CI |
|---|---|---|
| `0` | **Succès** (0 erreur P0, et 0 avertissement P1 si `--strict`) | CI Passe (`GREEN`) |
| `1` | **Violation de Qualité** (au moins une erreur P0 ou avertissement en `--strict`) | CI Échoue (`RED`) |
| `2` | **Erreur d'Exécution / Système** (Erreur Git base, `.slop.json` invalide, fichier ilisible) | CI Échoue (`RED - System Error`) |

---

## 8. Contrat de Rapport JSON Public (version: 1)

Lors de l'utilisation de `--format=json`, le Slop Checker garantit une sortie JSON stable et déterministe :

```json
{
  "version": 1,
  "summary": {
    "totalFilesAnalyzed": 42,
    "errorCount": 0,
    "warnCount": 2,
    "pass": false
  },
  "findings": [
    {
      "ruleId": "SLOP-P1-03",
      "severity": "warn",
      "path": "apps/commerce/src/domain/order.service.ts",
      "line": 65,
      "column": 18,
      "message": "Type 'any' explicite utilisé dans la signature de méthode.",
      "remediation": "Remplacer 'any' par 'unknown' ou 'CommercialLineSnapshot'.",
      "fingerprint": "a8f9b2c3d4e5f601"
    }
  ]
}
```

- **Déterminisme** : Les findings sont triés de manière stable par `path` (ordre alphabétique), `line` (ordre croissant) puis `ruleId`.

---

## 9. Protocole Opérationnel du Skill Agent (`slop-check`)

Le Skill Agent interagit avec le Slop Checker selon le protocole suivant :

1. **Exécution du Checker** : Exécute `pnpm mosaix check:slop --format=json`.
2. **Qualification & Tri** :
   - Distingue les infractions avérées des cas limites.
   - Ne crée **jamais d'allowlist massive ou aveugle**. Chaque proposition d'exception doit inclure le fichier, la ligne, la règle et une justification explicite.
3. **Restitution & Verdict** :
   - **`PASS`** : Zéro erreur, zéro avertissement non qualifié.
   - **`WARN`** : Aucun blocage, mais présence d'avertissements P1 nécessitant attention.
   - **`FAIL`** : Présence d'erreurs P0 bloquantes ou échec d'exécution du scanner.
4. **Interdiction** : L'agent ne peut pas transformer un résultat `FAIL` en `PASS` sans correction réelle du code ou ajout d'une entrée d'allowlist dûment validée dans `.slop.json`.

---

## 10. Feuille de Route & Recommandation de Livraison

### Phase 1 — Contrats, Scopes & Configuration (.slop.json)
- Spécification des règles, de la politique TODO, du schéma JSON public et des codes de sortie CLI.

### Phase 2 — Moteur Hybride (Regex + AST) & Fixtures
- Implémentation du moteur dans `packages/conformance/src/suites/slop/`.
- Création des tests de fixtures positives et négatives (y compris cas multilignes et commentaires).

### Phase 3 — Commande CLI & Intégration Git Diff
- Commande `pnpm mosaix check:slop` dans `packages/cli`.
- Intégration de la résolution Git diff et des codes de sortie.

### Phase 4 — Baseline du Dépôt & Skill Agent
- Exécution du scanner sur le dépôt MosaiX, tri initial des fautes et configuration de la baseline `.slop.json`.
- Implémentation du Skill Agent `slop-check`.

### Phase 5 — Intégration CI (Bloquant PR & Nightly)
- Câblage dans les workflows GitHub Actions : contrôles bloquants sur PR (`--scope=diff`) et rapports informatifs nightly (`--scope=code,docs`).
