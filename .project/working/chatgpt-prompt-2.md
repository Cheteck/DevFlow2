Voici le test de concurrence échouant et le diff complet demandé :

## TEST DE CONCURRENCE (theme-bridge-concurrency.test.ts)

```typescript
describe("SSR Concurrency — Theme Contamination", () => {
  it("DEMONSTRATES BUG: global currentMode is contaminated across concurrent requests", async () => {
    // Request A: aurora + dark mode
    const promiseA = (async () => {
      const ctx = { theme: { themeId: "aurora", source: "space", manifest: manifestA! } };
      await renderContext.run(ctx, async () => {
        const compiled = await applyThemeMode("dark"); // écrit currentMode = "dark"
        const capturedMode = getThemeMode(); // lit APRES await (contamination possible)
        capturedDuringRequest.push({ requestId: "A", requestedMode: "dark", capturedMode });
      });
    })();

    // Request B: cobalt + light mode — démarre PENDANT que A attend
    const promiseB = (async () => {
      const ctx = { theme: { themeId: "cobalt", source: "space", manifest: manifestB! } };
      await renderContext.run(ctx, async () => {
        const compiled = await applyThemeMode("light"); // écrase currentMode = "light"
        const capturedMode = getThemeMode();
        capturedDuringRequest.push({ requestId: "B", requestedMode: "light", capturedMode });
      });
    })();

    await Promise.all([promiseA, promiseB]);
    // ASSERT: Request A devrait voir "dark" mais voit souvent "light"
    expect(resultA!.capturedMode).toBe(resultA!.requestedMode); // ← FAIL
  });
});
```

Deuxième test: getResolvedTheme TOCTOU avec 20 requêtes concurrentes alternant light/dark.
Même pattern: 20 appels concurrents à getResolvedTheme(), random delay 0-10ms.
Attendu: 10 light + 10 dark corrects. Réel: contamination TOCTOU.

## DIFF COMPLET (9 fichiers)

### 1. packages/theme/src/theme-discovery.ts
```typescript
+ import { validateThemeManifest, validateThemeIdConsistency } from "./theme-manifest-schema.js";
```

### 2. apps/solara/src/presentation/solara-view.ts
- "from-primary to-indigo-500" → "from-primary to-primary-hover"

### 3. src/shell/pages/auth-pages.ts
- applyTheme() refactorisé: nativeSetTheme delegation, system mode support, data-resolved-mode
- Ajout bouton "Auto" (data-theme-btn="system")
- register-success-view: inline styles → Tailwind classes
- COLORS array: suppression fallback "orange"

### 4. src/shell/pages/home-page.ts
- indigo-500 → primary-hover partout (4 occurrences)

### 5. src/shell/renderer.ts
- indigo-500 → primary-hover (7 occurrences)
- gradient: "via-indigo-500" → "via-primary-hover"

### 6. src/shell/ssr-engine.test.ts
- Test modifié: plus d'attente "rgba(255,255,255,0.7)" (glass-card déplacé)
- Attente: "--mx-a:1" présent

### 7. src/shell/ssr-engine.ts
- Fonts: Inter → Plus Jakarta Sans (300-800) + JetBrains Mono
- Ajout fontFamily dans tailwind config (sans/mono via --font-sans/--font-mono)
- SUPPRESSION définition .glass-card (RGBA hardcodé)
- glass-hover-glow: rgba(139,92,246) → color-mix(var(--color-primary))
- transition: "all 0.3s ease" → var(--mx-motion-durationNormal)

### 8. src/shell/styles.css
- Ajout --font-mono: 'JetBrains Mono'
- .glass-card: blur 12→16px, border color-mix, box-shadow
- .auth-success-card: background/container réajustés
- Nouveau .auth-success-card .auth-success-icon-wrap
- Dark mode: .glass-card override (background 70%, border 40%)

### 9. src/start.ts
- SUPPRESSION définition .glass-card (RGBA hardcodé)
- Ajout NOTE commentaires: glass-card exclusivement dans styles.css

## CONTEXTE SUPPLÉMENTAIRE

Render Context (render-context.ts): AsyncLocalStorage par requête.
tryGetRenderContext() déjà utilisé pour getEffectiveThemeId().
Mais currentMode/currentCompiledTheme sont module-level, pas dans le contexte.

## QUESTIONS

1. Correction minimale pour isoler currentMode/currentCompiledTheme par requête ?
2. AsyncLocalStorage vs paramètres explicites — quel pattern ?
3. Tests supplémentaires pour valider (50 req concurrentes) ?
4. Migration progressive sans casser getThemeMode()/getCompiledTheme() existants ?

Réponds avec: Conseil, Suggestion, Requête, CTA (max 200 mots).