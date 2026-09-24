# Audit Themes + Frontend — code réel uniquement
Date: 2026-09-21 | Méthode: 3 subagents white-box + vérification directe | Doc ignorée

## Intention

Intention du développeur pour le système de gestion de themes, reconstruite à partir du code :

1. **Design system packagé** : un theme = `theme.json` versionné (`id, version, contractVersion semver`) avec layouts, slots (`slots/header.html`, `layouts/full-width.html`), tokens référençables (`tokens: "tokens/base.json"`), presets, locales, mails et `settings.schema.json` — voir `themes/_template/theme.json:1-42`, `themes/_template/{layouts,slots,tokens,locales,mails}/`.
2. **Source unique compilée** : traduire `ThemeManifest + ThemeMode` en map déterministe `{--mx-<groupe>-<token>: value}` byte-stable (clés triées), via `compile()` (`packages/core/src/theme/theme-compiler.ts:71-79`, table ABI `THE_GROUP_CSS_NAMES:50-57`, overlay `tokensWithModeOverlay:85-94`, `flatten:134-150`, `coerceValue:158-179`), exposée comme « Source of Truth: --mx-* » (`src/shell/theme/theme-bridge.ts:6,86`).
3. **Résolution entity-first** : chaîne `entity > user > application > platform` (`theme-resolver.ts:39-44`), 5 étapes pures/idempotentes (`resolve(ctx)`, `theme-resolver.ts:5-8,336`), fail-open (erreur attachée, jamais de crash, `D-20`), héritage `extends`, cache `themeId:version:mode` (`theme-cache.ts:56-125`), injection diffée batchée rAF >40 racines, Shadow-DOM safe sans toucher `document/window` (`theme-injector.ts:1-23,28-37,43-58`).
4. **Pont SSR** : `initThemeBridge → applyThemeMode → renderThemeStyleTag` (`theme-bridge.ts:27-60,74-119`) injectant `<style id="mosaix-compiled-theme">` avec `:root{--mx-*}`, alias dépréciés `--bg-*/--mosaix-*` et media queries a11y (`prefers-reduced-motion`, `forced-colors`), commuté via `<html class data-theme-mode>` (`src/start.ts:418,668`) et `POST /api/theme`.
5. **Multi-cible et personnalisation** : registry de cibles (`theme-target-registry.ts`), assignments par source (`platform,admin,user,application`), overrides composition/preset persistés (`.mosaix/composition-overrides.json` via `src/shell/editor.ts`), modes `light|dark|high-contrast|system` (`theme-mode.ts:17`), découverte par scan avec validation semver/extends/cycles (`theme-discovery.ts:54-115`).

En somme : un moteur de themes déterministe, isolé par cible, extensible par héritage et surcharge, rendu côté serveur et injecté côté client sans cout global — dont l'audit montre que seule la partie SSR mono-shell est aujourd'hui câblée.

## Verdict global: STOP (themes multi-app non-GO, frontend XSS bloquant)

Seul chemin qui marche vraiment: switch light/dark SSR mono-shell sur thème hardcodé.
Tout le reste (discovery, extends, slots per-app, vars consommées, overrides persistés) est cassé, mort ou non câblé.

## 1. Pipeline theme réel vs théorique

Théorique (core): `ThemeDiscovery.discoverThemes()` (`packages/core/src/theme/theme-discovery.ts:21`) → `ThemeResolver.resolve()` 5 étapes (`theme-resolver.ts:336`) → `ThemeInheritanceResolver` (`:45`) → `compile()` (`theme-compiler.ts:71`) → `ThemeCache` (`theme-cache.ts:56`) → `ThemeInjector.inject()` (`theme-injector.ts:123`) → `publish(theme.changed)` (`theme-runtime.ts:191`).

Réel (prod `src/start.ts:57,90` + `src/shell/theme/theme-bridge.ts:44-53`): `createThemeRuntime` → `initThemeBridge` → `applyThemeMode` → `renderThemeStyleTag` interpolé SSR (`src/start.ts:423,673`). `ThemeDiscovery` jamais appelé en prod. `loadManifest` = lecteur ad-hoc `themes/<id>/theme.json` (`src/start.ts:60-87`). Store jamais `assign()` → `resolve()` retourne `{target}` sans `resolved` (`theme-resolver.ts:347-349`) → `apply()` sans compile (`theme-runtime.ts:192-195`) → `currentCompiledTheme` null au 1er appel (`theme-bridge.ts:59`). Seul le fallback `compile(MOSAIX_DEFAULT_THEME)` dans `renderThemeStyleTag:80` sauve le SSR.

Bugs avérés:
- `theme-bridge.ts:36` `registerTarget({type:"shell",id:"shell"})` ne matche pas `ThemeTargetRegistration{type,capabilities}` (`theme-target-registry.ts:32-35`).
- `src/start.ts:57` sans `inheritance` → fast-path mono-thème (`theme-resolver.ts:201-209`), `extends` inopérant.
- `MOSAIX_DEFAULT_THEME` (`src/shell/theme/mosaix-default-theme.ts:3-90`) sans `contractVersion/defaultLayout/slots` → passerait Zod permissif mais échoue `ThemeDiscovery:60`.
- `scripts/check-themes.ts:80` lit `preview.png` en utf-8 → faux positif.
- Cache jamais invalidé (`theme-runtime.ts:198-202`, `theme-cache.ts:104-114`).
- Doublons divergents: `src/theme/resolve-tokens.ts:12-46` (shallow) vs `packages/core/src/theme/resolve-tokens.ts` (deep) vs `theme-compiler.ts:111-126`; `src/theme/resolve-slot.ts:7-44` vs `packages/core/src/theme/resolve-slot.ts:27-127`. Vérifié: `src/theme/resolve-tokens.ts:12-46` shallow 1 niveau, testé mais mort en prod.

## 2. Manifest vs schema vs code: 3 vérités contradictoires

- `packages/contracts/src/theme/theme-manifest.schema.json:5` exige `id,name,version,contractVersion,defaultLayout,availableLayouts,slots,tokens`.
- `packages/schemas/src/index.ts:106-113` (Zod réellement utilisé) exige seulement `id,name,version`, `tokens/modes` optionnels, `.passthrough()`.
- `packages/contracts/src/theme/theme-tokens.schema.v1.json` exige `colors,typography,spacing,radius,breakpoints` + `additionalProperties:false` — aucun thème réel ne le satisfait (pas de `breakpoints`, ont `shadows/motion`), jamais importé.
- Conséquence: `mosaix-default/theme.json` + `midnight-ocean/theme.json` échouent JSON-schema mais passent Zod. `_template/theme.json` (schema-compatible, `tokens:"tokens/base.json"` string) échoue type TS `ThemeManifest.tokens: DesignTokens` (`theme-manifest.ts:12`).
- Modes: `theme-mode.ts:17` = `light|dark|high-contrast|system`, commentaires disent light/dark seuls (`theme-manifest.ts:18-21`), Zod `z.record(unknown)` laisse tout passer (`schemas:111`), `ThemeAssignmentSchema` (`:119`) = `z.string()` quelconque. `high-contrast` marche par accident.

## 3. Frontend: SSR string-template, 0 framework, XSS

Pattern: chaque frontend exporte `XxxPageView.render(): string` (`apps/beam/frontend/src/index.ts:173`, `commerce:188`, `citadelle:48,81,118`, `portfolio:34,563`, `solara:43`, etc.), assemblé via `src/shell/discovery.ts:31-36` + `src/start.ts:396,1113`. `escapeHtml` existe (`src/utils/security.ts:1`) mais 0 usage dans les 9 frontends (vérifié). Appliqué seulement shell (`renderer.ts:67,68,91,92`, `start.ts:422,531`).

Sinks confirmés (vérifié `apps/solara/frontend/src/index.ts:121,128` interpolation brute):
- `solara:121,122,125,128` `${post.author/authorRole/timestamp/bacSource/content}` SSR stocké (`src/start.ts:344` stocke `data.content.trim()` brut) + `:158,172` `innerHTML` DOM-XSS.
- `beam:242-243` `msgOut.innerHTML` via input, `solidarity:244,247,248` via `#sol-title`, `portfolio:507,516,519,524` via `prompt()`, `commerce:283,291` latente, `imperia:829` via `err.message`.
- Duplication: même scaffold copié 8× (`XxxStyles` + `render()` + `xxxNavigationItems` + contributions `shell.primary-sidebar`/`main.content`). `imperia:5-10` side-effect imports, `portfolio:28+557` double vue, `booking/frontend/src/index.ts:5-11` stub 11 lignes → fallback erreur (`discovery.ts:35`).
- Slots/permissions: filtrage réel seulement shell (`renderer.ts:13-18,374-384`, gate `start.ts:389`). Contributions frontends déclaratives jamais vérifiées (`beam:274`, `commerce:321`, `solara:194-206`). `SlotRegistry` (`packages/ui-runtime/src/index.ts:14-30`) sans filtre permission, importé par aucun frontend. `sdk/src/index.ts:1-283` zéro helper frontend.

## 4. Intégration theme→frontend: rompue au dernier km

Flux: `themes/*/theme.json:7-88` → `theme-compiler.ts:71-79` (`--mx-*`, overlay, `coerceValue:158-179`, `sortKeys:182-189`) → `theme-runtime.ts:191-218` → `theme-bridge.ts:74-119` `<style id="mosaix-compiled-theme">` + alias `--bg-*/--mosaix-*` + reduced-motion → `src/start.ts:418,668` `<html class="dark" data-theme-mode>`. Client `setTheme():578-583` = seul `setAttribute`, aucune maj vars, aucun `ThemeInjector` navigateur (zéro `register()` en prod, `injector.ts:100-160` no-op).

Consommation nulle: grep `--mx-` dans `apps/` = 1 hit (`imperia/.../platform-theme.service.ts:75`, ne lit pas les vars). `src/shell/styles.css:1-96` utilise `--font-sans/--color-primary`, jamais `--mx-*`. Tailwind/markup hardcode `#0b1326/#d0bcff` (`start.ts:434-451`). Vars émises jamais lues.

Mutations sans auth: `POST /api/composition/override` (`start.ts:236-278`), `POST /api/theme/preset` (`:281-327`, cast `:289,292`, surface hardcodée `:296,300`), `GET /api/theme` à effet de bord (`:139-148`), `POST /api/feature-flags//toggle` (`:188-233`, `rolesAllowlist` jamais vérifiée `feature-flags.ts:171-190`). CORS `*` (`:128`). Persistance: `editor.ts:7-18` écrase tout le fichier avec 1 surface, `feature-flags.ts:202-233` sans fsync, assignments `InMemory` jamais `assign()` (`start.ts:56`) → reset restart. Aucune atomicité/ETag/rollback (`composition-override-manager.ts:35-61`).

Gaps: `class="dark"` forcée (`start.ts:418,668`), toggle `dark↔light` seul (`renderer.ts:610-615`, Contrast inaccessible), cible unique `shell/shell`, précédence `entity>user>application>platform` jamais alimentée, `PlatformThemeService:82-86` appelle `getActiveAssignment:69` inexistante (0 hit core), fuite `:root` globale.

Sécurité CSS: `compile()` passthrough string (`theme-compiler.ts:159`), interpolation `${key}:${val}` sans sanitize (`theme-bridge.ts:90-92`), clés forgées non filtrées (`:145`). `theme.json` malveillant casse `</style>`. Path traversal contenu en prod (`start.ts:61-70` regex OK) mais `core/resolve-slot.ts:51,61` concatène `slotId` tenant sans sanitize.

Tests: unitaires OK (compiler, injector diff/batch-40, resolver fail-open, cache, discovery, `theme-bridge.test.ts:42-56`). Intégration vide: `conformance/suites/theme.ts:5-11` = check `name:string` seul. Aucun test POST override/preset, round-trip `.mosaix/*.json`, SSR→`getComputedStyle`, contraste, isolation per-app. Pas de e2e jsdom.

## 5. Plan de remédiation priorisé

P0 sécurité (STOP):
1. `escapeHtml` à la source (`start.ts:344`, `solara:113-137`, `beam:242`, `solidarity:244`, `portfolio:507`, `commerce:283`) + `textContent` client.
2. Auth sur 4 POST theme/composition/flags + allowlist CORS (`start.ts:102`).
3. Sanitizer CSS SSR (allowlist `^--[a-z0-9-]+$`, valeurs colors strictes) + valider `slotId`.

P1 déblocage:
4. `theme-bridge.ts:36` capabilities + `store.assign({target:{type:"shell",id:"shell"},themeId:"mosaix-default",source:"platform",mode})`.
5. Unifier schéma (1 source, `contractVersion` exigé, modes `light/dark/high-contrast`), supprimer doublon `breakpoints`, résoudre `tokens:string` ou interdire.
6. Brancher `--mx-*` dans markup ou supprimer émission; fixer `class="dark"` forcée; `cache.invalidate()` sur register/mutation.
7. Persistance multi-surface + mode (pas d'écrasement `editor.ts:7-18`), skip binaires `check-themes.ts:73-88`.
8. Supprimer/finir `booking` frontend, `PortfolioPimAdminPageView`, factoriser scaffold dupliqué 8×, étendre conformance au-delà du `name`.

## Sources
Subagents: audit-themes (pipeline/schemas/sécu), audit-frontends (XSS/duplication/slots), audit-intégration (flux/auth/persistance). Vérification directe: `src/theme/resolve-tokens.ts`, `apps/solara/frontend/src/index.ts:110-159`.
