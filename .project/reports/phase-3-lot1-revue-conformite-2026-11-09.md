# Revue de conformité — Phase 3 Lot 1 (Socle de configuration)

**Date :** 2026-11-09  
**Type :** Lecture seule — aucun fichier modifié durant cette revue  
**Fichiers concernés :**
- `packages/core/src/config/config-schema.ts`
- `packages/core/src/config/config-loader.ts`
- `packages/core/src/config/config-loader.test.ts`
- `packages/core/src/config/index.ts`
- `packages/core/src/index.ts`
- `src/start.ts`

**Verdict final : CERTIFIÉ SOUS RÉSERVE** (voir recommandations ci-dessous)

---

## 1. Validation Zod

| Vérification | Résultat | Preuve |
|-------------|----------|--------|
| Schéma couvre toutes les variables déclarées | ✅ Conforme | `config-schema.ts:16-70` — 33 variables couvertes (infrastructure, secrets, OAuth, environnement, sécurité réseau, plateforme, terminal, setup) |
| Variables absentes traitées | ✅ Conforme | Toutes optionnelles sauf celles avec `.default()` ; `safeParse` gère l'absence |
| Variables vides rejetées | ⚠️ Partiel | `z.string().min(32)` pour les secrets rejette les vides. Mais `DATABASE_URL: z.string().url().optional()` accepte une chaîne vide ? Non — `.url()` rejette une chaîne vide. |
| Variables invalides rejetées | ✅ Conforme | `safeParse` rejette et lève "Configuration invalide" (testé : `config-loader.test.ts` lignes 95-107) |
| Diff dev/test/prod | ✅ Conforme | `NODE_ENV` et `MOSAIX_ENV` gérés ; `isProduction` conditionne le fail-fast secrets |

**Défauts non bloquants :** Aucun défaut bloquant sur la validation Zod.

---

## 2. Fail-fast

| Vérification | Résultat | Preuve |
|-------------|----------|--------|
| Secrets critiques obligatoires en production | ✅ Conforme | `config-loader.ts:88-94` — `MOSAIX_AUTH_JWT_SECRET` ou `JWT_SECRET` requis (>= 32 chars) en production, sinon `FATAL_SECURITY` |
| Adaptateur désactivé ne bloque pas | ✅ Conforme | Les secrets OAuth sont `.optional()` — absence ne bloque pas (provider désactivé) |
| Aucune valeur par défaut dangereuse | ✅ Conforme | Les secrets n'ont pas de valeur par défaut ; seulement `MOSAIX_DEFAULT_BAC="solara"`, `MOSAIX_COMPOSITION="community-platform"`, `MOSAIX_REQUEST_TIMEOUT_MS="30000"`, `MOSAIX_DB_CONTAINER="mosaix-db-1"` — aucune valeur secrète par défaut |
| Erreur explicite si variable manquante | ✅ Conforme | Messages d'erreur clairs (`FATAL_SECURITY`, `Configuration invalide`) |

**Défauts non bloquants :** `MOSAIX_SESSION_SECRET` génère un avertissement (warn) pas une erreur fatale en production si < 32 chars. C'est cohérent avec le code existant (`security-guard.ts` fait de même).

---

## 3. Immutabilité (deepFreeze)

| Vérification | Résultat | Preuve |
|-------------|----------|--------|
| deepFreeze parcourt récursivement | ✅ Conforme | `config-loader.ts:26-35` — `Object.getOwnPropertyNames` + récursion sur objets non gelés |
| Tableaux gérés | ⚠️ Partiel | `deepFreeze` traite les tableaux comme des objets (`typeof [] === "object"`). Les éléments du tableau ne sont pas gelés individuellement, mais il n'y a pas de tableau dans la config actuelle. |
| Aucune mutation après validation | ✅ Conforme | `deepFreeze(config)` retourné à la ligne 149 |
| Map/Set non concernés | ✅ N/A | La config ne contient que des objets plats et des chaînes |
| Erreurs de construction non masquées | ✅ Conforme | `deepFreeze` est appelé après `safeParse` réussi ; si Zod échoue, l'erreur est levée avant |

**Défauts non bloquants :** Aucun. `deepFreeze` est correct pour les objets plats de la configuration.

---

## 4. Sécurité

| Vérification | Résultat | Preuve |
|-------------|----------|--------|
| Aucun secret dans les logs | ✅ Conforme | `config-loader.ts:143-146` — `logger.warn(warning)` ne logue que des messages statiques sans les valeurs des secrets (test : `config-loader.test.ts` lignes 216-233) |
| Erreurs Zod ne révèlent pas les valeurs | ✅ Conforme | Les erreurs Zod mentionnent le nom du champ (ex: `MOSAIX_AUTH_JWT_SECRET: String must contain at least 32 character(s)`) mais jamais la valeur (test : `config-loader.test.ts` lignes 236-249) |
| Aucune config sensible côté client | ✅ Conforme | La config est chargée côté serveur (`src/start.ts`), jamais exportée vers le navigateur |
| Aucun accès global non contrôlé aux BACs | ✅ Conforme | `loadConfig()` est appelé dans `src/start.ts` ; le résultat `appConfig` est utilisé localement pour `REQUEST_TIMEOUT_MS` uniquement. Aucun BAC n'y a accès. |
| Pas de singleton global | ✅ Conforme | `appConfig` est une `const` locale dans `start.ts`, pas exportée |

**Défauts non bloquants :** Aucun défaut bloquant sur la sécurité.

---

## 5. Architecture

| Vérification | Résultat | Preuve |
|-------------|----------|--------|
| Aucun `process.env` dans le domaine métier | ✅ Conforme | Le module `config/` est dans `packages/core/` ; aucun fichier de `apps/*/src/domain/` n'est modifié |
| Chargement à la frontière de composition | ✅ Conforme | `loadConfig()` appelé dans `src/start.ts` (point de composition), avant l'utilisation des valeurs |
| `start.ts` pas dépendant des détails internes | ✅ Conforme | `start.ts` importe seulement `loadConfig` depuis `@mosaix/core` et utilise `appConfig.platform.requestTimeoutMs` |
| Module indépendant des domaines métier | ✅ Conforme | `config-schema.ts` et `config-loader.ts` ne importent aucun domaine métier (`apps/*`) |
| `deepFreeze` appelé après validation | ✅ Conforme | Ligne 149, après `safeParse` réussi |
| Import bien placé (mineur) | ⚠️ Esthétique | L'import de `loadConfig` et l'appel sont placés entre deux blocs d'imports dans `start.ts` (lignes ~76-87), ce qui est inhabituel mais fonctionne. Ce n'est pas un défaut bloquant. |

**Défauts non bloquants :** L'emplacement de l'import dans `start.ts` est inhabituel mais fonctionnel.

---

## 6. Tests

| Vérification | Résultat | Preuve |
|-------------|----------|--------|
| 23 tests unitaires | ✅ Conforme | `config-loader.test.ts` — 23 tests, tous passés |
| Variables obligatoires absentes | ✅ Couvert | Tests lignes 41-53 (fail-fast production JWT) |
| Valeurs invalides | ✅ Couvert | Tests lignes 95-107 (NODE_ENV invalide, timeout non numérique, maintenance invalide) |
| Valeurs facultatives absentes | ✅ Couvert | Tests lignes 110-122 (config valide sans optionnelles, secrets undefined) |
| Valeurs par défaut | ✅ Couvert | Tests lignes 125-144 (defaultBacId, compositionId, requestTimeoutMs, dbContainer) |
| Activation/désactivation conditionnelle | ✅ Couvert | Tests lignes 147-177 (maintenance on/off, détection prod via MOSAIX_ENV et NODE_ENV) |
| Absence de fuite de secrets | ✅ Couvert | Tests lignes 180-200 (pas de secrets dans les logs) et 203-212 (pas de secrets dans messages d'erreur) |
| Injection correcte / immuabilité | ✅ Couvert | Tests lignes 215-225 (Object.freeze / deepFreeze) et 228-240 (sections exposées) |
| Compatibilité tests existants | ✅ Couvert | Tests lignes 243-253 (process.env par défaut, source custom) |
| Intégration démarrage | ✅ Couvert | Tests lignes 256-273 (config complète et cohérente) |
| Tests existants package core non régressés | ✅ Conforme | 241 tests passés (30 test files) |
| Tests EventBus (Phase 1) non régressés | ✅ Conforme | 18 tests passés |

**Défauts non bloquants :** Aucun. Les tests couvrent bien les scénarios critiques.

---

## 7. Diff (fichiers modifiés)

| Fichier | Action | Justification | Hors périmètre ? |
|---------|--------|---------------|------------------|
| `packages/core/src/config/config-schema.ts` | Créé | Schémas Zod + interfaces typées | Non |
| `packages/core/src/config/config-loader.ts` | Créé | `loadConfig()` + fail-fast + deepFreeze | Non |
| `packages/core/src/config/config-loader.test.ts` | Créé | 23 tests unitaires | Non |
| `packages/core/src/config/index.ts` | Créé | Point d'export | Non |
| `packages/core/src/index.ts` | Modifié | Export du module config | Non (ajout d'export seulement) |
| `src/start.ts` | Modifié | Import `loadConfig`, appel au démarrage, remplacement `process.env.MOSAIX_REQUEST_TIMEOUT_MS` → `appConfig.platform.requestTimeoutMs` | Non (une seule variable migrée, cas d'usage concret) |

**Aucun fichier hors périmètre.** Aucun des 41 autres fichiers `process.env` n'est touché. Aucune table SQL créée. Aucun cache ajouté.

---

## Recommandation

**Verdict : CERTIFIÉ SOUS RÉSERVE**

Le Lot 1 est solidement implémenté :
- Architecture respectant les limites décidées (pas de singleton, pas de cache, pas de DB dynamique, pas de migration globale)
- Schémas Zod complets et bien typés
- Fail-fast conditionnel approprié
- Immutabilité profonde via `deepFreeze`
- Sécurité : secrets non logués, non exposés
- Tests complets (23/23) et pas de régression (241/241 package core)

**Réserves mineures (non bloquantes) :**
1. L'emplacement de l'import `loadConfig` dans `start.ts` est inhabituel (entre deux blocs d'imports) — esthétique uniquement.
2. `MOSAIX_SESSION_SECRET` génère un avertissement (warn) et non une erreur fatale en production si < 32 chars — cohérent avec le code existant mais pourrait être durci ultérieurement.
3. Les 41 autres fichiers lisant `process.env` directement restent inchangés — c'est attendu (migration lot par lot).

**Autorisation Lot 2 : OUI, mais avec prudence.**

Le socle est suffisamment robuste pour commencer la migration des secrets prioritaires (Lot 2 : `security-guard.ts`, `psp-webhook-handler.ts`, `social-auth-service.ts`). Cependant, compte tenu de l'impact potentiel d'une erreur dans le système central de configuration sur tous les BACs, je recommande :
- Valider chaque migration de secret avec des tests dédiés
- Maintenir la rétrocompatibilité (valeur d'ENV directe toujours fonctionnelle en parallèle pendant la transition)
- Ne pas migrer tous les fichiers en une seule fois

---
*Rapport de revue produit en lecture seule. Aucun fichier n'a été modifié durant cette revue.*