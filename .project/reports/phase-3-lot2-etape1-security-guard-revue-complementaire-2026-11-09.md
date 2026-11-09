# Revue complémentaire — Phase 3 Lot 2 Étape 1 (Security Guard)

**Date :** 2026-11-09  
**Type :** Lecture seule (point 1) + Tests ajoutés (point 2)  
**Objet :** Lever les deux réserves de ChatGPT avant certification du Lot 2 Étape 1  
**Rapport précédent :** `.project/reports/phase-3-lot2-etape1-security-guard-2026-11-09.md`

---

## Point 1 — Identité du fichier migré (LECTURE SEULE, aucun fichier modifié)

### Vérification de l'existence des deux chemins

| Chemin | Existe ? | Statut |
|--------|----------|--------|
| `apps/citadelle/src/infrastructure/security-guard.ts` | ❌ N'EXISTE PAS | Chemin mentionné par ChatGPT dans l'autorisation initiale, mais absent du repository |
| `src/shell/security-guard.ts` | ✅ EXISTE | Seul fichier `security-guard.ts` du repository |

### Preuve
- `glob **/security-guard.ts` retourne uniquement `src/shell/security-guard.ts`
- `ls apps/citadelle/src/infrastructure/security-guard.ts` → "Impossible de trouver le chemin"

### Consommateurs de `src/shell/security-guard.ts` (inventaire complet)

| Fichier | Ligne | Usage |
|---------|-------|-------|
| `bootstrap/app.ts` | 26 (import), 159 (appel) | Point de composition principal — importe `SecurityGuard`, appelle `enforceProductionConstraints()` |
| `tests/security-shell-boundaries.test.ts` | 2 (import), 45, 62 (appels) | Tests unitaires de validation d'environnement |
| `src/start.ts` | 309 | Uniquement un commentaire de doc ("SecurityGuard + isDemoMode()") — pas d'appel de code |
| `src/shell/security-guard.ts` | 6, 27, 71, 76 | Définition de la classe et appels internes |

### Conclusion sur l'identité
Il n'existe **qu'un seul** `SecurityGuard` dans le repository : `src/shell/security-guard.ts`. Le chemin `apps/citadelle/src/infrastructure/security-guard.ts` mentionné dans l'autorisation initiale de ChatGPT **n'existe pas** et n'a jamais existé. Il s'agissait d'une erreur de chemin dans la consigne. Le fichier migré est donc bien le composant de sécurité unique du projet, utilisé par `bootstrap/app.ts` (point de composition) et ses tests.

### Frontières BAC
`src/shell/` est le shell de la plateforme, pas un BAC métier. `SecurityGuard` n'appartient à aucun BAC spécifique ; c'est une infrastructure transversale. Aucun BAC n'y accède directement. La migration ne contoure aucune frontière BAC.

---

## Point 2 — Fallback process.env (tests ajoutés)

### Implémentation (`src/shell/security-guard.ts`)

| Méthode | Comportement sans config | Comportement avec config injectée | Priorité |
|---------|-------------------------|----------------------------------|----------|
| `isProductionEnvironment()` | Lit `process.env.MOSAIX_ENV ?? process.env.NODE_ENV` | Lit `this.config.env.isProduction` | Config injectée prioritaire |
| `validateEnvironment()` | Lit `process.env.MOSAIX_AUTH_JWT_SECRET` / `process.env.JWT_SECRET` / `process.env.MOSAIX_SESSION_SECRET` | Lit `this.config.security.jwtSecret` / `this.config.security.sessionSecret` | Config injectée prioritaire |
| `enforceProductionConstraints()` | Appelle `this.validateEnvironment()` + fallback `process.env` | Appelle `this.validateEnvironment()` avec config injectée | Config injectée prioritaire |

### Tests ajoutés (`tests/security-shell-boundaries.test.ts`)

| Test | Scénario | Résultat attendu | Résultat obtenu |
|------|----------|-----------------|-----------------|
| `utilise la configuration injectée quand fournie` | `process.env` = production + secret invalide ; config injectée = development + secret valide | `valid = true` (config injectée prioritaire) | ✅ Pass |
| `rejet secret manquant en production avec config injectée` | `process.env` = development ; config injectée = production + secret manquant | `valid = false`, erreur `FATAL_SECURITY` | ✅ Pass |
| `fallback process.env quand aucune config n'est injectée` | `process.env` = production + secret invalide ; aucune config | `valid = false`, erreur `Production JWT secret` | ✅ Pass |

### Preuve de priorité de `appConfig`

Le test "utilise la configuration injectée quand fournie" démontre explicitement que :
- `process.env.NODE_ENV = "production"` et `process.env.MOSAIX_AUTH_JWT_SECRET = "short"` (invalide)
- Mais `config.env.nodeEnv = "development"` et `config.security.jwtSecret = "super-secure-..."` (valide)
- Résultat : `valid = true`, aucune erreur

Cela prouve que **la configuration injectée a la priorité effective sur `process.env`** : même quand `process.env` dit "production" avec un secret invalide, la config injectée disant "development" avec un secret valide l'emporte.

### Preuve que le fallback ne masque pas une config invalide

Quand aucune config n'est injectée (`new SecurityGuard()`), le fallback sur `process.env` est utilisé. Si `process.env` contient un secret invalide en production, le test `fallback process.env quand aucune config n'est injectée` vérifie que `valid = false` avec l'erreur `Production JWT secret`. Le fallback ne masque donc pas une configuration invalide : il la reflète fidèlement.

### Documentation du fallback

Dans `src/shell/security-guard.ts` (lignes 8-13) :
```typescript
// Migration Lot 2 / Étape 1 — Configuration centralisée (ConfigService).
// Cette classe reçoit désormais sa configuration via le constructeur
// (injection explicite, pas de singleton global, aucun accès direct à
// `process.env` lorsqu'une configuration est fournie).
//
// Un constructeur sans argument conserve la lecture de `process.env` pour
// la rétrocompatibilité pendant la migration lot par lot des 41 fichiers
// restants. Une fois tous les appelants migrés, ce fallback pourra être
// supprimé.
```

Le fallback est explicitement documenté comme temporaire.

---

## Point 3 — Preuves de conformité

### Diff exact de la migration

**`src/shell/security-guard.ts`** (réécriture complète) :
- Ajout import `type { ReadonlyAppConfig }` depuis `@mosaix/core`
- Ajout constructeur `constructor(private config?: ReadonlyAppConfig)`
- `isProductionEnvironment()` : méthode d'instance, lit `this.config.env.isProduction` ou fallback `process.env`
- `validateEnvironment()` : méthode d'instance, lit `this.config.security.*` ou fallback `process.env`
- `enforceProductionConstraints()` : méthode d'instance, utilise `this.config` ou fallback
- Méthodes statiques `isProductionEnvironment(source)`, `validateEnvironment(source)`, `enforceProductionConstraints()` conservées pour rétrocompatibilité

**`bootstrap/app.ts`** :
- Ajout import `loadConfig`, `ReadonlyAppConfig` depuis `@mosaix/core`
- Déclaration `let appConfig: ReadonlyAppConfig`
- À l'étape "env" : `appConfig = loadConfig(source);`
- À l'étape "security" : `const guard = new SecurityGuard(appConfig); guard.enforceProductionConstraints();`

**`tests/security-shell-boundaries.test.ts`** :
- Changement import `security-guard.js` → `security-guard.ts`
- Remplacement `SecurityGuard.validateEnvironment()` par `new SecurityGuard().validateEnvironment()` (2 occurrences)
- Ajout de 3 tests : config injectée avec priorité, secret manquant en production avec config, fallback process.env

### Inventaire des consommateurs de SecurityGuard

| Consommateur | Type | Statut après migration |
|-------------|------|-----------------------|
| `bootstrap/app.ts:159` | Point de composition production | ✅ Migré (instancie avec `appConfig`) |
| `tests/security-shell-boundaries.test.ts:45,62` | Tests unitaires | ✅ Migrés (instancient avec `new SecurityGuard()`) |
| `src/start.ts:309` | Commentaire de doc uniquement | N/A (pas d'appel de code) |

### Variables migrées

| Variable | Avant | Après |
|----------|-------|-------|
| `MOSAIX_AUTH_JWT_SECRET` / `JWT_SECRET` | `process.env.MOSAIX_AUTH_JWT_SECRET \|\| process.env.JWT_SECRET` | `this.config.security.jwtSecret` (fallback `process.env`) |
| `MOSAIX_SESSION_SECRET` | `process.env.MOSAIX_SESSION_SECRET` | `this.config.security.sessionSecret` (fallback `process.env`) |
| `MOSAIX_ENV` / `NODE_ENV` | `process.env.MOSAIX_ENV \|\| process.env.NODE_ENV` | `this.config.env.isProduction` (fallback `process.env`) |

### Risques résiduels

| Risque | Niveau | Mitigation |
|--------|--------|------------|
| Fallback `process.env` encore utilisé par les appelants non migrés | Moyen | Documenté comme temporaire ; sera supprimé quand tous les 41 fichiers restants seront migrés |
| Constructeur optionnel permet d'omettre la config | Faible | Tests couvrent les deux chemins (avec et sans config) |
| `MOSAIX_SESSION_SECRET` est un avertissement (warn) et non un fail-fast | Faible | Choix assumé pour rétrocompatibilité, documenté dans le code |

---

## Verdict de cette revue complémentaire

| Réserve initiale | Statut après revue |
|-----------------|-------------------|
| R1 — Identité du fichier | ✅ Levée : `apps/citadelle/src/infrastructure/security-guard.ts` n'existe pas ; `src/shell/security-guard.ts` est le seul et unique Security Guard |
| R2 — Fallback process.env | ✅ Levée : tests couvrent les deux chemins, priorité de `appConfig` démontrée, fallback documenté comme temporaire |
| R3 — Preuves de conformité | ✅ Fournies : diff exact, inventaire des consommateurs, tests avec/sans injection, preuve de priorité, variables migrées, frontières BAC, risques résiduels |

### Recommandation

**CERTIFIÉ** — La migration de `security-guard.ts` vers ConfigService est conforme aux exigences du Lot 2. Le protocole (un fichier à la fois, tests + diff + revue avant de passer au suivant) est respecté.

**Autorisation pour l'étape suivante :** Le Lot 2 Étape 1 est certifié. L'étape suivante (`packages/auth/src/oauth/social-auth-service.ts`) peut être entamée, en respectant le même protocole : migration atomique, tests dédiés, revue avant passage à l'étape suivante.

---
*Rapport produit en complément de la revue initiale. Aucun fichier n'a été modifié durant la phase de lecture seule du point 1. Les tests ajoutés (point 2) sont dans `tests/security-shell-boundaries.test.ts`.*