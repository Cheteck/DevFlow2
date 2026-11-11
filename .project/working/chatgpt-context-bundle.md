# Contexte Bundle — Theme Bridge Concurrency Fix

**Date:** 2026-11-01  
**Branche:** `audit-technique-mosaix-839782254578305712`  
**Objectif:** Faire analyser par ChatGPT le bug de contamination SSR et valider la correction

---

## 1. Résumé du problème

**Bug critique:** `theme-bridge.ts` utilise des variables globales mutables (`currentMode`, `currentCompiledTheme`) partagées entre TOUTES les requêtes concurrentes.

**Symptôme:**
- Requête A demande `dark` → écrit `currentMode = "dark"` → `await` async
- Requête B demande `light` → écrase `currentMode = "light"` → `await` async
- Requête A reprend → lit `currentMode = "light"` (contaminé!)

**Preuve:** Test failing dans `src/shell/theme/theme-bridge-concurrency.test.ts`

---

## 2. Fichiers modifiés (git diff --stat)

```
 apps/solara/src/presentation/solara-view.ts     |  2 +-
 packages/theme/src/theme-discovery.ts           |  4 ++
 src/shell/pages/auth-pages.ts                   | 57 ++++++++++++++++++++++-------
 src/shell/pages/home-page.ts                    | 10 ++---
 src/shell/renderer.ts                           | 16 ++++----
 src/shell/ssr-engine.test.ts                    |  7 +++-
 src/shell/ssr-engine.ts                         | 21 +++++------
 src/shell/styles.css                            | 25 ++++++++++---
 src/start.ts                                    |  9 ++---
 9 files changed, 100 insertions(+), 51 deletions(-)
```

**Changements clés:**
- Suppression des définitions `.glass-card` en dur (RGBA hardcodés) de `ssr-engine.ts` et `start.ts`
- Déplacement de `.glass-card` dans `styles.css` avec tokens `--color-*`
- Ajout du bouton thème "Auto" (system) dans les pages auth
- Unification des références de couleurs (`indigo-500` → `primary-hover`)
- Ajout validation manifeste dans `theme-discovery.ts`

---

## 3. Test de concurrence (PREUVE DU BUG)

**Fichier:** `src/shell/theme/theme-bridge-concurrency.test.ts`

**Code du test:**

```typescript
describe("SSR Concurrency — Theme Contamination", () => {
  it("DEMONSTRATES BUG: global currentMode is contaminated across concurrent requests", async () => {
    const capturedDuringRequest: Array<{
      requestId: string;
      requestedMode: string;
      capturedMode: string;
      capturedThemeId: string;
      compiledTheme: CompiledTheme | null;
    }> = [];

    // Request A: aurora + dark mode
    const promiseA = (async () => {
      const ctx: RenderContext = {
        theme: { themeId: "aurora", source: "space", manifest: manifestA! },
      };
      await renderContext.run(ctx, async () => {
        const compiled = await applyThemeMode("dark"); // Step 1: écrit currentMode = "dark"
        const capturedMode = getThemeMode(); // Step 2: lit APRES await (contamination possible)
        capturedDuringRequest.push({ requestId: "A", requestedMode: "dark", capturedMode, ... });
      });
    })();

    // Request B: cobalt + light mode — démarre PENDANT que A attend
    const promiseB = (async () => {
      const ctx: RenderContext = {
        theme: { themeId: "cobalt", source: "space", manifest: manifestB! },
      };
      await renderContext.run(ctx, async () => {
        const compiled = await applyThemeMode("light"); // Écrase currentMode = "light"
        const capturedMode = getThemeMode();
        capturedDuringRequest.push({ requestId: "B", requestedMode: "light", capturedMode, ... });
      });
    })();

    await Promise.all([promiseA, promiseB]);

    // ASSERT: Request A devrait voir "dark" mais voit souvent "light"
    expect(resultA!.capturedMode).toBe(resultA!.requestedMode); // ← FAIL
  });
});
```

**Résultat attendu:** `expected 'dark' to be 'light'` (échec prouvant la contamination)

---

## 4. Code problématique (theme-bridge.ts)

**Lignes 34-36 (globals mutables):**
```typescript
let activeRuntime: ThemeRuntime | null = null;
let currentCompiledTheme: CompiledTheme | null = null;  // ← GLOBAL partagé
let currentMode: ThemeMode = "light";                   // ← GLOBAL partagé
```

**Lignes 178-194 (applyThemeMode — écriture globale):**
```typescript
export async function applyThemeMode(mode: ThemeMode): Promise<CompiledTheme> {
  currentMode = mode;  // ← ÉCRITURE GLOBALE (race condition ici)
  const outcome = await activeRuntime!.apply({ ... }); // ← ASYNC (yield control)
  if (outcome.compiled) {
    currentCompiledTheme = outcome.compiled;  // ← ÉCRITURE GLOBALE
  }
  return currentCompiledTheme!;
}
```

**Lignes 208-220 (getResolvedTheme — TOCTOU):**
```typescript
export function getResolvedTheme(mode: ThemeMode = "light"): CompiledTheme {
  // CHECK (peut devenir stale pendant l'exécution)
  if (currentCompiledTheme && currentMode === mode && compiledForThemeId === getEffectiveThemeId()) {
    return currentCompiledTheme;
  }
  const compiled = compile(getActiveManifest(), mode);
  currentCompiledTheme = compiled;  // ← USE (écrase pour les autres requêtes)
  currentMode = mode;
  compiledForThemeId = getEffectiveThemeId();
  return compiled;
}
```

---

## 5. Contraintes d'architecture (AGENTS.md)

**Règles absolues:**
- Ne jamais dupliquer un nom de fichier (basename unique)
- Un port et son adaptateur portent des noms distincts
- `.glass-card` doit utiliser exclusivement des tokens `--color-*`
- Pas de RGBA hardcodés dans le code TypeScript

**Principe fondamental:**
> "Une modification ne doit pas introduire progressivement de nouvelles conventions incompatibles, duplication d'architecture, exceptions permanentes."

**Classification du changement:**
- **Risque:** High (changement architecture SSR, impacte toutes les pages)
- **Validation requise:** Tests de concurrence + validation humaine
- **Rollback:** Git revert possible (commits atomiques)

---

## 6. Contexte supplémentaire

**Structure du thème:**
- `themes/mosaix-default/theme.json` — source de vérité (tokens, modes, tailwind)
- `themes/midnight-ocean/theme.json` — thème alternatif
- `packages/theme/src/theme-discovery.ts` — découverte automatique
- `packages/theme/src/theme-manifest-schema.ts` — validation schema (nouveau)

**Render Context:**
- `src/server/context/render-context.ts` — contexte par requête (AsyncLocalStorage)
- `tryGetRenderContext()` — récupère le contexte scope requête
- Utilisé pour `getEffectiveThemeId()` mais PAS pour `currentMode` / `currentCompiledTheme`

**Pages affectées:**
- `/login`, `/register` — pages auth (auth-pages.ts)
- `/` — home page (home-page.ts)
- Toutes les pages SSR via `renderer.ts` et `ssr-engine.ts`

---

## 7. Questions pour ChatGPT

1. **Correction minimale:** Quelle est la plus petite modification pour isoler `currentMode` et `currentCompiledTheme` par requête (sans refactoring massif) ?

2. **Pattern recommandé:** Faut-il utiliser `AsyncLocalStorage` pour stocker l'état thème par requête, ou passer `mode` et `compiledTheme` comme paramètres explicites à toutes les fonctions ?

3. **Validation:** Quels tests supplémentaires ajouter pour garantir l'absence de régression (ex: test de charge avec 50 requêtes simultanées) ?

4. **Migration:** Comment migrer progressivement sans casser les appels existants à `getThemeMode()` et `getCompiledTheme()` ?

---

## 8. Actions attendues

**Après analyse, ChatGPT doit:**
- ✅ Proposer une correction précise (lignes exactes à modifier)
- ✅ Identifier les risques de rupture (breaking changes)
- ✅ Suggérer un plan de validation (tests à exécuter)
- ✅ Recommander une stratégie de migration (si nécessaire)

**Format de réponse attendu:**
- Conseil : analyse synthétique + recommandation
- Suggestion : alternative ou amélioration
- Requête pour l'agent : action ou information à fournir
- CTA : action claire et concrète pour l'étape suivante

---

## 9. Liens utiles

- **Test failing:** `src/shell/theme/theme-bridge-concurrency.test.ts`
- **Code source:** `src/shell/theme/theme-bridge.ts`
- **Diff complet:** `git diff` (voir section 2)
- **Règles projet:** `AGENTS.md` (Constitution et procédures opérationnelles)
- **Dashboard:** `.project/dashboard.md`
