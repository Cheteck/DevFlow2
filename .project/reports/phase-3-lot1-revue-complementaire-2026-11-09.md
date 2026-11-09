# Revue de conformité complémentaire — Phase 3 Lot 1 (Socle de configuration)

**Date :** 2026-11-09  
**Type :** Lecture seule — aucun fichier modifié durant cette revue  
**Objet :** Clôture des 4 réserves identifiées par ChatGPT avant autorisation du Lot 2  
**Fichiers concernés :**
- `packages/core/src/config/config-schema.ts`
- `packages/core/src/config/config-loader.ts`
- `packages/core/src/config/config-loader.test.ts`
- `packages/core/src/config/index.ts`
- `packages/core/src/index.ts`
- `src/start.ts`

---

## Réserve 1 — Adoption incomplète du contrôle 7

### Constat
Le mécanisme de centralisation est construit, mais seul **1 fichier sur 42** utilise `loadConfig()` :
- `src/start.ts` : `process.env.MOSAIX_REQUEST_TIMEOUT_MS` → `appConfig.platform.requestTimeoutMs`

Les 41 autres fichiers lisent encore `process.env` directement.

### Preuve
Inventaire confirmé par `git grep -l -e 'process\.env\.'` : 42 fichiers, dont seul `src/start.ts` a été migré dans le Lot 1.

### Conclusion
**Le contrôle 7 est partiellement corrigé.** La capacité technique existe ; l'adoption effective par les BACs et le reste du shell reste à faire lot par lot. Cela ne bloque pas la certification du Lot 1 (socle construit), mais implique que la migration des 41 fichiers reste une tâche ouverte (Lots 2 à 6).

---

## Réserve 2 — Garantie d'immutabilité (deepFreeze)

### Implémentation (`config-loader.ts:26-35`)
```typescript
function deepFreeze<T extends object>(obj: T): T {
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name as keyof T];
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}
```

### Vérification
| Aspect | Résultat | Preuve |
|--------|----------|--------|
| Récursivité sur objets imbriqués | ✅ Conforme | `deepFreeze` appelle `deepFreeze(value)` sur chaque propriété objet non gelée |
| Traitement des tableaux | ⚠️ Limité | `typeof [] === "object"` → les tableaux sont parcourus, mais leurs éléments ne sont pas gelés individuellement. Aucun tableau n'est présent dans la config actuelle. |
| Objets non standards (Map, Set, Date) | ⚠️ Limité | `typeof new Date() === "object"` → tenté d'être gelé, mais `Object.freeze` sur une Date ne gèle pas ses méthodes. Aucun Date/Map/Set n'est présent dans la config actuelle. |
| `Object.isFrozen` vérifié avant récursion | ✅ Conforme | Ligne 30 : `!Object.isFrozen(value)` évite la récursion infinie et les erreurs sur objets déjà gelés |
| Retour gelé | ✅ Conforme | Ligne 34 : `return Object.freeze(obj)` |

### Preuve des tests
`config-loader.test.ts` lignes 215-225 : vérifie `Object.isFrozen(config)`, `config.env`, `config.platform`, `config.security`, `config.infrastructure` — tous retournent `true`. 23/23 tests passés.

### Conclusion
**L'immutabilité est suffisante pour la structure actuelle** (objets plats, chaînes, booléens, nombres). Aucun objet Map/Set/Date n'est présent. La réserve est levée avec la réserve que si des structures complexes (Map, Set, Date) sont ajoutées à l'avenir, `deepFreeze` devra être renforcé.

---

## Réserve 3 — Comportement Fail-fast

### Implémentation (`config-loader.ts:51-110`)

| Cas | Comportement | Preuve |
|-----|--------------|--------|
| Variable obligatoire absente en production | ❌ Erreur fatale | `safeParse` (Zod) rejette ; message "Configuration invalide" |
| Valeur invalide (NODE_ENV, timeout, maintenance) | ❌ Erreur fatale | `safeParse` rejette ; testé lignes 95-107 |
| Secret JWT manquant en production | ❌ Erreur fatale `FATAL_SECURITY` | Lignes 88-94 : `if (!jwtSecret || jwtSecret.length < 32)` → throw |
| Secret JWT invalide (< 32 chars) en production | ❌ Erreur fatale | Même bloc, testé `config-loader.test.ts` |
| Valeur facultative absente | ✅ Non bloquant | `optional()` dans Zod ; `undefined` retourné |
| Valeur par défaut appliquée | ✅ Conforme | `default()` dans Zod pour MOSAIX_DEFAULT_BAC, MOSAIX_COMPOSITION, etc. |
| Fail-fast conditionnel (prod vs dev) | ✅ Conforme | `isProduction` conditionne les checks secrets (lignes 88-110) |

### Tests exécutés
`config-loader.test.ts` couvre :
- "lève une erreur explicite si MOSAIX_AUTH_JWT_SECRET est absent en production" (ligne 41)
- "lève une erreur si le JWT secret fait moins de 32 caractères en production" (ligne 53)
- "n'échoue pas en développement si le JWT secret est absent" (ligne 62)
- "rejette un NODE_ENV invalide" (ligne 96)
- "rejette un MOSAIX_REQUEST_TIMEOUT_MS non numérique" (ligne 102)
- "rejette un MOSAIX_MAINTENANCE_MODE invalide" (ligne 108)
- Valeurs par défaut (lignes 125-144)
- Activation/désactivation conditionnelle (lignes 147-177)

### Conclusion
**Le fail-fast est correctement implémenté.** Les secrets critiques bloquent le démarrage en production ; les valeurs facultatives sont gérées gracieusement ; les valeurs invalides sont rejetées par Zod avant toute utilisation. Réserve levée.

---

## Réserve 4 — Protection des secrets

### Vérification

| Aspect | Résultat | Preuve |
|--------|----------|--------|
| Secrets dans les logs | ✅ Aucun | `config-loader.ts:143-146` : `logger.warn(warning)` logue uniquement des messages statiques sans les valeurs. Testé lignes 216-233 (warnCalls ne contient pas les valeurs secrètes). |
| Secrets dans les messages d'erreur | ✅ Aucun | Les erreurs Zod mentionnent le nom du champ mais jamais la valeur. Testé lignes 236-249. |
| Secrets dans les réponses HTTP | ✅ N/A | `loadConfig` est appelé dans `src/start.ts` au démarrage serveur, pas dans un handler HTTP. Aucun secret n'est retourné dans une réponse. |
| Secrets dans les endpoints de diagnostic | ✅ N/A | Aucun endpoint de diagnostic n'expose `appConfig`. |
| Communications inter-BAC | ✅ N/A | `appConfig` est une `const` locale dans `start.ts`, non exportée, non partagée entre BACs. |
| Valeurs par défaut dangereuses | ✅ Aucune | Aucun secret n'a de valeur par défaut. Seules des valeurs non-sensibles ont des defaults (solara, community-platform, 30000, mosaix-db-1). |
| Secret manquant en production → échec contrôlé | ✅ Conforme | `FATAL_SECURITY` throwé si JWT manquant ou < 32 chars. |

### Preuve des tests
- `config-loader.test.ts` lignes 216-233 : vérifie que `warnSpy` ne contient pas les valeurs des secrets (jwtSecret, sessionSecret, pspWebhookSecret, satimWebhookSecret).
- `config-loader.test.ts` lignes 236-249 : vérifie que le message d'erreur ne contient pas la valeur secrète "a".repeat(32).

### Conclusion
**La protection des secrets est respectée.** Aucun secret n'apparaît dans les logs, les messages d'erreur, ou toute réponse. Réserve levée.

---

## Tableau récapitulatif des réserves

| Réserve | Statut | Preuve principale |
|---------|--------|-------------------|
| R1 — Adoption incomplète | ⚠️ Ouverte (attendue) | 1/42 fichiers migrés ; migration lot par lot prévue |
| R2 — Immutabilité deepFreeze | ✅ Levée | `config-loader.ts:26-35` ; 23/23 tests passés |
| R3 — Fail-fast | ✅ Levée | `config-loader.ts:88-110` ; tests lignes 41-108 |
| R4 — Protection des secrets | ✅ Levée | `config-loader.ts:143-146` ; tests lignes 216-249 |

---

## Diff final (Lot 1)

| Fichier | Action | Justification |
|---------|--------|---------------|
| `packages/core/src/config/config-schema.ts` | Créé | Schémas Zod + interfaces typées |
| `packages/core/src/config/config-loader.ts` | Créé | `loadConfig()` + fail-fast + deepFreeze |
| `packages/core/src/config/config-loader.test.ts` | Créé | 23 tests unitaires |
| `packages/core/src/config/index.ts` | Créé | Point d'export |
| `packages/core/src/index.ts` | Modifié | Ajout export module config |
| `src/start.ts` | Modifié | Import `loadConfig`, appel au démarrage, remplacement d'1 variable `process.env` |

**Aucun fichier hors périmètre.** Aucun des 41 autres fichiers `process.env` n'est touché. Aucune table SQL créée. Aucun cache ajouté. Aucune nouvelle dépendance (Zod déjà présent).

---

## Recommandation et prochaine étape

**Le Lot 1 est certifiable (sous réserve), les réserves R2, R3, R4 sont levées.** La réserve R1 est structurelle (attendue : migration des 41 fichiers restants lot par lot).

**Lot 2 (migration des secrets prioritaires) :** l'ordre recommandé par ChatGPT est :
1. `apps/citadelle/src/infrastructure/security-guard.ts` — contrôles de sécurité
2. `packages/auth/src/oauth/social-auth-service.ts` — authentification externe (OAuth)
3. `src/shell/psp-webhook-handler.ts` — notifications webhook de paiement

**Conditions avant Lot 2 :**
- Aucun secret codé en dur dans les fichiers migrés
- Aucun secret dans les logs, traces d'erreur, réponses HTTP
- Aucun accès non autorisé aux secrets d'un autre BAC
- Secrets obligatoires manquants → échec contrôlé
- Tests spécifiques par secret (chargement, rejet, absence de fuite)

**Le Lot 1 est prêt pour certification définitive et autorisation du Lot 2, sous réserve que ces conditions soient respectées lors de la migration des secrets.**

---
*Rapport de revue complémentaire produit en lecture seule. Aucun fichier n'a été modifié durant cette revue.*