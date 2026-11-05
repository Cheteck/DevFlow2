# Analyse Qualité — MosaiX
**Date:** 2026-11-03  
**Session:** quality-analysis  
**HEAD:** `ee98e3e` — "fix(theme): isolate SSR theme state via AsyncLocalStorage"

---

## Executive Summary

### Gate Matrix

| Gate | Status | Détails |
|------|--------|---------|
| `check:themes` | ✅ **PASS** | 19/19 validés |
| `check:manifests` | ✅ **PASS** | 17/17 validés |
| `check:conformance` | ✅ **PASS** | 11/11 validés |
| `check:ui-contracts` | ✅ **PASS** | 11/11 validés |
| `check:contracts` | ✅ **PASS** | — |
| `pnpm lint` | ❌ **FAIL** | **37 problèmes** (34 erreurs, 3 warnings) |
| `pnpm test:typecheck` | ❌ **FAIL** | Erreurs TS dans `start.ts`, `theme-discovery.ts`, `db-backup.ts` |
| `pnpm test` | ❌ **FAIL** | **1 fichier échoué** / 204 (timeout hook bootServer) |

**Verdict:** 5/8 gates verts — les 3 gates rouges bloquent toute livraison.

---

## 1. Échecs des Gates

### 1.1 Lint — 37 problèmes

```
34 erreurs, 3 warnings
```

#### Erreurs critiques (à corriger en priorité)

| Fichier | Ligne | Règle | Description |
|---------|-------|-------|-------------|
| `src/shell/theme/theme-bridge.ts` | 84 | `prefer-const`, `no-unused-vars` | `compiledForThemeId` déclaré `let` mais jamais réassigné, jamais utilisé |
| `src/server/routes/space-theme-routes.ts` | 12-13 | `no-restricted-imports` | `src/server` importe internals BAC (`packages/bac/src/composition/*`) |
| `packages/in-memory-storage/src/in-memory-storage.ts` | — | `no-restricted-syntax` | Violations dans citadelle, portfolio, auth-composition, observability-module |
| `src/start.ts` | — | `no-unused-imports` | `AuthManager` importé mais inutilisé |
| `packages/theme/src/theme-discovery.ts` | — | `no-unused-imports` | imports inutilisés |
| `src/shell/pages/citadelle-view.ts` | — | `no-useless-escape` | échappements inutiles |
| `packages/postgres-storage/src/postgres-theme-assignments-store.ts` | 111 | `no-useless-catch` | try/catch redondant |
| Tests (`*.test.ts`) | — | `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `no-empty` | `any` explicites, variables inutilisées, blocs vides |

#### Impact
- **Bloquant CI** si lint est requis en pre-merge
- **Dette technique** : code smell accumulé
- **Risque** : imports circulaires potentiels (`space-theme-routes.ts`)

---

### 1.2 Typecheck — Échec critique

#### `src/start.ts` (HEAD `ee98e3e` a cassé le typage)

Le commit `ee98e3e` introduit `runWithThemeContext(async () => { ... })` qui ferme le scope à la ligne **392**, mais le code BAC (lignes **395+**) utilise toujours :

- `currentThemeMode` (TS2304) — lignes **323, 467, 492-494, 557, 576-578, 611-612**
- `sharedStyles` (TS2552) — mêmes lignes

**Cause racine :** variables déclarées dans la closure AsyncLocalStorage, utilisées en dehors.

```typescript
// Lignes ~380-392
await runWithThemeContext(async () => {
  const currentThemeMode = /* ... */;
  const sharedStyles = /* ... */;
  // ...
}); // ← fermeture ici

// Lignes 395+ — HORS de la closure, mais utilise currentThemeMode/sharedStyles
// ❌ TS2304 / TS2552
```

**Note :** `tsx` exécute quand même (pas de typecheck à l'exécution), mais la CI TypeScript échouera.

---

#### `packages/theme/src/theme-discovery.ts` (modification working tree)

```
TS2304: Cannot find name 'ThemeValidationError' (ligne 87)
```

**Cause :** `ThemeValidationError` utilisé sans import.

**Correction requise :**
```typescript
import { ThemeValidationError } from './errors'; // ou le bon chemin
```

---

#### `scripts/db-backup.ts`

```
Property 'connectionString' does not exist on type '...'
Property 'database' does not exist on type '...'
```

**Cause :** types de configuration non alignés avec l'usage réel.

---

### 1.3 Tests — 1 fichier échoué

```
1164 passed, 14 skipped, 1 file failed
```

#### `tests/http/bac-access.http.test.ts`

**Erreur :**
```
beforeAll hook: bootServer(3218, true)
Hook timed out in 150000ms

Then: server.kill()
Cannot read properties of undefined (reading 'kill')
```

**Diagnostic :**
- Le serveur ne boot pas dans le timeout (150s)
- `server` reste `undefined` → `kill()` échoue
- **Reproductible** : timeout confirmé sur 2 exécutions isolées

**Hypothèses :**
1. Effet de bord du HEAD `ee98e3e` sur le boot SSR
2. Conflit de port 3218 (peu probable)
3. Dépendance non initialisée dans `beforeAll`

**Investigation requise :**
- Vérifier si `bootServer()` lance effectivement le serveur
- Ajouter logs de debug dans le hook
- Tester avec un port différent

---

## 2. Architecture — Thèmes et Couleurs

### 2.1 Root Cause : Auth Pages ≠ Rest of Project

**Problème :** Les pages d'authentification (`/login`, `/register`) n'utilisent pas la même palette que les pages BAC (spaces, commerce, root).

**Diagnostic confirmé :**

| Page | Source Tailwind | Valeur `primary` (dark) |
|------|-----------------|-------------------------|
| `/login`, `/register`, `/` | `renderHeadBlock()` → `var(--color-*)` | `#6366f1` (indigo-500) |
| `/spaces`, `/commerce`, `/` (root BAC) | `bac-page.ts:76` → literal hex via `getTailwindThemeColors()` | `#d0bcff` (palette différente) |

**Sources :**

1. **`src/shell/ssr-engine.ts:115-156`** — `renderHeadBlock()` :
   ```typescript
   // Utilise des variables CSS → pages auth + home
   :root { --color-primary: #6366f1; }
   ```

2. **`src/shell/pages/bac-page.ts:76`** :
   ```typescript
   const twColors = getTailwindThemeColors(mode); // ← literal hex
   // primary: #d0bcff (différent de tokens.colors.dark)
   ```

3. **`themes/mosaix-default/theme.json:142-176`** — `modes.dark.tailwind` :
   ```json
   "tailwind": {
     "primary": "#d0bcff",  // ≠ tokens.colors.dark.primary
   }
   ```

**Conclusion :** Deux chemins de config Tailwind coexistent, avec des palettes **divergentes**.

---

### 2.2 Hardcoded Colors — Scan

```
Total hex colors found: 175
- src/shell: 48
- Autres: 127
```

#### Points connus

| Fichier | Ligne | Couleur | Contexte |
|---------|-------|---------|----------|
| `src/start.ts` | 540 | `#ef4444`, `#6366f1` | Page 403 inline |
| `src/start.ts` | 479, 485 | `text-rose-400` | Inline styles |
| `src/start.ts` | `getSharedStyles` | `rgba(255,255,255,0.1)` | Glass-card literals |
| `src/shell/ssr-engine.ts` | — | `rgba(...)` | `.glass-card`, `.glass-hover-glow` |
| `src/shell/client/*.ts` | — | `red/emerald/amber/rose` | Toasts |

**Recommandation :** Remplacer par tokens sémantiques (`--mx-color-*` ou classes Tailwind).

---

## 3. Métriques Statiques

```
Fichiers TS/CSS : 903
Lignes totales  : 96 699
Fichiers de test: 204
TODOs           : 17
Explicit any    : 7
```

### Plus gros fichiers

| Fichier | Lignes |
|---------|--------|
| `src/shell/renderer.ts` | 1 544 |
| `packages/feed-engine/src/index.ts` | 1 237 |
| `apps/spaces/src/presentation/spaces-view.ts` | 1 035 |
| `src/shell/pages/auth-pages.ts` | 1 001 |

**Risque :** fichiers >1000 lignes — complexité cyclomatique probable.

---

## 4. Hygiène Repository

### 4.1 Git State

```
Branche active : audit-technique-mosaix-8397822254578305712
Ahead of main  : 226 commits
Modified files : 9 (non commités)
```

**Fichiers modifiés :**
- `src/shell/pages/auth-pages.ts`
- `src/shell/pages/home-page.ts`
- `src/shell/renderer.ts`
- `src/shell/ssr-engine.ts`
- `tests/...` (test file)
- `apps/solara/src/presentation/solara-view.ts`
- `packages/theme/src/theme-discovery.ts`
- `.project/reports/session-*.md`
- `styles.css`

### 4.2 Fichiers non suivis (à trier)

| Chemin | Taille | Action |
|--------|--------|--------|
| `chatgpt-web-mcp/` | ~42 MB (incl. node_modules) | **À ajouter au `.gitignore` ou supprimer** |
| `.project/working/chatgpt-context-bundle.md` | — | Archive ou supprimer |
| `.project/working/chatgpt-prompt-2.md` | — | Archive ou supprimer |

### 4.3 Dashboard Stale

**`.project/dashboard.md` :**
```
Claims: "1170/1170 tests, 0 errors 0 warnings"
Reality: 1164 passed, 1 file failed, 37 lint errors, typecheck fails
```

**Action requise :** Mettre à jour ou automatiser la génération.

---

## 5. Risques Identifiés

| Risque | Sévérité | Impact |
|--------|----------|--------|
| HEAD `ee98e3e` casse typecheck | 🔴 **Critical** | CI bloquée, impossible de merger |
| Test `bac-access.http.test.ts` timeout | 🔴 **Critical** | Régression boot serveur non détectée |
| 37 lint errors | 🟠 **High** | Dette technique, risques d'imports circulaires |
| Dual Tailwind config (auth ≠ BAC) | 🟠 **High** | Incohérence UX, maintenance complexe |
| 175 couleurs hardcoded | 🟡 **Medium** | Fragilité thèmes, difficile à maintenir |
| Dashboard stale | 🟡 **Medium** | Perte de confiance dans les métriques |
| 42 MB untracked (`chatgpt-web-mcp/`) | 🟡 **Medium** | Repository pollution |
| 226 commits ahead of `main` | 🟡 **Medium** | Merge conflict risk |

---

## 6. Recommandations (par priorité)

### P0 — Bloquant livraison

1. **Réparer `src/start.ts`** (HEAD `ee98e3e`)
   - Déplacer `currentThemeMode`/`sharedStyles` hors de la closure
   - Ou étendre `runWithThemeContext` sur tout le code BAC
   - **Fichier :** `src/start.ts` lignes 380-620

2. **Réparer `packages/theme/src/theme-discovery.ts`**
   - Ajouter import manquant `ThemeValidationError`
   - **Fichier :** `packages/theme/src/theme-discovery.ts` ligne 87

3. **Investiguer `tests/http/bac-access.http.test.ts`**
   - Ajouter logs dans `beforeAll`
   - Vérifier si `bootServer()` échoue silencieusement
   - Tester avec port différent (3219)

### P1 — Avant prochain merge

4. **Corriger les 37 lint errors**
   - Commencer par `space-theme-routes.ts` (imports restreints)
   - Puis `theme-bridge.ts` (`compiledForThemeId`)
   - Puis tests (`any`, unused vars)

5. **Unifier Tailwind config (auth vs BAC)**
   - Option A : `bac-page.ts` utilise `renderHeadBlock()` (recommandé)
   - Option B : `renderHeadBlock()` émet literal hex comme `bac-page.ts`
   - **Pré-requis :** Réconcilier `modes.dark.tailwind` avec `tokens.colors.dark` dans `theme.json`

### P2 — Hygiène

6. **Nettoyer `chatgpt-web-mcp/`**
   - Ajouter au `.gitignore` si nécessaire
   - Ou supprimer si non requis

7. **Mettre à jour `.project/dashboard.md`**
   - Ou automatiser via script `pnpm run metrics`

8. **Scanner les 175 couleurs hardcoded**
   - Prioriser `start.ts` et `ssr-engine.ts`
   - Remplacer par tokens `--mx-color-*`

---

## 7. Plan d'Action Proposé

```
Session 1 (P0 — 1-2h)
├─ Fix start.ts closure scope
├─ Fix theme-discovery.ts import
└─ Debug bac-access.http.test.ts timeout

Session 2 (P1 — 2-3h)
├─ Corriger 10-15 lint errors critiques
├─ Unifier Tailwind config (auth vs BAC)
└─ Réconcilier theme.json palettes

Session 3 (P2 — 1-2h)
├─ Corriger lint errors restants
├─ Nettoyer chatgpt-web-mcp/
└─ Mettre à jour dashboard.md
```

---

## 8. Validation Requise

**Avant toute modification :**

- [ ] Utilisateur valide la priorité (P0 → P1 → P2)
- [ ] Utilisateur confirme que l'analyse auth-page mismatch est correcte
- [ ] Utilisateur décide si `chatgpt-web-mcp/` est à conserver ou supprimer

**Après corrections P0 :**

- [ ] `pnpm test:typecheck` passe
- [ ] `pnpm test` passe (bac-access.http.test.ts réparé)
- [ ] `pnpm lint` ≤ 10 erreurs (objectif intermédiaire)

---

## 9. Git State

```
Commit avant analyse : ee98e3e
Branche              : audit-technique-mosaix-8397822254578305712
Modified (uncommitted): 9 fichiers
Rollback             : git stash / git reset --hard ee98e3e
```

---

**Prochaine action :** Attendre validation utilisateur pour commencer les corrections P0.